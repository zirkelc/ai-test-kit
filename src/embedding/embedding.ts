import type { EmbeddingModelV3Embedding, EmbeddingModelV3Result } from '@ai-sdk/provider';

/** A single embedding vector, in the same order as the embedded input values. */
export type EmbeddingVector = EmbeddingModelV3Embedding;

/** Result overrides accepted by `result`, beyond the embeddings themselves. */
type EmbedResultOverrides = Omit<Partial<EmbeddingModelV3Result>, 'embeddings'>;

/** Small, stable token usage used when none is supplied. */
const defaultUsage: EmbeddingModelV3Result['usage'] = { tokens: 0 };

/** A sample embedding vector of the given dimension, e.g. `[0.1, 0.2, 0.3]` for the default of `3`. */
const vector = (dimension = 3): EmbeddingVector => Array.from({ length: dimension }, (_, index) => (index + 1) / 10);

/** Builds an embedding usage object from a token count. */
const usage = (tokens = 0): EmbeddingModelV3Result['usage'] => ({ tokens });

/** Builds a full embed result from a set of vectors, filling default usage and warnings. */
const result = (embeddings: Array<EmbeddingVector>, overrides: EmbedResultOverrides = {}): EmbeddingModelV3Result => ({
  usage: defaultUsage,
  warnings: [],
  embeddings,
  ...overrides,
});

/**
 * Builders for the values an embedding model returns: sample `vector`s, the `result` wrapper, and `usage`.
 * Pairs with {@link MockEmbeddingModel}.
 */
export const Embedding = { vector, usage, result };
