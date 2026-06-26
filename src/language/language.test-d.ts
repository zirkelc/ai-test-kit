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
