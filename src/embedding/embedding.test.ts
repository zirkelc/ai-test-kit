import { describe, expect, test } from 'vitest';
import { Embedding } from './embedding.js';

describe('Embedding', () => {
  test('vector() should build a sample vector of the default dimension 3', () => {
    // Act
    const v = Embedding.vector();

    // Assert
    expect(v).toEqual([0.1, 0.2, 0.3]);
  });

  test('vector() should honor a custom dimension', () => {
    // Act
    const v = Embedding.vector(5);

    // Assert
    expect(v.length).toBe(5);
  });

  test('usage() should build an embedding usage object', () => {
    // Assert
    expect(Embedding.usage(9)).toEqual({ tokens: 9 });
  });

  test('result() should build a full result from vectors', () => {
    // Act
    const built = Embedding.result([[0.1, 0.2]], { usage: { tokens: 3 } });

    // Assert
    expect(built).toEqual({ embeddings: [[0.1, 0.2]], usage: { tokens: 3 }, warnings: [] });
  });
});
