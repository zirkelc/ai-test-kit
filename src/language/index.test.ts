import { describe, expect, test } from 'vitest';
import * as language from './index.js';

describe('language barrel', () => {
  test('should export the language testing surface', () => {
    // Assert
    expect(typeof language.MockLanguageModel).toBe('object');
    expect(typeof language.MockLanguageModel.from).toBe('function');
    expect(typeof language.Language).toBe('object');
    expect(typeof language.Options).toBe('object');
  });
});
