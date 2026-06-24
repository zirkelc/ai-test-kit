import { describe, expect, test } from 'vitest';
import { Image, base64Png1x1 } from './image.js';

describe('Image', () => {
  test('png() should be the valid base64 1x1 PNG', () => {
    // Assert
    expect(Image.png()).toBe(base64Png1x1);
  });

  test('png() should accept an explicit 1x1 size', () => {
    // Assert
    expect(Image.png('1x1')).toBe(base64Png1x1);
  });

  test('usage() should sum the totals', () => {
    // Assert
    expect(Image.usage(3, 5)).toEqual({ inputTokens: 3, outputTokens: 5, totalTokens: 8 });
  });

  test('result() should build a full result with deterministic response metadata', () => {
    // Act
    const built = Image.result([base64Png1x1]);

    // Assert
    expect(built.images).toEqual([base64Png1x1]);
    expect(built.warnings).toEqual([]);
    expect(built.response.timestamp).toEqual(new Date(0));
    expect(built.response.modelId).toBe('mock-model');
  });
});
