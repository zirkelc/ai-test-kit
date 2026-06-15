import { APICallError } from '@ai-sdk/provider';

/**
 * A `Retry-After` value in any of the forms a provider sends it:
 * - `number` — seconds, emitted as a `retry-after` header (`'5'`).
 * - `Date` — an absolute time, emitted as an HTTP-date `retry-after` header (`.toUTCString()`).
 * - `{ ms }` — milliseconds, emitted as a `retry-after-ms` header (`'3000'`).
 */
export type RetryAfter = number | Date | { ms: number };

/** Maps a {@link RetryAfter} to the response header(s) a provider would set, or `{}` when absent. */
const retryAfterHeaders = (retryAfter: RetryAfter | undefined): Record<string, string> => {
  if (retryAfter === undefined) return {};
  if (typeof retryAfter === 'number') return { 'retry-after': String(retryAfter) };
  if (retryAfter instanceof Date) return { 'retry-after': retryAfter.toUTCString() };
  return { 'retry-after-ms': String(retryAfter.ms) };
};

/** Options for {@link Errors.from}; everything is optional and the noise fields default to inert values. */
export type ApiCallErrorOptions = {
  /** The error message. Defaults to `'API call error'`. */
  message?: string;
  /** The HTTP status code the provider responded with. */
  statusCode?: number;
  /** Whether the AI SDK treats the error as retryable. When omitted, `APICallError` derives it from the status (408/409/429/5xx). */
  isRetryable?: boolean;
  /** Response headers, e.g. `{ 'retry-after': '5' }`. Defaults to `{}`. */
  responseHeaders?: Record<string, string>;
  /** The raw response body. */
  responseBody?: string;
  /** The request URL. Defaults to `''`. */
  url?: string;
  /** The request body values. Defaults to `{}`. */
  requestBodyValues?: unknown;
  /** Parsed provider error payload, exposed on `error.data`. */
  data?: unknown;
  /** The underlying cause. */
  cause?: unknown;
};

/** Options shared by the named `APICallError` factories. */
type ApiErrorOptions = {
  /** Overrides the default message for this error category. */
  message?: string;
};

/** Options for the rate-limit and service-unavailable factories, which can carry a `Retry-After`. */
type RetryableErrorOptions = ApiErrorOptions & {
  /** A `Retry-After` value to advertise on the response headers. */
  retryAfter?: RetryAfter;
};

/**
 * Builders for the provider errors a mock model throws to drive retry, fallback, and error-handling
 * tests. Pass one straight into a mock, e.g. `MockLanguageModel.from(Errors.rateLimited())`. The named
 * factories fill the realistic shape each category has; `from` is the escape hatch for anything else.
 */
export const Errors = {
  /**
   * Builds an `APICallError`, defaulting the fields a test rarely cares about (`url`, `requestBodyValues`, ...).
   * `isRetryable` is left to `APICallError`, which derives it from the status code (408/409/429/5xx) when omitted.
   */
  from: (options: ApiCallErrorOptions = {}): APICallError =>
    new APICallError({
      message: options.message ?? 'API call error',
      url: options.url ?? '',
      requestBodyValues: options.requestBodyValues ?? {},
      statusCode: options.statusCode,
      responseHeaders: options.responseHeaders,
      responseBody: options.responseBody,
      isRetryable: options.isRetryable,
      data: options.data,
      cause: options.cause,
    }),

  /** A rate-limit error: status `429` (retryable by the status-based default), optionally carrying a `Retry-After`. */
  rateLimited: (options: RetryableErrorOptions = {}): APICallError =>
    Errors.from({
      message: options.message ?? 'Rate limit exceeded',
      statusCode: 429,
      responseHeaders: retryAfterHeaders(options.retryAfter),
    }),

  /** A service-unavailable error: status `503` (retryable by the status-based default), optionally carrying a `Retry-After`. */
  serviceUnavailable: (options: RetryableErrorOptions = {}): APICallError =>
    Errors.from({
      message: options.message ?? 'Service unavailable',
      statusCode: 503,
      responseHeaders: retryAfterHeaders(options.retryAfter),
    }),

  /** An overloaded error: status `529` (retryable by the status-based default). */
  serviceOverloaded: (options: ApiErrorOptions = {}): APICallError =>
    Errors.from({
      message: options.message ?? 'Overloaded',
      statusCode: 529,
    }),

  /** A generic server error: status `500` (retryable by the status-based default). */
  internalServerError: (options: ApiErrorOptions = {}): APICallError =>
    Errors.from({
      message: options.message ?? 'Internal server error',
      statusCode: 500,
    }),

  /** An invalid-request error: status `400` (not retryable). */
  badRequest: (options: ApiErrorOptions = {}): APICallError =>
    Errors.from({
      message: options.message ?? 'Bad request',
      statusCode: 400,
    }),

  /** An authentication error: status `401` (not retryable), e.g. a missing or invalid API key. */
  unauthorized: (options: ApiErrorOptions = {}): APICallError =>
    Errors.from({
      message: options.message ?? 'Unauthorized',
      statusCode: 401,
    }),

  /** A timeout: the `TimeoutError` `DOMException` that `AbortSignal.timeout()` produces when it fires. */
  timeout: (options: ApiErrorOptions = {}): DOMException =>
    new DOMException(options.message ?? 'The operation timed out', 'TimeoutError'),

  /** A manual abort: the `AbortError` `DOMException` that `controller.abort()` produces. */
  abort: (options: ApiErrorOptions = {}): DOMException =>
    new DOMException(options.message ?? 'The user aborted a request.', 'AbortError'),
};
