import { generateText, streamText } from 'ai';
import { describe, expect, test } from 'vitest';
import { Streams } from '../streams.js';
import { Language } from './language.js';
import { MockLanguageModel } from './mock-language-model.js';
import { Options } from './options.js';

describe('MockLanguageModel', () => {
  describe('generate', () => {
    test('should return text content from a string shorthand', async () => {
      // Arrange
      const model = MockLanguageModel.from('Hello, world!');

      // Act
      const result = await generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(result.text).toBe('Hello, world!');
    });

    test('should throw from an Error shorthand', async () => {
      // Arrange
      const model = MockLanguageModel.from(new Error('boom'));

      // Act
      const result = generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      await expect(result).rejects.toThrow();
    });

    test('should return explicit content built from ContentParts atoms', async () => {
      // Arrange
      const model = MockLanguageModel.from({ content: [Language.text('explicit')] });

      // Act
      const result = await generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(result.text).toBe('explicit');
      expect(result.finishReason).toBe('stop');
    });

    test('should accept a unified finish-reason string in the content form', async () => {
      // Arrange
      const model = MockLanguageModel.from({ content: [Language.text('truncated')], finishReason: 'length' });

      // Act
      const result = await generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(result.finishReason).toBe('length');
    });

    test('should resolve the generate form from a function of the call options', async () => {
      // Arrange
      const model = MockLanguageModel.from({
        doGenerate: async (options) => Language.result(`prompt-parts:${options.prompt.length}`),
      });

      // Act
      const result = await generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(result.text).toBe('prompt-parts:1');
    });

    test('should surface a tool call from Language.toolCall', async () => {
      // Arrange
      const model = MockLanguageModel.from({
        content: [Language.toolCall({ toolCallId: 'call-1', toolName: 'weather', input: { city: 'Tokyo' } })],
      });

      // Act
      const result = await generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(result.toolCalls.length).toBe(1);
      expect(result.toolCalls[0]!.toolName).toBe('weather');
    });
  });

  describe('stream', () => {
    test('should stream text from a string shorthand', async () => {
      // Arrange
      const model = MockLanguageModel.from('Hello World');

      // Act
      const result = streamText({ model, prompt: 'Hi', ...Options.stream });
      const text = (await Streams.toArray(result.textStream)).join('');

      // Assert
      expect(text).toBe('Hello World');
    });

    test('should stream from composed StreamParts', async () => {
      // Arrange
      const chunks = [Language.streamStart(), ...Language.streamText('abcdef', { length: 2 }), Language.streamFinish()];
      const model = MockLanguageModel.from({ doStream: chunks });

      // Act
      const result = streamText({ model, prompt: 'Hi', ...Options.stream });
      const text = (await Streams.toArray(result.textStream)).join('');

      // Assert
      expect(text).toBe('abcdef');
    });

    test('should derive a stream from content', async () => {
      // Arrange
      const model = MockLanguageModel.from({ content: [Language.text('derived')] });

      // Act
      const result = streamText({ model, prompt: 'Hi', ...Options.stream });
      const text = (await Streams.toArray(result.textStream)).join('');

      // Assert
      expect(text).toBe('derived');
    });

    test('should make a string and the equivalent content stream identically', async () => {
      // Arrange
      const fromString = MockLanguageModel.from('Hello');
      const fromContent = MockLanguageModel.from({ content: [Language.text('Hello')] });
      const callOptions = { prompt: [] } as never;

      // Act
      const stringParts = await Streams.toArray((await fromString.doStream(callOptions)).stream);
      const contentParts = await Streams.toArray((await fromContent.doStream(callOptions)).stream);

      // Assert
      expect(stringParts).toEqual(contentParts);
    });

    test('should stream from a chunks object with delays', async () => {
      // Arrange
      const model = MockLanguageModel.from({
        doStream: { chunks: [...Language.streamText('fast'), Language.streamFinish()], chunkDelayInMs: 0 },
      });

      // Act
      const result = streamText({ model, prompt: 'Hi', ...Options.stream });
      const text = (await Streams.toArray(result.textStream)).join('');

      // Assert
      expect(text).toBe('fast');
    });

    test('should resolve the stream form from a function of the call options', async () => {
      // Arrange
      const model = MockLanguageModel.from({
        doStream: async (options) => Language.streamResult(options.prompt.length > 0 ? 'has-prompt' : 'empty'),
      });

      // Act
      const result = streamText({ model, prompt: 'Hi', ...Options.stream });
      const text = (await Streams.toArray(result.textStream)).join('');

      // Assert
      expect(text).toBe('has-prompt');
    });

    test('should stream from a bare ReadableStream in the stream form', async () => {
      // Arrange
      const parts = [Language.streamStart(), ...Language.streamText('piped'), Language.streamFinish()];
      const model = MockLanguageModel.from({ doStream: Streams.from(parts) });

      // Act
      const result = streamText({ model, prompt: 'Hi', ...Options.stream });
      const text = (await Streams.toArray(result.textStream)).join('');

      // Assert
      expect(text).toBe('piped');
    });

    test('should error with an AbortError when the call abortSignal fires mid-stream', async () => {
      // Arrange
      const controller = new AbortController();
      const parts = [Language.streamStart(), ...Language.streamText('Hello World'), Language.streamFinish()];
      const model = MockLanguageModel.from({ doStream: { chunks: parts, chunkDelayInMs: 10 } });
      const { stream } = await model.doStream({ prompt: [], abortSignal: controller.signal } as never);
      const reader = stream.getReader();

      // Act
      const first = await reader.read();
      controller.abort();
      const error = await reader.read().catch((e: unknown) => e);

      // Assert
      expect(first.value).toEqual(parts[0]);
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('AbortError');
    });
  });

  describe('sequencing', () => {
    test('should advance through an array of responses per call', async () => {
      // Arrange
      const model = MockLanguageModel.from(['first', 'second']);

      // Act
      const a = await generateText({ model, prompt: 'Hi', ...Options.generate });
      const b = await generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(a.text).toBe('first');
      expect(b.text).toBe('second');
    });

    test('should clamp to the last response once the array is exhausted', async () => {
      // Arrange
      const model = MockLanguageModel.from(['only-first', 'last']);

      // Act
      await generateText({ model, prompt: 'Hi', ...Options.generate });
      await generateText({ model, prompt: 'Hi', ...Options.generate });
      const third = await generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(third.text).toBe('last');
    });
  });

  describe('vitest integration', () => {
    test('should record calls on the vi.fn spy', async () => {
      // Arrange
      const model = MockLanguageModel.from('hi');

      // Act
      await generateText({ model, prompt: 'question', ...Options.generate });

      // Assert
      expect(model.doGenerate).toHaveBeenCalledTimes(1);
      const callArgs = model.doGenerate.mock.calls[0]!;
      expect(callArgs[0].prompt).toEqual([{ role: 'user', content: [{ type: 'text', text: 'question' }] }]);
    });

    test('should record calls on the native call array', async () => {
      // Arrange
      const model = MockLanguageModel.from('hi');

      // Act
      await generateText({ model, prompt: 'question', ...Options.generate });

      // Assert
      expect(model.doGenerateCalls.length).toBe(1);
      expect(model.doGenerateCalls[0]!.prompt).toEqual([
        { role: 'user', content: [{ type: 'text', text: 'question' }] },
      ]);
    });

    test('should not call the fallback when the primary succeeds', async () => {
      // Arrange
      const primary = MockLanguageModel.from('primary');
      const fallback = MockLanguageModel.from('fallback');

      // Act
      await generateText({ model: primary, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(primary.doGenerate).toHaveBeenCalledTimes(1);
      expect(fallback.doGenerate).toHaveBeenCalledTimes(0);
    });
  });

  describe('callOptions', () => {
    test('should build valid options defaulting the prompt', () => {
      // Act
      const options = MockLanguageModel.callOptions();

      // Assert
      expect(options.prompt).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Hello!' }] }]);
    });

    test('should merge overrides', () => {
      // Act
      const options = MockLanguageModel.callOptions({ temperature: 0.5 });

      // Assert
      expect(options.temperature).toBe(0.5);
      expect(options.prompt.length).toBe(1);
    });

    test('a built result can drive the doGenerate spy directly', async () => {
      // Arrange
      const model = MockLanguageModel.from();
      model.doGenerate.mockResolvedValue(Language.result('stubbed'));

      // Act
      const result = await generateText({ model, prompt: 'Hi', ...Options.generate });

      // Assert
      expect(result.text).toBe('stubbed');
    });
  });

  describe('identity', () => {
    test('should default provider and auto-increment modelId', () => {
      // Arrange
      const a = MockLanguageModel.from();
      const b = MockLanguageModel.from();

      // Act + Assert
      expect(a.provider).toBe('mock-provider');
      expect(a.modelId).not.toBe(b.modelId);
    });

    test('should honor provider and modelId overrides', () => {
      // Arrange
      const model = MockLanguageModel.from('hi', { provider: 'acme', modelId: 'acme-1' });

      // Act + Assert
      expect(model.provider).toBe('acme');
      expect(model.modelId).toBe('acme-1');
    });
  });
});
