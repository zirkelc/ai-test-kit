import type {
  LanguageModelV3Content,
  LanguageModelV3File,
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3Reasoning,
  LanguageModelV3Source,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Text,
  LanguageModelV3ToolCall,
  LanguageModelV3ToolResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import type { InferToolInput, InferToolOutput, ToolSet } from 'ai';
import { defaultFinishReason, defaultUsage, finishReasonFromContent, toFinishReason } from '../internal/defaults.js';
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
type StreamStartWarnings = Extract<LanguageModelV3StreamPart, { type: 'stream-start' }>['warnings'];
/** The fields of a `response-metadata` part, without its `type` tag. */
type ResponseMetadata = Omit<Extract<LanguageModelV3StreamPart, { type: 'response-metadata' }>, 'type'>;
/** The passthrough fields of a `finish` part (e.g. `providerMetadata`), beyond `finishReason` and `usage`. */
type FinishExtras = Omit<Extract<LanguageModelV3StreamPart, { type: 'finish' }>, 'type' | 'finishReason' | 'usage'>;

/** A bare unified finish reason (e.g. `'length'`) or the full object. */
type FinishReasonInput = LanguageModelV3FinishReason | LanguageModelV3FinishReason['unified'];

/** Per-field token overrides accepted by the object form of `usage`. */
type UsageOverrides = {
  inputTokens?: Partial<LanguageModelV3Usage['inputTokens']>;
  outputTokens?: Partial<LanguageModelV3Usage['outputTokens']>;
};

/** Options for `result`: everything defaults, and extra fields (e.g. `providerMetadata`) pass through. */
export type ResultOptions = Omit<Partial<LanguageModelV3GenerateResult>, 'content' | 'finishReason' | 'usage'> & {
  /** The finish reason, as a full object or a bare unified value (e.g. `'length'`). */
  finishReason?: FinishReasonInput;
  /** Token usage; defaults to a small stable value. */
  usage?: LanguageModelV3Usage;
};

/** Builds a usage object from numeric totals, mirroring each into its primary sub-field. */
function usage(overrides?: UsageOverrides): LanguageModelV3Usage;
function usage(inputTotal: number, outputTotal?: number): LanguageModelV3Usage;
function usage(inputOrOverrides: number | UsageOverrides = {}, outputTotal = 0): LanguageModelV3Usage {
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
const text = (text: string): LanguageModelV3Text => ({ type: 'text', text });

/** A reasoning content part. */
const reasoning = (text: string): LanguageModelV3Reasoning => ({ type: 'reasoning', text });

/** The values of an object type, i.e. the union of its property types. */
type ValueOf<RECORD> = RECORD[keyof RECORD];

/**
 * Correlated args for a `toolCall`: passing a `TOOLS` tool-set turns this into a union with one
 * member per tool name, so choosing a `toolName` constrains `input` to that tool's input type.
 * Without a tool-set (`TOOLS = never`) it falls back to the loose, unconstrained shape.
 */
type ToolCallArgs<TOOLS extends ToolSet> = [TOOLS] extends [never]
  ? { toolCallId: string; toolName: string; input: unknown }
  : ValueOf<{
      [NAME in keyof TOOLS & string]: { toolCallId: string; toolName: NAME; input: InferToolInput<TOOLS[NAME]> };
    }>;

/** Correlated args for a `toolResult`: choosing a `toolName` constrains `result` to that tool's output type. */
type ToolResultArgs<TOOLS extends ToolSet> = [TOOLS] extends [never]
  ? { toolCallId: string; toolName: string; result: LanguageModelV3ToolResult['result']; isError?: boolean }
  : ValueOf<{
      [NAME in keyof TOOLS & string]: {
        toolCallId: string;
        toolName: NAME;
        result: InferToolOutput<TOOLS[NAME]>;
        isError?: boolean;
      };
    }>;

/** Correlated args for a `streamToolInput`: choosing a `toolName` constrains `input` to that tool's input type. */
type StreamToolInputArgs<TOOLS extends ToolSet> = [TOOLS] extends [never]
  ? { id: string; toolName: string; input: unknown; length?: number }
  : ValueOf<{
      [NAME in keyof TOOLS & string]: {
        id: string;
        toolName: NAME;
        input: InferToolInput<TOOLS[NAME]>;
        length?: number;
      };
    }>;

/**
 * A tool call. `input` is stringified to JSON unless already a string. Valid in both content and streams.
 * Pass a tool-set as `TOOLS` (e.g. `toolCall<typeof tools>(…)`) to constrain `toolName` and `input`.
 */
const toolCall = <TOOLS extends ToolSet = never>(args: ToolCallArgs<TOOLS>): LanguageModelV3ToolCall => ({
  type: 'tool-call',
  toolCallId: args.toolCallId,
  toolName: args.toolName,
  input: toJSONString(args.input),
});

/** A tool result. Valid in both content and streams. Pass a tool-set as `TOOLS` to constrain `toolName` and `result`. */
const toolResult = <TOOLS extends ToolSet = never>(args: ToolResultArgs<TOOLS>): LanguageModelV3ToolResult => ({
  type: 'tool-result',
  toolCallId: args.toolCallId,
  toolName: args.toolName,
  result: args.result,
  ...(args.isError !== undefined ? { isError: args.isError } : {}),
});

/** A file part. Valid in both content and streams. */
const file = (args: { mediaType: string; data: string | Uint8Array }): LanguageModelV3File => ({
  type: 'file',
  mediaType: args.mediaType,
  data: args.data,
});

/** A URL source part. Valid in both content and streams. */
const source = (args: { id: string; url: string; title?: string }): LanguageModelV3Source => ({
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
): Array<LanguageModelV3StreamPart> => [
  { type: 'text-start', id },
  ...toDeltas(text, length, separator).map((delta) => ({ type: 'text-delta' as const, id, delta })),
  { type: 'text-end', id },
];

/** A streamed reasoning block: `reasoning-start` → `reasoning-delta`* → `reasoning-end`. */
const streamReasoning = (
  text: string | Array<string>,
  { id = '1', length, separator }: StreamPartOptions = {},
): Array<LanguageModelV3StreamPart> => [
  { type: 'reasoning-start', id },
  ...toDeltas(text, length, separator).map((delta) => ({ type: 'reasoning-delta' as const, id, delta })),
  { type: 'reasoning-end', id },
];

/**
 * A streamed tool input: `tool-input-start` → `tool-input-delta`* → `tool-input-end`.
 * Pass a tool-set as `TOOLS` to constrain `toolName` and `input`.
 */
const streamToolInput = <TOOLS extends ToolSet = never>(
  args: StreamToolInputArgs<TOOLS>,
): Array<LanguageModelV3StreamPart> => [
  { type: 'tool-input-start', id: args.id, toolName: args.toolName },
  ...tokenize(toJSONString(args.input), { length: args.length }).map((delta) => ({
    type: 'tool-input-delta' as const,
    id: args.id,
    delta,
  })),
  { type: 'tool-input-end', id: args.id },
];

/** The opening `stream-start` part carrying call warnings. */
const streamStart = (warnings: StreamStartWarnings = []): LanguageModelV3StreamPart => ({
  type: 'stream-start',
  warnings,
});

/**
 * The terminal `finish` part with usage and finish reason. The finish reason may be a unified string;
 * extra fields (e.g. `providerMetadata`) pass through onto the part.
 */
const streamFinish = (opts: FinishOptions = {}): LanguageModelV3StreamPart => {
  const { finishReason, usage, ...rest } = opts;
  return {
    type: 'finish',
    finishReason: toFinishReason(finishReason ?? defaultFinishReason),
    usage: usage ?? defaultUsage,
    ...rest,
  };
};

/** An error part, mirroring a provider failing mid-stream. */
const streamError = (error: unknown): LanguageModelV3StreamPart => ({ type: 'error', error });

/** Provider response metadata (id, timestamp, modelId, …). */
const streamResponseMetadata = (meta: ResponseMetadata = {}): LanguageModelV3StreamPart => ({
  type: 'response-metadata',
  ...meta,
});

/** A raw passthrough part. */
const streamRaw = (rawValue: unknown): LanguageModelV3StreamPart => ({ type: 'raw', rawValue });

/** Expands a single content part into the stream parts that represent it. */
const partToStreamParts = (part: LanguageModelV3Content, id: string): Array<LanguageModelV3StreamPart> => {
  if (part.type === 'text') return streamText(part.text, { id });
  if (part.type === 'reasoning') return streamReasoning(part.text, { id });
  return [part];
};

/** Options for a terminal `finish` part: finish reason, token usage, and any passthrough fields. */
type FinishOptions = FinishExtras & { finishReason?: FinishReasonInput; usage?: LanguageModelV3Usage };

/** Input to `streamParts`: a `string` (one text part) or explicit content. */
type StreamPartsInput = string | Array<LanguageModelV3Content>;

/**
 * Builds the full stream-parts array for a response: `stream-start` → one block per content part → `finish`.
 * A `string` becomes one text part. The array-returning sibling of `result`: splice it, snapshot it, feed it
 * to a `doStream` mock, or wrap it with `streamResult`.
 */
const streamParts = (input: StreamPartsInput, opts: FinishOptions = {}): Array<LanguageModelV3StreamPart> => {
  const content = typeof input === 'string' ? [text(input)] : input;
  return [
    streamStart(),
    ...content.flatMap((part, index) => partToStreamParts(part, String(index))),
    streamFinish({ ...opts, finishReason: opts.finishReason ?? finishReasonFromContent(content) }),
  ];
};

/** Builds a full generate result from content (a string becomes one text part), filling defaults. */
const result = (
  input: string | Array<LanguageModelV3Content>,
  opts: ResultOptions = {},
): LanguageModelV3GenerateResult => {
  const { finishReason, usage, warnings, ...rest } = opts;
  const content = typeof input === 'string' ? [text(input)] : input;
  return {
    content,
    finishReason: finishReason === undefined ? finishReasonFromContent(content) : toFinishReason(finishReason),
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
  input: string | Array<LanguageModelV3StreamPart> | ReadableStream<LanguageModelV3StreamPart>,
  opts: StreamDelayOptions = {},
): LanguageModelV3StreamResult => {
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
