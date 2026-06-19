import type { ImageModelV3, ImageModelV3CallOptions } from '@ai-sdk/provider';
import { type Mock, vi } from 'vitest';
import { defaultProvider, nextModelId } from '../internal/identity.js';
import { type GeneratedImages, Image } from './image.js';

export type { GeneratedImages };

/** The result a `doGenerate` call resolves to, derived from the spec. */
type ImageGenerateResult = Awaited<ReturnType<ImageModelV3['doGenerate']>>;

/** A (possibly partial) generate result; only `images` is required, the rest defaults. */
type ImageResultInput = Partial<ImageGenerateResult> & { images: GeneratedImages };

/**
 * How to respond to a `doGenerate` call. A bare `images` array is the common case (just the images,
 * with default response metadata). A function receives the call options and returns the result
 * directly — the escape hatch for input-dependent responses.
 */
export type ImageResponse = GeneratedImages | Error | ImageResultInput | ImageModelV3['doGenerate'];

/** Optional identity overrides for a mock image model. */
export type MockImageModelOptions = {
  /** The provider id; defaults to `mock-provider`. */
  provider?: string;
  /** The model id; defaults to an auto-incrementing `mock-model-{n}`. */
  modelId?: string;
  /** The max images per call; defaults to `1`. */
  maxImagesPerCall?: number;
};

/** Throws a clear error when `doGenerate` is called but no matching response was configured. */
const notImplemented = (): never => {
  throw new Error(`MockImageModel.doGenerate was called but no matching response was provided.`);
};

/**
 * Whether a value is a single images array (`string[]` / `Uint8Array[]`) rather than a sequence of
 * responses. A sequence of pure-image responses holds arrays (not bare strings), and a mixed sequence
 * holds non-string members, so both are correctly classified as sequences.
 */
const isImagesArray = (value: unknown): value is GeneratedImages =>
  Array.isArray(value) && value.every((image) => typeof image === 'string' || image instanceof Uint8Array);

/** Resolves a single response into a generate result; `undefined` means no response was configured. */
const resolveGenerate = async (
  response: ImageResponse | undefined,
  options: ImageModelV3CallOptions,
  modelId: string,
): Promise<ImageGenerateResult> => {
  if (response === undefined) return notImplemented();
  if (response instanceof Error) throw response;
  if (typeof response === 'function') return response(options);
  if (Array.isArray(response)) return Image.result(response, { response: { modelId } });
  const { images, ...rest } = response;
  return Image.result(images, { ...rest, response: { modelId, ...rest.response } });
};

/** Picks the response for the current call: a single response repeats, a sequence advances and clamps. */
const pickResponse = (
  input: ImageResponse | Array<ImageResponse> | undefined,
  callIndex: number,
): ImageResponse | undefined => {
  if (Array.isArray(input) && !isImagesArray(input)) {
    return input[Math.min(callIndex, input.length - 1)];
  }
  return input;
};

/**
 * An `ImageModelV3` mock whose `doGenerate` is a `vi.fn()` spy. Each call is also recorded on
 * `doGenerateCalls` so call arguments can be inspected without vitest. Created via {@link MockImageModel.from}.
 */
class ImageModelMock implements ImageModelV3 {
  /** The image model spec version this mock implements. */
  readonly specificationVersion = 'v3';
  /** The provider id. */
  readonly provider: string;
  /** The model id. */
  readonly modelId: string;
  /** The max images per call. */
  readonly maxImagesPerCall: number;

  /** Spy implementing `doGenerate`, resolving the configured response. */
  doGenerate: Mock<ImageModelV3['doGenerate']>;
  /** Call options captured for every `doGenerate` invocation, in order. */
  doGenerateCalls: Array<ImageModelV3CallOptions> = [];

  /** Builds the spy and identity from the configured response(s) and options. */
  constructor(input?: ImageResponse | Array<ImageResponse>, options: MockImageModelOptions = {}) {
    this.provider = options.provider ?? defaultProvider;
    this.modelId = options.modelId ?? nextModelId();
    this.maxImagesPerCall = options.maxImagesPerCall ?? 1;

    this.doGenerate = vi.fn(async (callOptions: ImageModelV3CallOptions) => {
      const response = pickResponse(input, this.doGenerateCalls.length);
      this.doGenerateCalls.push(callOptions);
      return resolveGenerate(response, callOptions, this.modelId);
    });
  }
}

/** Creates a mock `ImageModelV3` from a response spec (or sequence of them). */
const from = (input?: ImageResponse | Array<ImageResponse>, options?: MockImageModelOptions): ImageModelMock =>
  new ImageModelMock(input, options);

/** Builds a minimal valid `ImageModelV3CallOptions`, for invoking `doGenerate` directly. */
const callOptions = (overrides: Partial<ImageModelV3CallOptions> = {}): ImageModelV3CallOptions => ({
  prompt: 'A test image',
  n: 1,
  size: undefined,
  aspectRatio: undefined,
  seed: undefined,
  files: undefined,
  mask: undefined,
  providerOptions: {},
  ...overrides,
});

/**
 * Factory for mock image models. `from` creates a mock `ImageModelV3`; `callOptions` builds a valid options
 * object for calling it directly. Build the values a model returns with {@link Image}. Exported as both a
 * value (the factory) and a type (the model instance).
 *
 * @example
 * const model = MockImageModel.from([Image.png()]);
 * const flaky = MockImageModel.from([new Error('rate limited'), [Image.png()]]);
 */
export const MockImageModel = { from, callOptions };

/** A mock image model instance, as returned by {@link MockImageModel.from}. */
export type MockImageModel = ImageModelMock;
