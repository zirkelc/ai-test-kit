import type { LanguageModelV3Content, LanguageModelV3FinishReason, LanguageModelV3Usage } from '@ai-sdk/provider';

/** Standard "stop" finish reason used when none is supplied. */
export const defaultFinishReason: LanguageModelV3FinishReason = {
  unified: 'stop',
  raw: 'stop',
};

/**
 * Derives a finish reason from content, mirroring how a provider reports one when none is given
 * explicitly: a pending client tool call hands control back to the caller, so the reason is
 * `tool-calls`. A tool call is not pending if the provider executed it, or if a result for it is
 * already present in the same content (covering hand-built content that resolves a call inline).
 */
export const finishReasonFromContent = (content: Array<LanguageModelV3Content>): LanguageModelV3FinishReason => {
  const resolved = new Set(content.filter((part) => part.type === 'tool-result').map((part) => part.toolCallId));
  const hasPendingToolCall = content.some(
    (part) => part.type === 'tool-call' && !part.providerExecuted && !resolved.has(part.toolCallId),
  );
  return hasPendingToolCall ? { unified: 'tool-calls', raw: 'tool-calls' } : defaultFinishReason;
};

/** Small, stable token usage used when none is supplied. */
export const defaultUsage: LanguageModelV3Usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};

/** Normalizes a finish reason: a bare unified value becomes `{ unified, raw }`; an object passes through. */
export const toFinishReason = (
  reason: LanguageModelV3FinishReason | LanguageModelV3FinishReason['unified'],
): LanguageModelV3FinishReason => (typeof reason === 'string' ? { unified: reason, raw: reason } : reason);
