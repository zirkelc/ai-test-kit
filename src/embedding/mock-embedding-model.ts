import type { EmbeddingModelV4, EmbeddingModelV4CallOptions, EmbeddingModelV4Result } from '@ai-sdk/provider';
import { fn, type Mock } from '@vitest/spy';
import { type CallDelayOptions, delayOrAbort, type ErrorInput, isErrorInput } from '../internal/delay.js';
import { defaultProvider, nextModelId } from '../internal/identity.js';
import { Embedding, type EmbeddingVector } from './embedding.js';

export type { EmbeddingVector };

/**
 * A (possibly partial) embed result; only `embeddings` is required, the rest defaults. `delayInMs` makes
 * the call take that long to resolve.
 */
type EmbedResultInput = Partial<EmbeddingModelV4Result> & CallDelayOptions & { embeddings: Array<EmbeddingVector> };

/**
 * How to respond to a `doEmbed` call. A bare `Array<EmbeddingVector>` is the common case (just the
 * embeddings, with default usage). The `{ embeddings, ... }` and `{ error, ... }` forms take a
 * `delayInMs` to simulate a slow answer or a slow failure, aborting mid-delay when the call's
 * `abortSignal` fires. A function receives the call options and returns the result directly — the
 * escape hatch for input-dependent responses.
 */
export type EmbedResponse =
  | Array<EmbeddingVector>
  | Error
  | EmbedResultInput
  | ErrorInput
  | EmbeddingModelV4['doEmbed'];

/** Optional identity overrides for a mock embedding model. */
export type MockEmbeddingModelOptions = {
  /** The provider id; defaults to `mock-provider`. */
  provider?: string;
  /** The model id; defaults to an auto-incrementing `mock-model-{n}`. */
  modelId?: string;
  /** The max embeddings per call; defaults to `1`. */
  maxEmbeddingsPerCall?: number;
  /** Whether parallel calls are supported; defaults to `true`. */
  supportsParallelCalls?: boolean;
};

/** Throws a clear error when `doEmbed` is called but no matching response was configured. */
const notImplemented = (): never => {
  throw new Error(`MockEmbeddingModel.doEmbed was called but no matching response was provided.`);
};

/**
 * Whether a value is a single embeddings matrix (`number[][]`) rather than a sequence of responses.
 * A sequence of pure-embedding responses is one level deeper (`number[][][]`), and a mixed sequence
 * holds non-array members, so both are correctly classified as sequences.
 */
const isEmbeddingsMatrix = (value: unknown): value is Array<EmbeddingVector> =>
  Array.isArray(value) && value.every((vector) => Array.isArray(vector) && vector.every((n) => typeof n === 'number'));

/** Resolves a single response into an embed result; `undefined` means no response was configured. */
const resolveEmbed = async (
  response: EmbedResponse | undefined,
  options: EmbeddingModelV4CallOptions,
): Promise<EmbeddingModelV4Result> => {
  if (response === undefined) return notImplemented();
  if (response instanceof Error) throw response;
  if (typeof response === 'function') return response(options);
  if (Array.isArray(response)) return Embedding.result(response);
  if (isErrorInput(response)) {
    await delayOrAbort(response.delayInMs, options.abortSignal);
    throw response.error;
  }
  const { embeddings, delayInMs, ...rest } = response;
  await delayOrAbort(delayInMs, options.abortSignal);
  return Embedding.result(embeddings, rest);
};

/** Picks the response for the current call: a single response repeats, a sequence advances and clamps. */
const pickResponse = (
  input: EmbedResponse | Array<EmbedResponse> | undefined,
  callIndex: number,
): EmbedResponse | undefined => {
  if (Array.isArray(input) && !isEmbeddingsMatrix(input)) {
    return input[Math.min(callIndex, input.length - 1)];
  }
  return input;
};

/**
 * An `EmbeddingModelV4` mock whose `doEmbed` is a spy function. Every call is recorded on
 * `doEmbed.mock.calls` (the spy is vitest-compatible, so the full Vitest spy API and matchers work, but
 * the call record can also be read without the Vitest runner). Created via {@link MockEmbeddingModel.from}.
 */
class EmbeddingModelMock implements EmbeddingModelV4 {
  /** The embedding model spec version this mock implements. */
  readonly specificationVersion = 'v4';
  /** The provider id. */
  readonly provider: string;
  /** The model id. */
  readonly modelId: string;
  /** The max embeddings per call. */
  readonly maxEmbeddingsPerCall: number;
  /** Whether the model supports parallel calls. */
  readonly supportsParallelCalls: boolean;

  /** Spy implementing `doEmbed`, resolving the configured response. Call args live on `.mock.calls`. */
  doEmbed: Mock<EmbeddingModelV4['doEmbed']>;

  /** Builds the spy and identity from the configured response(s) and options. */
  constructor(input?: EmbedResponse | Array<EmbedResponse>, options: MockEmbeddingModelOptions = {}) {
    this.provider = options.provider ?? defaultProvider;
    this.modelId = options.modelId ?? nextModelId();
    this.maxEmbeddingsPerCall = options.maxEmbeddingsPerCall ?? 1;
    this.supportsParallelCalls = options.supportsParallelCalls ?? true;

    this.doEmbed = fn(async (callOptions: EmbeddingModelV4CallOptions) => {
      const response = pickResponse(input, this.doEmbed.mock.calls.length - 1);
      return resolveEmbed(response, callOptions);
    });
  }
}

/** Creates a mock `EmbeddingModelV4` from a response spec (or sequence of them). */
const from = (input?: EmbedResponse | Array<EmbedResponse>, options?: MockEmbeddingModelOptions): EmbeddingModelMock =>
  new EmbeddingModelMock(input, options);

/** Builds a minimal valid `EmbeddingModelV4CallOptions`, for invoking `doEmbed` directly. */
const callOptions = (overrides: Partial<EmbeddingModelV4CallOptions> = {}): EmbeddingModelV4CallOptions => ({
  values: ['hello'],
  ...overrides,
});

/**
 * Factory for mock embedding models. `from` creates a mock `EmbeddingModelV4`; `callOptions` builds a valid
 * options object for calling it directly. Build the values a model returns with {@link Embedding}. Exported
 * as both a value (the factory) and a type (the model instance).
 *
 * @example
 * const model = MockEmbeddingModel.from([[0.1, 0.2, 0.3]]);
 * const flaky = MockEmbeddingModel.from([new Error('rate limited'), [[0.1, 0.2, 0.3]]]);
 */
export const MockEmbeddingModel = { from, callOptions };

/** A mock embedding model instance, as returned by {@link MockEmbeddingModel.from}. */
export type MockEmbeddingModel = EmbeddingModelMock;
