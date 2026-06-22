import { describe, expect, test } from 'vitest';
import { Streams } from '../streams.js';
import { Language } from './language.js';

describe('Language', () => {
  describe('content parts', () => {
    test('text() should build a text part', () => {
      // Assert
      expect(Language.text('hi')).toEqual({ type: 'text', text: 'hi' });
    });

    test('reasoning() should build a reasoning part', () => {
      // Assert
      expect(Language.reasoning('think')).toEqual({ type: 'reasoning', text: 'think' });
    });

    test('toolCall() should stringify object input to JSON', () => {
      // Assert
      expect(Language.toolCall({ toolCallId: '1', toolName: 'weather', input: { city: 'Tokyo' } })).toEqual({
        type: 'tool-call',
        toolCallId: '1',
        toolName: 'weather',
        input: '{"city":"Tokyo"}',
      });
    });

    test('toolResult() should omit isError when not provided', () => {
      // Act
      const part = Language.toolResult({ toolCallId: '1', toolName: 'weather', result: { temp: 20 } });

      // Assert
      expect('isError' in part).toBe(false);
    });

    test('source() should default sourceType to url and omit title when absent', () => {
      // Assert
      expect(Language.source({ id: 's1', url: 'https://x.test' })).toEqual({
        type: 'source',
        sourceType: 'url',
        id: 's1',
        url: 'https://x.test',
      });
    });
  });

  describe('stream parts', () => {
    test('streamText() should build a start/delta/end block', () => {
      // Assert
      expect(Language.streamText('ab', { length: 1 })).toEqual([
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', delta: 'a' },
        { type: 'text-delta', id: '1', delta: 'b' },
        { type: 'text-end', id: '1' },
      ]);
    });

    test('streamText() should use an array of strings as the deltas verbatim', () => {
      // Assert
      expect(Language.streamText(['Hello', ', ', 'world!'])).toEqual([
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', delta: 'Hello' },
        { type: 'text-delta', id: '1', delta: ', ' },
        { type: 'text-delta', id: '1', delta: 'world!' },
        { type: 'text-end', id: '1' },
      ]);
    });

    test('streamToolInput() should stream stringified input between start and end', () => {
      // Assert
      expect(Language.streamToolInput({ id: 't1', toolName: 'weather', input: { city: 'Tokyo' } })).toEqual([
        { type: 'tool-input-start', id: 't1', toolName: 'weather' },
        { type: 'tool-input-delta', id: 't1', delta: '{"city":"Tokyo"}' },
        { type: 'tool-input-end', id: 't1' },
      ]);
    });

    test('streamStart() should default warnings to an empty array', () => {
      // Assert
      expect(Language.streamStart()).toEqual({ type: 'stream-start', warnings: [] });
    });

    test('streamFinish() should default usage and finish reason', () => {
      // Assert
      expect(Language.streamFinish()).toMatchObject({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' } });
    });

    test('streamFinish() should accept a unified finish reason string', () => {
      // Assert
      expect(Language.streamFinish({ finishReason: 'length' })).toMatchObject({
        type: 'finish',
        finishReason: { unified: 'length', raw: 'length' },
      });
    });

    test('streamFinish() should pass extra fields like providerMetadata onto the part', () => {
      // Assert
      expect(Language.streamFinish({ providerMetadata: { openai: { responseId: 'r1' } } })).toMatchObject({
        type: 'finish',
        providerMetadata: { openai: { responseId: 'r1' } },
      });
    });

    test('streamError() should build an error part', () => {
      // Arrange
      const cause = new Error('mid-stream');

      // Assert
      expect(Language.streamError(cause)).toEqual({ type: 'error', error: cause });
    });
  });

  describe('usage', () => {
    test('should override defaults per field', () => {
      // Act
      const result = Language.usage({ outputTokens: { total: 99 } });

      // Assert
      expect(result.outputTokens.total).toBe(99);
      expect(result.inputTokens.total).toBe(10);
    });

    test('should mirror numeric totals into the primary sub-field', () => {
      // Act
      const result = Language.usage(5, 8);

      // Assert
      expect(result.inputTokens).toEqual({ total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 });
      expect(result.outputTokens).toEqual({ total: 8, text: 8, reasoning: 0 });
    });
  });

  describe('result', () => {
    test('should build a full generate result from a string', () => {
      // Act
      const result = Language.result('hi');

      // Assert
      expect(result.content).toEqual([{ type: 'text', text: 'hi' }]);
      expect(result.finishReason).toEqual({ unified: 'stop', raw: 'stop' });
      expect(result.warnings).toEqual([]);
    });

    test('should coerce a unified finish reason and pass extra fields through', () => {
      // Act
      const result = Language.result([Language.text('x')], {
        finishReason: 'length',
        providerMetadata: { a: { b: 1 } },
      });

      // Assert
      expect(result.finishReason).toEqual({ unified: 'length', raw: 'length' });
      expect(result.providerMetadata).toEqual({ a: { b: 1 } });
    });
  });

  describe('streamResult', () => {
    test('should wrap a ReadableStream as a stream result', async () => {
      // Arrange
      const parts = [...Language.streamText('wrapped'), Language.streamFinish()];
      const stream = Streams.from(parts);

      // Act
      const result = Language.streamResult(stream);

      // Assert
      expect(result.stream).toBe(stream);
      expect(await Streams.toArray(result.stream)).toEqual(parts);
    });

    test('should derive a stream from a string', async () => {
      // Act
      const result = Language.streamResult('hi');
      const parts = await Streams.toArray(result.stream);

      // Assert
      expect(parts[0]).toEqual({ type: 'stream-start', warnings: [] });
      expect(parts.at(-1)).toMatchObject({ type: 'finish' });
    });
  });

  describe('streamParts', () => {
    test('should build a full stream-parts array from a string', () => {
      // Act
      const parts = Language.streamParts('hi');

      // Assert
      expect(parts[0]).toEqual({ type: 'stream-start', warnings: [] });
      expect(parts.slice(1, -1)).toEqual([
        { type: 'text-start', id: '0' },
        { type: 'text-delta', id: '0', delta: 'hi' },
        { type: 'text-end', id: '0' },
      ]);
      expect(parts.at(-1)).toMatchObject({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' } });
    });

    test('should coerce a unified finish reason onto the finish part', () => {
      // Act
      const parts = Language.streamParts([Language.text('a')], { finishReason: 'length' });

      // Assert
      expect(parts.at(-1)).toMatchObject({ type: 'finish', finishReason: { unified: 'length', raw: 'length' } });
    });
  });
});
