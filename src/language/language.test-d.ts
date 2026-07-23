import type { LanguageModelV4Content, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { jsonSchema, tool } from 'ai';
import { describe, expectTypeOf, test } from 'vitest';
import { Language } from './language.js';

/** A concrete tool-set used to drive the correlated-union inference in these tests. */
const tools = {
  weather: tool({
    inputSchema: jsonSchema<{ city: string }>({ type: 'object' }),
    outputSchema: jsonSchema<{ tempC: number }>({ type: 'object' }),
  }),
  search: tool({
    inputSchema: jsonSchema<{ query: string }>({ type: 'object' }),
    outputSchema: jsonSchema<{ hits: number }>({ type: 'object' }),
  }),
};

describe('Language.toolCall', () => {
  test('the loose builder should accept any name and input', () => {
    expectTypeOf(Language.toolCall).toBeCallableWith({ toolCallId: '1', toolName: 'anything', input: { x: 1 } });
  });

  test('the bound builder should correlate toolName to input', () => {
    expectTypeOf(Language.toolCall<typeof tools>).toBeCallableWith({
      toolCallId: '1',
      toolName: 'weather',
      input: { city: 'Tokyo' },
    });
  });

  test('the bound builder should reject an unknown tool name', () => {
    // @ts-expect-error 'unknown' is not a key of the tool-set
    Language.toolCall<typeof tools>({ toolCallId: '1', toolName: 'unknown', input: { city: 'Tokyo' } });
  });

  test('the bound builder should reject input that does not match the named tool', () => {
    // @ts-expect-error 'weather' expects `{ city: string }`, not `{ query: string }`
    Language.toolCall<typeof tools>({ toolCallId: '1', toolName: 'weather', input: { query: 'Tokyo' } });
  });
});

describe('Language.toolResult', () => {
  test('the bound builder should correlate toolName to result', () => {
    expectTypeOf(Language.toolResult<typeof tools>).toBeCallableWith({
      toolCallId: '1',
      toolName: 'weather',
      result: { tempC: 20 },
    });
  });

  test('the bound builder should reject a result that does not match the named tool', () => {
    // @ts-expect-error 'weather' outputs `{ tempC: number }`, not `{ hits: number }`
    Language.toolResult<typeof tools>({ toolCallId: '1', toolName: 'weather', result: { hits: 3 } });
  });
});

describe('Language.streamToolInput', () => {
  test('the bound builder should correlate toolName to input and keep length optional', () => {
    expectTypeOf(Language.streamToolInput<typeof tools>).toBeCallableWith({
      id: 't1',
      toolName: 'search',
      input: { query: 'Tokyo' },
    });
  });

  test('the bound builder should reject input that does not match the named tool', () => {
    // @ts-expect-error 'search' expects `{ query: string }`, not `{ city: string }`
    Language.streamToolInput<typeof tools>({ id: 't1', toolName: 'search', input: { city: 'Tokyo' } });
  });
});

describe('Language exhaustiveness', () => {
  /** Every content-part `type` tag the builders cover. Kept in lockstep with the content builders in `language.ts`. */
  type BuiltContentTag =
    | 'text'
    | 'reasoning'
    | 'tool-call'
    | 'tool-result'
    | 'tool-approval-request'
    | 'file'
    | 'source'
    | 'custom'
    | 'reasoning-file';

  /**
   * Every stream-part `type` tag the builders cover: the stream-only tags plus the content parts that are
   * valid inline in a stream. Text and reasoning are excluded: in a stream they appear only as their
   * start/delta/end triads, never as a bare content part.
   */
  type BuiltStreamTag =
    | 'stream-start'
    | 'text-start'
    | 'text-delta'
    | 'text-end'
    | 'reasoning-start'
    | 'reasoning-delta'
    | 'reasoning-end'
    | 'tool-input-start'
    | 'tool-input-delta'
    | 'tool-input-end'
    | 'tool-call'
    | 'tool-result'
    | 'tool-approval-request'
    | 'file'
    | 'source'
    | 'custom'
    | 'reasoning-file'
    | 'response-metadata'
    | 'finish'
    | 'raw'
    | 'error';

  /**
   * Tripwires against the provider spec adding or removing a part. When an `@ai-sdk/provider` upgrade
   * changes these unions, they stop compiling until a matching builder and the tag list are updated.
   */
  test('the content builders cover every LanguageModelV4Content type', () => {
    expectTypeOf<BuiltContentTag>().toEqualTypeOf<LanguageModelV4Content['type']>();
  });

  test('the stream builders cover every LanguageModelV4StreamPart type', () => {
    expectTypeOf<BuiltStreamTag>().toEqualTypeOf<LanguageModelV4StreamPart['type']>();
  });
});
