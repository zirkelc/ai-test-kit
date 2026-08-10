import { generateImage } from 'ai';
import { describe, expect, test, vi } from 'vitest';
import { Errors } from '../errors.js';
import { base64Png1x1 } from './image.js';
import { MockImageModel } from './mock-image-model.js';

describe('MockImageModel', () => {
  describe('from', () => {
    test('should generate from a bare images array', async () => {
      // Arrange
      const model = MockImageModel.from([base64Png1x1]);

      // Act
      const result = await generateImage({ model, prompt: 'a cat' });

      // Assert
      expect(result.images.length).toBe(1);
      expect(result.images[0]?.base64).toBe(base64Png1x1);
    });

    test('should default warnings for a bare images array', async () => {
      // Arrange
      const model = MockImageModel.from([base64Png1x1]);

      // Act
      const result = await generateImage({ model, prompt: 'a cat' });

      // Assert
      expect(result.warnings).toEqual([]);
    });

    test('should throw when given an Error', async () => {
      // Arrange
      const model = MockImageModel.from(new Error('rate limited'));

      // Act
      const result = generateImage({ model, prompt: 'a cat' });

      // Assert
      await expect(result).rejects.toThrow();
    });

    test('should resolve a function response from the call options', async () => {
      // Arrange
      const model = MockImageModel.from(async (options) => ({
        images: [base64Png1x1],
        warnings: [],
        response: { timestamp: new Date(0), modelId: String(options.n), headers: undefined },
      }));

      // Act
      const result = await generateImage({ model, prompt: 'a cat' });

      // Assert
      expect(result.images[0]?.base64).toBe(base64Png1x1);
    });

    test('should throw a clear error when no response is configured', async () => {
      // Arrange
      const model = MockImageModel.from();

      // Act
      const result = generateImage({ model, prompt: 'x' });

      // Assert
      await expect(result).rejects.toThrow();
    });
  });

  describe('delays', () => {
    test('should resolve a delayed generate result only once the delay has elapsed', async () => {
      // Arrange
      vi.useFakeTimers();
      try {
        const model = MockImageModel.from({ images: [base64Png1x1], delayInMs: 5_000 });

        // Act
        const result = Promise.resolve(model.doGenerate(MockImageModel.callOptions()));
        let settled = false;
        void result.then(() => {
          settled = true;
        });
        await vi.advanceTimersByTimeAsync(4_999);
        const settledEarly = settled;
        await vi.advanceTimersByTimeAsync(1);

        // Assert
        expect(settledEarly).toBe(false);
        expect((await result).images).toEqual([base64Png1x1]);
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
        const model = MockImageModel.from({ error, delayInMs: 5_000 });

        // Act
        const outcome = Promise.resolve(model.doGenerate(MockImageModel.callOptions())).catch((e: unknown) => e);
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
        const model = MockImageModel.from({ images: [base64Png1x1], delayInMs: 5_000 });

        // Act
        const outcome = Promise.resolve(
          model.doGenerate(MockImageModel.callOptions({ abortSignal: controller.signal })),
        ).catch((e: unknown) => e);
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

    test('should schedule no timer when no delay is configured', async () => {
      // Arrange
      vi.useFakeTimers();
      const scheduled = vi.spyOn(globalThis, 'setTimeout');
      try {
        const model = MockImageModel.from({ images: [base64Png1x1] });

        // Act
        const result = await model.doGenerate(MockImageModel.callOptions());

        // Assert
        expect(result.images).toEqual([base64Png1x1]);
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
      const model = MockImageModel.from([new Error('429'), [base64Png1x1]]);

      // Act + Assert
      await expect(generateImage({ model, prompt: 'a' })).rejects.toThrow();
      expect((await generateImage({ model, prompt: 'b' })).images[0]?.base64).toBe(base64Png1x1);
      expect((await generateImage({ model, prompt: 'c' })).images[0]?.base64).toBe(base64Png1x1);
    });
  });

  describe('spying', () => {
    test('should record calls on the spy and on the call history', async () => {
      // Arrange
      const model = MockImageModel.from([base64Png1x1]);

      // Act
      await generateImage({ model, prompt: 'a cat' });

      // Assert
      expect(model.doGenerate.mock.calls.length).toBe(1);
      expect(model.doGenerate.mock.calls[0]?.[0].prompt).toBe('a cat');
    });
  });

  describe('options', () => {
    test('should default provider, auto-increment modelId, and set spec defaults', () => {
      // Arrange
      const a = MockImageModel.from();
      const b = MockImageModel.from();

      // Assert
      expect(a.provider).toBe('mock-provider');
      expect(a.modelId).not.toBe(b.modelId);
      expect(a.maxImagesPerCall).toBe(1);
    });

    test('should honor identity and capability overrides', () => {
      // Arrange
      const model = MockImageModel.from([base64Png1x1], {
        provider: 'acme',
        modelId: 'acme-image',
        maxImagesPerCall: 4,
      });

      // Assert
      expect(model.provider).toBe('acme');
      expect(model.modelId).toBe('acme-image');
      expect(model.maxImagesPerCall).toBe(4);
    });
  });

  describe('callOptions', () => {
    test('should build valid options with all required keys present', () => {
      // Act
      const options = MockImageModel.callOptions({ prompt: 'A sunset' });

      // Assert
      expect(options.prompt).toBe('A sunset');
      expect(options.n).toBe(1);
      expect(options.providerOptions).toEqual({});
    });
  });
});
