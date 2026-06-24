import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { fn, type Mock } from '@vitest/spy';
import { defaultProvider, nextModelId } from '../internal/identity.js';
import { Language } from './language.js';
import type { StreamDelayOptions } from '../streams.js';

/** A (possibly partial) non-streaming result; only `content` is required, the rest defaults. */
type GenerateResultInput = Omit<Partial<LanguageModelV3GenerateResult>, 'finishReason'> & {
  content: Array<LanguageModelV3Content>;
  /** The finish reason, as a full object or a bare unified value (e.g. `'length'`). */
  finishReason?: LanguageModelV3FinishReason | LanguageModelV3FinishReason['unified'];
  /** Token usage; defaults to a small stable value. */
  usage?: LanguageModelV3Usage;
};

/**
 * How to respond to a `doGenerate` call. A function receives the call options and returns the generate
 * result directly — the escape hatch for input-dependent responses.
 */
export type GenerateResponse = string | Error | GenerateResultInput | LanguageModelV3['doGenerate'];

/**
 * How to respond to a `doStream` call. A bare array (or `ReadableStream`) streams without delay; the
 * `{ chunks, ... }` form adds delays and abort handling. A function receives the call options and
 * returns the stream result directly — the escape hatch for input-dependent streams or a fully custom
 * `LanguageModelV3StreamResult` (e.g. one carrying response metadata).
 */
export type StreamResponse =
  | string
  | Error
  | Array<LanguageModelV3StreamPart>
  | ReadableStream<LanguageModelV3StreamPart>
  | ({ chunks: Array<LanguageModelV3StreamPart> } & StreamDelayOptions)
  | LanguageModelV3['doStream'];

/**
 * A single mock response. A `string` or `Error` applies to whichever method is called;
 * the object forms target one method explicitly.
 *
 * Note: `string` and `{ content }` describe the output for both methods — when streamed, a stream is
 * derived from the content. To sequence responses across calls, pass an `Array<MockResponse>` at the
 * top level. Because of that, a raw stream is expressed via the `doStream` form (`{ doStream: [...] }`),
 * never a bare array. The `doGenerate` / `doStream` keys mirror the `LanguageModelV3` method names.
 */
export type MockResponse =
  | string
  | Error
  | GenerateResultInput
  | { doGenerate?: GenerateResponse; doStream?: StreamResponse };

/** Optional identity overrides for a mock model. */
export type MockLanguageModelOptions = {
  /** The provider id; defaults to `mock-provider`. */
  provider?: string;
  /** The model id; defaults to an auto-incrementing `mock-model-{n}`. */
  modelId?: string;
};

/** Throws a clear error when a method is called but no matching response was configured. */
const notImplemented = (method: 'doGenerate' | 'doStream'): never => {
  throw new Error(`MockLanguageModel.${method} was called but no matching response was provided.`);
};

/** Narrows a response to the explicit `{ doGenerate, doStream }` form. */
const isExplicit = (response: MockResponse): response is { doGenerate?: GenerateResponse; doStream?: StreamResponse } =>
  typeof response === 'object' &&
  response !== null &&
  !(response instanceof Error) &&
  ('doGenerate' in response || 'doStream' in response);

/** Resolves the `doGenerate` form of an explicit response into a generate result. */
const resolveGenerateResponse = async (
  response: GenerateResponse,
  options: LanguageModelV3CallOptions,
): Promise<LanguageModelV3GenerateResult> => {
  if (typeof response === 'string') return Language.result(response);
  if (response instanceof Error) throw response;
  if (typeof response === 'function') return response(options);
  const { content, ...rest } = response;
  return Language.result(content, rest);
};

/** Resolves the `doStream` form of an explicit response into a stream result. */
const resolveStreamResponse = async (
  response: StreamResponse,
  options: LanguageModelV3CallOptions,
): Promise<LanguageModelV3StreamResult> => {
  const { abortSignal } = options;
  if (typeof response === 'string') return Language.streamResult(response, { abortSignal });
  if (response instanceof Error) throw response;
  if (Array.isArray(response)) return Language.streamResult(response, { abortSignal });
  if (response instanceof ReadableStream) return Language.streamResult(response);
  if (typeof response === 'function') return response(options);
  return Language.streamResult(response.chunks, {
    initialDelayInMs: response.initialDelayInMs,
    chunkDelayInMs: response.chunkDelayInMs,
    abortSignal: response.abortSignal ?? abortSignal,
  });
};

