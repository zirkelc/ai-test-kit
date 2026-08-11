import type { EmbeddingModelV4CallOptions } from '@ai-sdk/provider';
import { embed, embedMany } from 'ai';
import { describe, expect, test, vi } from 'vitest';
import { Errors } from '../errors.js';
import { MockEmbeddingModel } from './mock-embedding-model.js';

/** Minimal call options for driving `doEmbed` directly. */
const callOptions: EmbeddingModelV4CallOptions = { values: ['hi'] };

describe('MockEmbeddingModel', () => {
  describe('from', () => {
    test('should embed from a bare embeddings matrix', async () => {
      // Arrange
      const model = MockEmbeddingModel.from([[0.1, 0.2, 0.3]]);

      // Act
      const result = await embed({ model, value: 'hi' });

      // Assert
      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    test('should default usage and warnings for a bare matrix', async () => {
      // Arrange
      const model = MockEmbeddingModel.from([[0.1]]);

      // Act
      const result = await model.doEmbed(callOptions);

      // Assert
      expect(result.usage).toEqual({ tokens: 0 });
      expect(result.warnings).toEqual([]);
    });

    test('should throw when given an Error', async () => {
      // Arrange
      const model = MockEmbeddingModel.from(new Error('rate limited'));

      // Act
      const result = embed({ model, value: 'hi' });

      // Assert
      await expect(result).rejects.toThrow();
    });

    test('should resolve a function response from the call options', async () => {
      // Arrange
      const model = MockEmbeddingModel.from(async (options) => ({
        embeddings: options.values.map((value) => [value.length]),
        usage: { tokens: 0 },
        warnings: [],
      }));

      // Act
      const result = await embed({ model, value: 'hello' });

      // Assert
      expect(result.embedding).toEqual([5]);
    });

    test('should accept a full result and keep its usage', async () => {
      // Arrange
      const model = MockEmbeddingModel.from({ embeddings: [[1, 2]], usage: { tokens: 7 }, warnings: [] });

      // Act
      const result = await embed({ model, value: 'hi' });

      // Assert
      expect(result.embedding).toEqual([1, 2]);
      expect(result.usage).toEqual({ tokens: 7 });
    });

    test('should throw a clear error when no response is configured', async () => {
      // Arrange
      const model = MockEmbeddingModel.from();

      // Act
      const result = model.doEmbed(callOptions);

      // Assert
      await expect(result).rejects.toThrow();
    });
  });

  describe('delays', () => {
    test('should resolve a delayed embed result only once the delay has elapsed', async () => {
      // Arrange
      vi.useFakeTimers();
      try {
        const model = MockEmbeddingModel.from({ embeddings: [[0.1]], delayInMs: 5_000 });

        // Act
        const result = Promise.resolve(model.doEmbed(callOptions));
        let settled = false;
        void result.then(() => {
          settled = true;
        });
        await vi.advanceTimersByTimeAsync(4_999);
        const settledEarly = settled;
        await vi.advanceTimersByTimeAsync(1);

        // Assert
        expect(settledEarly).toBe(false);
        expect((await result).embeddings).toEqual([[0.1]]);
        expect('delayInMs' in (await result)).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    test('should reject with the configured error once the delay has elapsed', async () => {
      // Arrange
      vi.useFakeTimers();
      try {
        const error = Errors.serviceUnavailable();
        const model = MockEmbeddingModel.from({ error, delayInMs: 5_000 });

        // Act
        const outcome = Promise.resolve(model.doEmbed(callOptions)).catch((e: unknown) => e);
        await vi.advanceTimersByTimeAsync(5_000);

        // Assert
        expect(await outcome).toBe(error);
      } finally {
        vi.useRealTimers();
      }
    });

    test('should reject with an AbortError when the call abortSignal fires mid-delay', async () => {
      // Arrange
      vi.useFakeTimers();
      try {
        const controller = new AbortController();
        const model = MockEmbeddingModel.from({ embeddings: [[0.1]], delayInMs: 5_000 });

        // Act
        const outcome = Promise.resolve(model.doEmbed({ ...callOptions, abortSignal: controller.signal })).catch(
          (e: unknown) => e,
        );
        controller.abort();
        const error = await outcome;

        // Assert
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe('AbortError');
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    test('should reject with a TimeoutError when the call abortSignal is a deadline that fires mid-delay', async () => {
      // Arrange
      const model = MockEmbeddingModel.from({ embeddings: [[0.1]], delayInMs: 5_000 });

      // Act
      const error = await embed({
        model,
        value: 'hi',
        abortSignal: AbortSignal.timeout(10),
        maxRetries: 0,
      }).catch((e: unknown) => e);

      // Assert
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('TimeoutError');
    });

    test('should schedule no timer when no delay is configured', async () => {
      // Arrange
      vi.useFakeTimers();
      const scheduled = vi.spyOn(globalThis, 'setTimeout');
      try {
        const model = MockEmbeddingModel.from({ embeddings: [[0.1]] });

        // Act
        const result = await model.doEmbed(callOptions);

        // Assert
        expect(result.embeddings).toEqual([[0.1]]);
        expect(scheduled.mock.calls.length).toBe(0);
      } finally {
        scheduled.mockRestore();
        vi.useRealTimers();
      }
    });
  });

  describe('sequencing', () => {
    test('should advance through a sequence and clamp to the last', async () => {
      // Arrange
      const model = MockEmbeddingModel.from([new Error('429'), [[0.1]], [[0.2]]]);

      // Act + Assert
      await expect(model.doEmbed(callOptions)).rejects.toThrow();
      expect((await model.doEmbed(callOptions)).embeddings).toEqual([[0.1]]);
      expect((await model.doEmbed(callOptions)).embeddings).toEqual([[0.2]]);
      expect((await model.doEmbed(callOptions)).embeddings).toEqual([[0.2]]);
    });

    test('should treat a single matrix as one result with many vectors', async () => {
      // Arrange — number[][] is one result with two vectors, not a sequence of two responses
      const model = MockEmbeddingModel.from([[0.1], [0.2]], { maxEmbeddingsPerCall: 8 });

      // Act
      const result = await embedMany({ model, values: ['a', 'b'] });

      // Assert
      expect(result.embeddings).toEqual([[0.1], [0.2]]);
    });
  });

  describe('spying', () => {
    test('should record calls on the spy and on the call history', async () => {
      // Arrange
      const model = MockEmbeddingModel.from([[0.1]]);

      // Act
      await model.doEmbed(callOptions);

      // Assert
      expect(model.doEmbed.mock.calls.length).toBe(1);
      const input = model.doEmbed.mock.calls[0];
      expect(input).toEqual([callOptions]);
    });
  });

  describe('options', () => {
    test('should default provider, auto-increment modelId, and set spec defaults', () => {
      // Arrange
      const a = MockEmbeddingModel.from();
      const b = MockEmbeddingModel.from();

      // Assert
      expect(a.provider).toBe('mock-provider');
      expect(a.modelId).not.toBe(b.modelId);
      expect(a.maxEmbeddingsPerCall).toBe(1);
      expect(a.supportsParallelCalls).toBe(true);
    });

    test('should honor identity and capability overrides', () => {
      // Arrange
      const model = MockEmbeddingModel.from([[0.1]], {
        provider: 'acme',
        modelId: 'acme-embed',
        maxEmbeddingsPerCall: 8,
        supportsParallelCalls: false,
      });

      // Assert
      expect(model.provider).toBe('acme');
      expect(model.modelId).toBe('acme-embed');
      expect(model.maxEmbeddingsPerCall).toBe(8);
      expect(model.supportsParallelCalls).toBe(false);
    });
  });

  describe('callOptions', () => {
    test('should build valid options defaulting the values', () => {
      // Act
      const options = MockEmbeddingModel.callOptions({ headers: { 'x-test': '1' } });

      // Assert
      expect(options.values).toEqual(['hello']);
      expect(options.headers).toEqual({ 'x-test': '1' });
    });
  });
});
