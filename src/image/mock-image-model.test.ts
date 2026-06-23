import { generateImage } from 'ai';
import { describe, expect, test } from 'vitest';
import { base64Png1x1 } from './image.js';
import { MockImageModel } from './mock-image-model.js';

describe('MockImageModel', () => {
  describe('from', () => {
    test('should generate from a bare images array', async () => {
      // Arrange
      const model = MockImageModel.from([base64Png1x1]);

      // Act
      const result = await generateImage({ model, prompt: 'a cat' });

      // Assert
      expect(result.images.length).toBe(1);
      expect(result.images[0]?.base64).toBe(base64Png1x1);
    });

    test('should default warnings for a bare images array', async () => {
      // Arrange
      const model = MockImageModel.from([base64Png1x1]);

      // Act
      const result = await generateImage({ model, prompt: 'a cat' });

      // Assert
      expect(result.warnings).toEqual([]);
    });

    test('should throw when given an Error', async () => {
      // Arrange
      const model = MockImageModel.from(new Error('rate limited'));

      // Act
      const result = generateImage({ model, prompt: 'a cat' });

      // Assert
      await expect(result).rejects.toThrow();
    });

    test('should resolve a function response from the call options', async () => {
      // Arrange
      const model = MockImageModel.from(async (options) => ({
        images: [base64Png1x1],
        warnings: [],
        response: { timestamp: new Date(0), modelId: String(options.n), headers: undefined },
      }));

      // Act
      const result = await generateImage({ model, prompt: 'a cat' });

      // Assert
      expect(result.images[0]?.base64).toBe(base64Png1x1);
    });

    test('should throw a clear error when no response is configured', async () => {
      // Arrange
      const model = MockImageModel.from();

      // Act
      const result = generateImage({ model, prompt: 'x' });

      // Assert
      await expect(result).rejects.toThrow();
    });
  });

  describe('sequencing', () => {
    test('should advance through a sequence and clamp to the last', async () => {
      // Arrange
      const model = MockImageModel.from([new Error('429'), [base64Png1x1]]);

      // Act + Assert
      await expect(generateImage({ model, prompt: 'a' })).rejects.toThrow();
      expect((await generateImage({ model, prompt: 'b' })).images[0]?.base64).toBe(base64Png1x1);
      expect((await generateImage({ model, prompt: 'c' })).images[0]?.base64).toBe(base64Png1x1);
    });
  });

  describe('spying', () => {
    test('should record calls on the spy and on the call history', async () => {
      // Arrange
      const model = MockImageModel.from([base64Png1x1]);

      // Act
      await generateImage({ model, prompt: 'a cat' });

      // Assert
      expect(model.doGenerate.mock.calls.length).toBe(1);
      expect(model.doGenerateCalls[0]?.prompt).toBe('a cat');
    });
  });

  describe('options', () => {
    test('should default provider, auto-increment modelId, and set spec defaults', () => {
      // Arrange
      const a = MockImageModel.from();
      const b = MockImageModel.from();

      // Assert
      expect(a.provider).toBe('mock-provider');
      expect(a.modelId).not.toBe(b.modelId);
      expect(a.maxImagesPerCall).toBe(1);
    });

    test('should honor identity and capability overrides', () => {
      // Arrange
      const model = MockImageModel.from([base64Png1x1], {
        provider: 'acme',
        modelId: 'acme-image',
        maxImagesPerCall: 4,
      });

      // Assert
      expect(model.provider).toBe('acme');
      expect(model.modelId).toBe('acme-image');
      expect(model.maxImagesPerCall).toBe(4);
    });
  });

  describe('callOptions', () => {
    test('should build valid options with all required keys present', () => {
      // Act
      const options = MockImageModel.callOptions({ prompt: 'A sunset' });

      // Assert
      expect(options.prompt).toBe('A sunset');
      expect(options.n).toBe(1);
      expect(options.providerOptions).toEqual({});
    });
  });
});
