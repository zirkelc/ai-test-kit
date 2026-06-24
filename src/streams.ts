import { convertArrayToReadableStream, convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { Errors } from './errors.js';

/** Simulated timing for a stream. Shared by `Streams.simulate`, `MockLanguageModel.streamResult`, and the `stream` chunks form. */
export type StreamDelayOptions = {
  /** Delay before the first chunk. `0` or `null` emit without a timer (safe under fake timers); a positive value waits. Defaults to no delay. */
  initialDelayInMs?: number | null;
  /** Delay between each subsequent chunk. `0` or `null` emit without a timer (safe under fake timers); a positive value waits. Defaults to no delay. */
  chunkDelayInMs?: number | null;
  /** When provided, the stream errors with an `AbortError` the instant the signal fires. */
  abortSignal?: AbortSignal;
};

/**
 * Waits `ms`, resolving early if the signal aborts so the caller can react immediately. A non-positive or
 * `null` delay resolves at once without scheduling a timer, so it stays inert under `vi.useFakeTimers()`.
 */
const delay = (ms: number | null, signal: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve) => {
    if (ms == null || ms <= 0) {
      resolve();
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Builds a `ReadableStream`, a port of the AI SDK's `simulateReadableStream` extended with abort handling:
 * when an `abortSignal` fires it errors with an `AbortError` at once (even mid-delay), matching a real
 * provider stream. By default there is no delay and no timer (so it is safe under fake timers); only a
 * positive `initialDelayInMs` / `chunkDelayInMs` schedules a real `setTimeout`.
 */
export const simulateStream = <CHUNK>(chunks: Array<CHUNK>, opts: StreamDelayOptions = {}): ReadableStream<CHUNK> => {
  const { abortSignal, initialDelayInMs = null, chunkDelayInMs = null } = opts;
  let index = 0;
  return new ReadableStream<CHUNK>({
    async pull(controller) {
      if (abortSignal?.aborted) {
        controller.error(Errors.abort());
        return;
      }
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      await delay(index === 0 ? initialDelayInMs : chunkDelayInMs, abortSignal);
      if (abortSignal?.aborted) {
        controller.error(Errors.abort());
        return;
      }
      controller.enqueue(chunks[index]!);
      index += 1;
    },
  });
};

/**
 * Wraps a `ReadableStream` so it can also be consumed via `for await`, piping through a fresh
 * `TransformStream` so the source stays unlocked. Ported from the AI SDK's `createAsyncIterableStream`.
 */
const streamToAsyncIterable = <CHUNK>(source: ReadableStream<CHUNK>): ReadableStream<CHUNK> & AsyncIterable<CHUNK> => {
  const stream = source.pipeThrough(new TransformStream<CHUNK, CHUNK>());
  return Object.assign(stream, {
    [Symbol.asyncIterator](): AsyncIterator<CHUNK> {
      const reader = stream.getReader();
      let finished = false;
      const cleanup = async (): Promise<void> => {
        finished = true;
        try {
          await reader.cancel();
        } finally {
          try {
            reader.releaseLock();
          } catch {
            /** ignore if the lock is already released */
          }
        }
      };
      return {
        async next(): Promise<IteratorResult<CHUNK>> {
          if (finished) return { done: true, value: undefined };
          const { done, value } = await reader.read();
          if (done) {
            await cleanup();
            return { done: true, value: undefined };
          }
          return { done: false, value };
        },
        async return(): Promise<IteratorResult<CHUNK>> {
          await cleanup();
          return { done: true, value: undefined };
        },
        async throw(error: unknown): Promise<IteratorResult<CHUNK>> {
          await cleanup();
          throw error;
        },
      };
    },
  });
};

/** Generic, layer-agnostic operations for building, draining, and converting `ReadableStream`s in tests. */
export const Streams = {
  /** Builds a `ReadableStream` from an array of chunks. */
  from: <CHUNK>(chunks: Array<CHUNK>): ReadableStream<CHUNK> => convertArrayToReadableStream(chunks),

  /** Builds a `ReadableStream` that emits chunks with optional delays, for timing tests. */
  simulate: <CHUNK>(chunks: Array<CHUNK>, opts: StreamDelayOptions = {}): ReadableStream<CHUNK> =>
    simulateStream(chunks, opts),

  /** Reads a stream to completion and returns every chunk it emitted. */
  toArray: <CHUNK>(stream: ReadableStream<CHUNK>): Promise<Array<CHUNK>> => convertReadableStreamToArray(stream),

  /** Wraps a `ReadableStream` so it can also be consumed via `for await`. */
  toIterable: <CHUNK>(stream: ReadableStream<CHUNK>): ReadableStream<CHUNK> & AsyncIterable<CHUNK> =>
    streamToAsyncIterable(stream),
};
