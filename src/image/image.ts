import type { ImageModelV4, ImageModelV4Usage } from '@ai-sdk/provider';

/** The result a `doGenerate` call resolves to, derived from the spec. */
type ImageGenerateResult = Awaited<ReturnType<ImageModelV4['doGenerate']>>;

/** The generated images: base64 strings or binary data, returned without conversion. */
export type GeneratedImages = ImageGenerateResult['images'];

/** Result overrides accepted by `result`, beyond the images themselves (`response` may be partial). */
type ImageResultOverrides = Omit<Partial<ImageGenerateResult>, 'images' | 'response'> & {
  response?: Partial<ImageGenerateResult['response']>;
};

/** A valid base64-encoded 1x1 transparent PNG, handy as a stand-in generated image. */
export const base64Png1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/** The image sizes `png` can produce. Only `'1x1'` is supported today; the type reserves room for more. */
export type ImageSize = '1x1';

/** Sample PNGs keyed by size; only the 1x1 transparent pixel exists today. */
const pngBySize: Record<ImageSize, string> = { '1x1': base64Png1x1 };

/** A sample generated image as a base64 PNG. Only the `'1x1'` size is currently supported. */
const png = (size: ImageSize = '1x1'): string => pngBySize[size];

/** Builds an image usage object from token counts (`totalTokens` defaults to the sum). */
const usage = (inputTokens = 0, outputTokens = 0): ImageModelV4Usage => ({
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
