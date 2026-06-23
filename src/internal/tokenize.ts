/** How to split a string into tokens for streaming. `separator` wins over `length`. */
type TokenizeStrategy = {
  /** Split into fixed-size slices of at most this many characters. */
  length?: number;
  /** Split on this delimiter, re-appending it to each token. */
  separator?: string;
};

/**
 * Splits text into tokens. Shared by every streamed-text builder so chunking behavior lives
 * in one place. With no strategy the whole string is a single token.
 */
export const tokenize = (text: string, { length, separator }: TokenizeStrategy = {}): Array<string> => {
  if (separator !== undefined) return text.split(separator).map((token) => token + separator);
  if (length !== undefined) return text.split(new RegExp(`(.{1,${length}})`)).filter((token) => token.length > 0);
  return [text];
};
