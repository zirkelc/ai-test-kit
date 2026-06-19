import { describe, expect, test } from 'vitest';
import { Image, validBase64Image } from './image.js';

describe('Image', () => {
  test('png() should be the valid base64 1x1 PNG', () => {
    // Assert
    expect(Image.png()).toBe(validBase64Image);
  });

  test('usage() should sum the totals', () => {
    // Assert
    expect(Image.usage(3, 5)).toEqual({ inputTokens: 3, outputTokens: 5, totalTokens: 8 });
  });

  test('result() should build a full result with deterministic response metadata', () => {
    // Act
    const built = Image.result([validBase64Image]);

    // Assert
    expect(built.images).toEqual([validBase64Image]);
    expect(built.warnings).toEqual([]);
    expect(built.response.timestamp).toEqual(new Date(0));
    expect(built.response.modelId).toBe('mock-model');
  });
});