/** Resolves a top-level response for a `doGenerate` call. */
const resolveGenerate = async (
  response: MockResponse,
  options: LanguageModelV3CallOptions,
): Promise<LanguageModelV3GenerateResult> => {
  if (typeof response === 'string') return Language.result(response);
  if (response instanceof Error) throw response;
  if (isExplicit(response)) {
    return response.doGenerate === undefined
      ? notImplemented('doGenerate')
      : resolveGenerateResponse(response.doGenerate, options);
  }
  if ('content' in response) {
    const { content, ...rest } = response;
    return Language.result(content, rest);
  }
  return notImplemented('doGenerate');
};

/** Resolves a top-level response for a `doStream` call. */
const resolveStream = async (
  response: MockResponse,
  options: LanguageModelV3CallOptions,
): Promise<LanguageModelV3StreamResult> => {
  const { abortSignal } = options;
  if (typeof response === 'string') return Language.streamResult(response, { abortSignal });
  if (response instanceof Error) throw response;
  if (isExplicit(response)) {
    return response.doStream === undefined
      ? notImplemented('doStream')
      : resolveStreamResponse(response.doStream, options);
  }
  if ('content' in response) {
    return Language.streamResult(
      Language.streamParts(response.content, { finishReason: response.finishReason, usage: response.usage }),
      { abortSignal },
    );
  }
  return notImplemented('doStream');
};

/** Picks the response for the current call: a single response repeats, an array advances and clamps. */
const pickResponse = (input: MockResponse | Array<MockResponse>, callIndex: number): MockResponse => {
  if (!Array.isArray(input)) return input;
  if (input.length === 0) return {};
  return input[Math.min(callIndex, input.length - 1)] ?? {};
};

/**
 * A `LanguageModelV3` mock whose `doGenerate`/`doStream` are spy functions. Every call is recorded on
 * `doGenerate.mock.calls` / `doStream.mock.calls` (the spies are vitest-compatible, so the full Vitest
 * spy API and matchers work, but the call record can also be read without the Vitest runner). Instances
 * are created via the {@link MockLanguageModel} factory.
 */
class LanguageModelMock implements LanguageModelV3 {
  /** The language model spec version this mock implements. */
  readonly specificationVersion = 'v3';
  /** URL patterns the model supports — none, for a mock. */
  readonly supportedUrls: LanguageModelV3['supportedUrls'] = {};
  /** The provider id. */
  readonly provider: string;
  /** The model id. */
  readonly modelId: string;

  /** Spy implementing `doGenerate`, resolving the configured response. Call args live on `.mock.calls`. */
  doGenerate: Mock<LanguageModelV3['doGenerate']>;
  /** Spy implementing `doStream`, resolving the configured response. Call args live on `.mock.calls`. */
  doStream: Mock<LanguageModelV3['doStream']>;

  /** Builds the spies and identity from the configured response(s) and options. */
  constructor(input: MockResponse | Array<MockResponse> = {}, options: MockLanguageModelOptions = {}) {
    this.provider = options.provider ?? defaultProvider;
    this.modelId = options.modelId ?? nextModelId();

    this.doGenerate = fn(async (callOptions: LanguageModelV3CallOptions) => {
      const response = pickResponse(input, this.doGenerate.mock.calls.length - 1);
      return resolveGenerate(response, callOptions);
    });

    this.doStream = fn(async (callOptions: LanguageModelV3CallOptions) => {
      const response = pickResponse(input, this.doStream.mock.calls.length - 1);
      return resolveStream(response, callOptions);
    });
  }
}

/** Creates a mock `LanguageModelV3` from a response spec (or sequence of them). */
const from = (input?: MockResponse | Array<MockResponse>, options?: MockLanguageModelOptions): LanguageModelMock =>
  new LanguageModelMock(input, options);

/** Builds a minimal valid `LanguageModelV3CallOptions`, for invoking `doGenerate` / `doStream` directly. */
const callOptions = (overrides: Partial<LanguageModelV3CallOptions> = {}): LanguageModelV3CallOptions => ({
  prompt: [{ role: 'user', content: [{ type: 'text', text: 'Hello!' }] }],
  ...overrides,
});

/**
 * Factory for mock language models. `from` creates a mock `LanguageModelV3`; `callOptions` builds a valid
 * options object for calling its methods directly. Build the values a model returns with {@link Language}.
 * Exported as both a value (the factory) and a type (the model instance).
 *
 * @example
 * const model = MockLanguageModel.from('Hello, world!');
 * const flaky = MockLanguageModel.from([new Error('rate limited'), 'recovered']);
 * const built = MockLanguageModel.from({ content: [Language.text('Hi')] });
 */
export const MockLanguageModel = { from, callOptions };

/** A mock language model instance, as returned by {@link MockLanguageModel.from}. */
export type MockLanguageModel = LanguageModelMock;
