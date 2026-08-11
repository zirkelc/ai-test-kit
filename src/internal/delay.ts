/** Shared latency simulation for the mock models, so streaming and non-streaming calls wait the same way. */

import { Errors } from '../errors.js';

/**
 * Simulated latency for a non-streaming mock call. Shared by the object forms of the `doGenerate`,
 * `doEmbed`, and `{ error }` responses. The call's own `abortSignal` is honored automatically, so a
 * delayed call rejects with an `AbortError` the instant the signal fires.
 */
export type CallDelayOptions = {
  /**
   * How long the call takes before it settles. `0` or `null` settles without a timer (safe under fake
   * timers); a positive value waits. Defaults to no delay.
   */
  delayInMs?: number | null;
};

/** A failing response with simulated latency: waits `delayInMs`, then rejects with `error`. */
export type ErrorInput = { error: Error } & CallDelayOptions;

/** Narrows an object response to the `{ error }` form. */
export const isErrorInput = (value: unknown): value is ErrorInput =>
  typeof value === 'object' && value !== null && 'error' in value && value.error instanceof Error;

/**
 * Waits `ms`, resolving early if the signal aborts so the caller can react immediately. A non-positive or
 * `null` delay resolves at once without scheduling a timer, so it stays inert under `vi.useFakeTimers()`.
 */
export const delay = (ms: number | null | undefined, signal: AbortSignal | undefined): Promise<void> =>
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
 * Waits `ms` before a mock call settles, rejecting with an `AbortError` (and clearing the timer) the
 * instant the signal fires, like a real provider call cut short by a deadline. Without a positive delay
 * it returns immediately, scheduling no timer and ignoring the signal, so an undelayed mock behaves
 * exactly as it does with no delay support at all.
 */
export const delayOrAbort = async (ms: number | null | undefined, signal: AbortSignal | undefined): Promise<void> => {
  if (ms == null || ms <= 0) return;
  if (signal?.aborted) throw Errors.abort();
  await delay(ms, signal);
  if (signal?.aborted) throw Errors.abort();
};
