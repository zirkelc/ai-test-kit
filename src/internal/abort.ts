/** Shared abort handling for the mock models, so every cancelled call and stream fails the same way. */

import { Errors } from '../errors.js';

/**
 * The error an aborted signal should fail with. A real provider call cut short rejects with the signal's
 * own `reason`, and consumers discriminate on its `name`: a signal from `AbortSignal.timeout()` carries a
 * `TimeoutError`, while `controller.abort()` with no argument carries an `AbortError`. Both are
 * `DOMException`s, which extend `Error`, so they are forwarded untouched and that distinction survives
 * instead of every cancellation collapsing to `AbortError`.
 *
 * A signal can be aborted with any value at all, so a reason that is not an `Error` is normalized into
 * one carrying its text, keeping the thrown value something a test can rely on. The spec always sets a
 * reason once a signal is aborted, so the missing-reason case only guards against a host that does not,
 * rather than failing with `undefined`.
 */
export const resolveAbortReason = (signal: AbortSignal): Error => {
  const { reason } = signal;
  if (reason instanceof Error) return reason;
  if (reason == null) return Errors.abort();
  return Errors.abort({ message: String(reason) });
};
