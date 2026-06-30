import { describe, expect, test } from 'vitest';
import { createUIParts, UIParts } from './parts.js';

describe('UIParts', () => {
  test('text() should build a text part', () => {
    // Act
    const part = UIParts.text('hi');

    // Assert
    expect(part).toEqual({ type: 'text', text: 'hi' });
  });

  test('text() should include state when provided', () => {
    // Act
    const part = UIParts.text('hi', { state: 'streaming' });

    // Assert
    expect(part).toEqual({ type: 'text', text: 'hi', state: 'streaming' });
  });

  test('reasoning() should build a reasoning part', () => {
    // Act
    const part = UIParts.reasoning('thinking');

    // Assert
    expect(part).toEqual({ type: 'reasoning', text: 'thinking' });
  });

  test('sourceUrl() should build a url source part', () => {
    // Act
    const part = UIParts.sourceUrl({ sourceId: 's1', url: 'https://example.com', title: 'Example' });

    // Assert
    expect(part).toEqual({ type: 'source-url', sourceId: 's1', url: 'https://example.com', title: 'Example' });
  });

  test('sourceDocument() should build a document source part', () => {
    // Act
    const part = UIParts.sourceDocument({ sourceId: 's1', mediaType: 'application/pdf', title: 'Doc' });

    // Assert
    expect(part).toEqual({ type: 'source-document', sourceId: 's1', mediaType: 'application/pdf', title: 'Doc' });
  });

  test('file() should build a file part', () => {
    // Act
    const part = UIParts.file({ mediaType: 'image/png', url: 'https://example.com/a.png' });

    // Assert
    expect(part).toEqual({ type: 'file', mediaType: 'image/png', url: 'https://example.com/a.png' });
  });

  test('reasoningFile() should build a reasoning file part', () => {
    // Act
    const part = UIParts.reasoningFile({ mediaType: 'image/png', url: 'https://example.com/r.png' });

    // Assert
    expect(part).toEqual({ type: 'reasoning-file', mediaType: 'image/png', url: 'https://example.com/r.png' });
  });

  test('custom() should build a provider-specific custom part', () => {
    // Act
    const part = UIParts.custom({ kind: 'acme.box' });

    // Assert
    expect(part).toEqual({ type: 'custom', kind: 'acme.box' });
  });

  test('stepStart() should build a step boundary part', () => {
    // Act
    const part = UIParts.stepStart();

    // Assert
    expect(part).toEqual({ type: 'step-start' });
  });

  test('data() should build a typed data part', () => {
    // Arrange
    const ui = createUIParts<{ weather: { city: string } }>();

    // Act
    const part = ui.data('weather', { city: 'Tokyo' }, { id: 'd1' });

    // Assert
    expect(part).toEqual({ type: 'data-weather', data: { city: 'Tokyo' }, id: 'd1' });
  });

  test('tool() should build a typed tool invocation part', () => {
    // Arrange
    const ui = createUIParts<
      Record<string, never>,
      { weather: { input: { city: string }; output: { temp: number } } }
    >();

    // Act
    const part = ui.tool('weather', {
      toolCallId: 'call-1',
      state: 'output-available',
      input: { city: 'Tokyo' },
      output: { temp: 20 },
    });

    // Assert
    expect(part).toEqual({
      type: 'tool-weather',
      toolCallId: 'call-1',
      state: 'output-available',
      input: { city: 'Tokyo' },
      output: { temp: 20 },
    });
  });

  test('dynamicTool() should build a dynamic tool part', () => {
    // Act
    const part = UIParts.dynamicTool({
      toolName: 'weather',
      toolCallId: 'call-1',
      state: 'input-available',
      input: { city: 'Tokyo' },
    });

    // Assert
    expect(part).toEqual({
      type: 'dynamic-tool',
      toolName: 'weather',
      toolCallId: 'call-1',
      state: 'input-available',
      input: { city: 'Tokyo' },
    });
  });
});
