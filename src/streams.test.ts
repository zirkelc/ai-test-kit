import { describe, expect, test, vi } from 'vitest';
import { Language } from './language/language.js';
import { Streams } from './streams.js';

describe('Streams', () => {
  test('from() and toArray() should round-trip parts', async () => {
    // Arrange
    const parts = Language.streamText('round');

    // Act
    const roundTripped = await Streams.toArray(Streams.from(parts));

    // Assert
    expect(roundTripped).toEqual(parts);
  });

  test('simulate() should drain to the provided chunks', async () => {
    // Arrange
    const parts = Language.streamText('sim');

    // Act
    const drained = await Streams.toArray(Streams.simulate(parts));

    // Assert
    expect(drained).toEqual(parts);
  });

  test('toIterable() should make a stream consumable via for-await', async () => {
    // Arrange
    const stream = Streams.from(['a', 'b', 'c']);

    // Act
    const collected: Array<string> = [];
    for await (const item of Streams.toIterable(stream)) {
      collected.push(item);
    }

    // Assert
    expect(collected).toEqual(['a', 'b', 'c']);
  });

  test('toIterable() should stop reading the source when the loop breaks early', async () => {
    // Arrange
    const stream = Streams.from(['a', 'b', 'c']);

    // Act
    const collected: Array<string> = [];
    for await (const item of Streams.toIterable(stream)) {
      collected.push(item);
      break;
    }

    // Assert
    expect(collected).toEqual(['a']);
  });

  test('simulate() should error with an AbortError when the signal is already aborted', async () => {
    // Arrange
    const controller = new AbortController();
    controller.abort();
    const stream = Streams.simulate(Language.streamText('nope'), { abortSignal: controller.signal });

    // Act
    const error = await Streams.toArray(stream).catch((e: unknown) => e);

    // Assert
    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe('AbortError');
  });

  test('simulate() should drain without a real timer under fake timers when no delay is set', async () => {
    // Arrange
    vi.useFakeTimers();
    try {
      const parts = Language.streamText('fast');

      // Act
      const drained = await Streams.toArray(Streams.simulate(parts));

      // Assert
      expect(drained).toEqual(parts);
    } finally {
      vi.useRealTimers();
    }
  });

  test('simulate() should treat an explicit 0 delay as no timer under fake timers', async () => {
    // Arrange
    vi.useFakeTimers();
    try {
      const parts = Language.streamText('fast');

      // Act
      const drained = await Streams.toArray(Streams.simulate(parts, { initialDelayInMs: 0, chunkDelayInMs: 0 }));

      // Assert
      expect(drained).toEqual(parts);
    } finally {
      vi.useRealTimers();
    }
  });

  test('simulate() should error the instant the signal fires mid-stream', async () => {
    // Arrange
    const controller = new AbortController();
    const parts = [...Language.streamText('Hello World'), Language.streamFinish()];
    const stream = Streams.simulate(parts, { chunkDelayInMs: 10, abortSignal: controller.signal });
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
