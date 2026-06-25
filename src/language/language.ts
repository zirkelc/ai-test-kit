import type {
  LanguageModelV4Content,
  LanguageModelV4File,
  LanguageModelV4FinishReason,
  LanguageModelV4GenerateResult,
  LanguageModelV4Reasoning,
  LanguageModelV4Source,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
  LanguageModelV4Text,
  LanguageModelV4ToolCall,
  LanguageModelV4ToolResult,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import { defaultFinishReason, defaultUsage, toFinishReason } from '../internal/defaults.js';
import { toJSONString } from '../internal/json.js';
import { tokenize } from '../internal/tokenize.js';
import { simulateStream, type StreamDelayOptions } from '../streams.js';

/** Options for the streamed-text builders: a stable part `id` plus a tokenization strategy. */
export type StreamPartOptions = {
  /** Stable id shared by the start/delta/end parts. */
  id?: string;
  /** Split the text into fixed-size slices of at most this many characters. */
  length?: number;
  /** Split the text on this delimiter, re-appending it to each token. */
  separator?: string;
};

/** The `warnings` array carried by a `stream-start` part. */
type StreamStartWarnings = Extract<LanguageModelV4StreamPart, { type: 'stream-start' }>['warnings'];
/** The fields of a `response-metadata` part, without its `type` tag. */
type ResponseMetadata = Omit<Extract<LanguageModelV4StreamPart, { type: 'response-metadata' }>, 'type'>;
/** The passthrough fields of a `finish` part (e.g. `providerMetadata`), beyond `finishReason` and `usage`. */
type FinishExtras = Omit<Extract<LanguageModelV4StreamPart, { type: 'finish' }>, 'type' | 'finishReason' | 'usage'>;

/** A bare unified finish reason (e.g. `'length'`) or the full object. */
type FinishReasonInput = LanguageModelV4FinishReason | LanguageModelV4FinishReason['unified'];

/** Per-field token overrides accepted by the object form of `usage`. */
type UsageOverrides = {
  inputTokens?: Partial<LanguageModelV4Usage['inputTokens']>;
  outputTokens?: Partial<LanguageModelV4Usage['outputTokens']>;
};

/** Options for `result`: everything defaults, and extra fields (e.g. `providerMetadata`) pass through. */
export type ResultOptions = Omit<Partial<LanguageModelV4GenerateResult>, 'content' | 'finishReason' | 'usage'> & {
  /** The finish reason, as a full object or a bare unified value (e.g. `'length'`). */
  finishReason?: FinishReasonInput;
  /** Token usage; defaults to a small stable value. */
  usage?: LanguageModelV4Usage;
};

/** Builds a usage object from numeric totals, mirroring each into its primary sub-field. */
function usage(overrides?: UsageOverrides): LanguageModelV4Usage;
function usage(inputTotal: number, outputTotal?: number): LanguageModelV4Usage;
function usage(inputOrOverrides: number | UsageOverrides = {}, outputTotal = 0): LanguageModelV4Usage {
  if (typeof inputOrOverrides === 'number') {
    return {
      inputTokens: { total: inputOrOverrides, noCache: inputOrOverrides, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: outputTotal, text: outputTotal, reasoning: 0 },
    };
  }
  return {
    inputTokens: { ...defaultUsage.inputTokens, ...inputOrOverrides.inputTokens },
    outputTokens: { ...defaultUsage.outputTokens, ...inputOrOverrides.outputTokens },
  };
}

/** A text content part. */
const text = (text: string): LanguageModelV4Text => ({ type: 'text', text });

/** A reasoning content part. */
const reasoning = (text: string): LanguageModelV4Reasoning => ({ type: 'reasoning', text });

/** A tool call. `input` is stringified to JSON unless already a string. Valid in both content and streams. */
const toolCall = (args: { toolCallId: string; toolName: string; input: unknown }): LanguageModelV4ToolCall => ({
  type: 'tool-call',
  toolCallId: args.toolCallId,
  toolName: args.toolName,
  input: toJSONString(args.input),
});

/** A tool result. Valid in both content and streams. */
const toolResult = (args: {
  toolCallId: string;
  toolName: string;
  result: LanguageModelV4ToolResult['result'];
  isError?: boolean;
}): LanguageModelV4ToolResult => ({
  type: 'tool-result',
  toolCallId: args.toolCallId,
  toolName: args.toolName,
  result: args.result,
  ...(args.isError !== undefined ? { isError: args.isError } : {}),
});

/** A file part. Valid in both content and streams. */
const file = (args: { mediaType: string; data: string | Uint8Array }): LanguageModelV4File => ({
  type: 'file',
  mediaType: args.mediaType,
  data: { type: 'data', data: args.data },
});

/** A URL source part. Valid in both content and streams. */
const source = (args: { id: string; url: string; title?: string }): LanguageModelV4Source => ({
  type: 'source',
  sourceType: 'url',
  id: args.id,
  url: args.url,
  ...(args.title !== undefined ? { title: args.title } : {}),
});

/** Maps a `string` (tokenized) or `string[]` (verbatim) to the deltas of a streamed block. */
const toDeltas = (text: string | Array<string>, length?: number, separator?: string): Array<string> =>
  Array.isArray(text) ? text : tokenize(text, { length, separator });

/**
 * A streamed text block: `text-start` → `text-delta`* → `text-end`. A `string` is split per
 * `length`/`separator`; an `Array<string>` is used as the deltas verbatim.
 */
const streamText = (
  text: string | Array<string>,
  { id = '1', length, separator }: StreamPartOptions = {},
): Array<LanguageModelV4StreamPart> => [
  { type: 'text-start', id },
  ...toDeltas(text, length, separator).map((delta) => ({ type: 'text-delta' as const, id, delta })),
  { type: 'text-end', id },
];

/** A streamed reasoning block: `reasoning-start` → `reasoning-delta`* → `reasoning-end`. */
const streamReasoning = (
  text: string | Array<string>,
  { id = '1', length, separator }: StreamPartOptions = {},
): Array<LanguageModelV4StreamPart> => [
  { type: 'reasoning-start', id },
  ...toDeltas(text, length, separator).map((delta) => ({ type: 'reasoning-delta' as const, id, delta })),
  { type: 'reasoning-end', id },
];

/** A streamed tool input: `tool-input-start` → `tool-input-delta`* → `tool-input-end`. */
const streamToolInput = (args: {
  id: string;
  toolName: string;
  input: unknown;
  length?: number;
}): Array<LanguageModelV4StreamPart> => [
  { type: 'tool-input-start', id: args.id, toolName: args.toolName },
  ...tokenize(toJSONString(args.input), { length: args.length }).map((delta) => ({
    type: 'tool-input-delta' as const,
    id: args.id,
    delta,
  })),
  { type: 'tool-input-end', id: args.id },
];

/** The opening `stream-start` part carrying call warnings. */
const streamStart = (warnings: StreamStartWarnings = []): LanguageModelV4StreamPart => ({
  type: 'stream-start',
  warnings,
});

/**
 * The terminal `finish` part with usage and finish reason. The finish reason may be a unified string;
 * extra fields (e.g. `providerMetadata`) pass through onto the part.
 */
const streamFinish = (opts: FinishOptions = {}): LanguageModelV4StreamPart => {
  const { finishReason, usage, ...rest } = opts;
  return {
    type: 'finish',
    finishReason: toFinishReason(finishReason ?? defaultFinishReason),
    usage: usage ?? defaultUsage,
    ...rest,
  };
};

/** An error part, mirroring a provider failing mid-stream. */
const streamError = (error: unknown): LanguageModelV4StreamPart => ({ type: 'error', error });

/** Provider response metadata (id, timestamp, modelId, …). */
const streamResponseMetadata = (meta: ResponseMetadata = {}): LanguageModelV4StreamPart => ({
  type: 'response-metadata',
  ...meta,
});

/** A raw passthrough part. */
const streamRaw = (rawValue: unknown): LanguageModelV4StreamPart => ({ type: 'raw', rawValue });

/** Expands a single content part into the stream parts that represent it. */
const partToStreamParts = (part: LanguageModelV4Content, id: string): Array<LanguageModelV4StreamPart> => {
  if (part.type === 'text') return streamText(part.text, { id });
  if (part.type === 'reasoning') return streamReasoning(part.text, { id });
  return [part];
};

/** Options for a terminal `finish` part: finish reason, token usage, and any passthrough fields. */
type FinishOptions = FinishExtras & { finishReason?: FinishReasonInput; usage?: LanguageModelV4Usage };

/** Input to `streamParts`: a `string` (one text part) or explicit content. */
type StreamPartsInput = string | Array<LanguageModelV4Content>;

/**
 * Builds the full stream-parts array for a response: `stream-start` → one block per content part → `finish`.
 * A `string` becomes one text part. The array-returning sibling of `result`: splice it, snapshot it, feed it
 * to a `doStream` mock, or wrap it with `streamResult`.
 */
const streamParts = (input: StreamPartsInput, opts: FinishOptions = {}): Array<LanguageModelV4StreamPart> => {
  const content = typeof input === 'string' ? [text(input)] : input;
  return [
    streamStart(),
    ...content.flatMap((part, index) => partToStreamParts(part, String(index))),
    streamFinish(opts),
  ];
};

/** Builds a full generate result from content (a string becomes one text part), filling defaults. */
const result = (
  input: string | Array<LanguageModelV4Content>,
  opts: ResultOptions = {},
): LanguageModelV4GenerateResult => {
  const { finishReason, usage, warnings, ...rest } = opts;
  return {
    content: typeof input === 'string' ? [text(input)] : input,
    finishReason: finishReason === undefined ? defaultFinishReason : toFinishReason(finishReason),
    usage: usage ?? defaultUsage,
    warnings: warnings ?? [],
    ...rest,
  };
};

/**
 * Builds a full stream result. A `string` is assembled into `stream-start` → text → `finish`; a
 * `ReadableStream` is wrapped as-is (delays ignored); an array of parts is simulated with optional delays.
 */
const streamResult = (
  input: string | Array<LanguageModelV4StreamPart> | ReadableStream<LanguageModelV4StreamPart>,
  opts: StreamDelayOptions = {},
): LanguageModelV4StreamResult => {
  if (input instanceof ReadableStream) return { stream: input };
  const parts = typeof input === 'string' ? streamParts(input) : input;
  return { stream: simulateStream(parts, opts) };
};

/**
 * Builders for everything a language model returns: static content parts (`text`, `toolCall`, …), streamed
 * parts (`streamText`, `streamFinish`, …), and the `result` / `streamResult` / `usage` wrappers. Pairs with
 * {@link MockLanguageModel}. The `stream`-prefixed members mirror the SDK's `generateText` / `streamText` split.
 */
export const Language = {
  text,
  reasoning,
  toolCall,
  toolResult,
  file,
  source,
  streamText,
  streamReasoning,
  streamToolInput,
  streamStart,
  streamFinish,
  streamError,
  streamResponseMetadata,
  streamRaw,
  usage,
  result,
  streamParts,
  streamResult,
};
