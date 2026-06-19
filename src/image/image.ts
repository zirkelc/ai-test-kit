import type { ImageModelV3, ImageModelV3Usage } from '@ai-sdk/provider';

/** The result a `doGenerate` call resolves to, derived from the spec. */
type ImageGenerateResult = Awaited<ReturnType<ImageModelV3['doGenerate']>>;

/** The generated images: base64 strings or binary data, returned without conversion. */
export type GeneratedImages = ImageGenerateResult['images'];

/** Result overrides accepted by `result`, beyond the images themselves (`response` may be partial). */
type ImageResultOverrides = Omit<Partial<ImageGenerateResult>, 'images' | 'response'> & {
  response?: Partial<ImageGenerateResult['response']>;
};

/** A valid base64-encoded 1x1 transparent PNG, handy as a stand-in generated image. */
export const validBase64Image =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** A sample generated image. Currently the 1x1 PNG regardless of arguments (sized output is not yet supported). */
const png = (): string => validBase64Image;

/** Builds an image usage object from token counts (`totalTokens` defaults to the sum). */
const usage = (inputTokens = 0, outputTokens = 0): ImageModelV3Usage => ({
  inputTokens,
  outputTokens,
  totalTokens: inputTokens + outputTokens,
});

/** Builds a full generate result from images, filling default warnings and a deterministic `response`. */
const result = (images: GeneratedImages, overrides: ImageResultOverrides = {}): ImageGenerateResult => ({
  warnings: [],
  images,
  ...overrides,
  response: { timestamp: new Date(0), modelId: 'mock-model', headers: undefined, ...overrides.response },
});

/**
 * Builders for the values an image model returns: sample `png` images, the `result` wrapper, and `usage`.
 * Pairs with {@link MockImageModel}.
 */
export const Image = { png, usage, result };
