import { describe, expect, test } from 'vitest';
import * as root from './index.js';

describe('root barrel', () => {
  test('should export the generic stream and iterable helpers', () => {
    // Assert
    expect(typeof root.Streams).toBe('object');
    expect(typeof root.Iterables).toBe('object');
  });

  test('should export the generic error helpers', () => {
    // Assert
    expect(typeof root.Errors).toBe('object');
  });
});
