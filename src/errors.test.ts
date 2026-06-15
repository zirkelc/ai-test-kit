import { APICallError } from '@ai-sdk/provider';
import { describe, expect, test } from 'vitest';
import { Errors } from './errors.js';

describe('Errors', () => {
  describe('from', () => {
    test('should fill the noise fields with inert defaults', () => {
      // Act
      const error = Errors.from();

      // Assert
      expect(APICallError.isInstance(error)).toBe(true);
      expect(error.message).toBe('API call error');
      expect(error.url).toBe('');
      expect(error.requestBodyValues).toEqual({});
      expect(error.data).toBeUndefined();
    });

    test('should let APICallError derive isRetryable from the status code when omitted', () => {
      // Act
      const retryable = Errors.from({ statusCode: 500 });
      const notRetryable = Errors.from({ statusCode: 400 });

      // Assert
      expect(retryable.isRetryable).toBe(true);
      expect(notRetryable.isRetryable).toBe(false);
    });

    test('should pass through the provided fields', () => {
      // Act
      const error = Errors.from({ message: 'boom', statusCode: 418, isRetryable: true, data: { foo: 'bar' } });

      // Assert
      expect(error.message).toBe('boom');
      expect(error.statusCode).toBe(418);
      expect(error.isRetryable).toBe(true);
      expect(error.data).toEqual({ foo: 'bar' });
    });
  });

  describe('rateLimited', () => {
    test('should build a retryable 429 with no retry-after by default', () => {
      // Act
      const error = Errors.rateLimited();

      // Assert
      expect(error.statusCode).toBe(429);
      expect(error.isRetryable).toBe(true);
      expect(error.responseHeaders).toEqual({});
    });

    test('should emit a seconds retry-after header for a number', () => {
      // Act
      const error = Errors.rateLimited({ retryAfter: 5 });

      // Assert
      expect(error.responseHeaders).toEqual({ 'retry-after': '5' });
    });

    test('should emit an HTTP-date retry-after header for a Date', () => {
      // Arrange
      const date = new Date('2026-06-15T10:00:00Z');

      // Act
      const error = Errors.rateLimited({ retryAfter: date });

      // Assert
      expect(error.responseHeaders).toEqual({ 'retry-after': date.toUTCString() });
    });

    test('should emit a retry-after-ms header for a millisecond value', () => {
      // Act
      const error = Errors.rateLimited({ retryAfter: { ms: 3_000 } });

      // Assert
      expect(error.responseHeaders).toEqual({ 'retry-after-ms': '3000' });
    });
  });

  describe('serviceUnavailable', () => {
    test('should build a retryable 503 carrying an optional retry-after', () => {
      // Act
      const error = Errors.serviceUnavailable({ retryAfter: 10 });

      // Assert
      expect(error.statusCode).toBe(503);
      expect(error.isRetryable).toBe(true);
      expect(error.responseHeaders).toEqual({ 'retry-after': '10' });
    });
  });

  describe('serviceOverloaded', () => {
    test('should build a 529, retryable by the status-based default', () => {
      // Act
      const error = Errors.serviceOverloaded();

      // Assert
      expect(error.statusCode).toBe(529);
      expect(error.isRetryable).toBe(true);
      expect(error.data).toBeUndefined();
    });
  });

  describe('internalServerError', () => {
    test('should build a 500, retryable by the status-based default', () => {
      // Act
      const error = Errors.internalServerError();

      // Assert
      expect(error.statusCode).toBe(500);
      expect(error.isRetryable).toBe(true);
    });
  });

  describe('badRequest', () => {
    test('should build a non-retryable 400', () => {
      // Act
      const error = Errors.badRequest();

      // Assert
      expect(error.statusCode).toBe(400);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('unauthorized', () => {
    test('should build a non-retryable 401', () => {
      // Act
      const error = Errors.unauthorized();

      // Assert
      expect(error.statusCode).toBe(401);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe('timeout', () => {
    test('should build a TimeoutError DOMException', () => {
      // Act
      const error = Errors.timeout();

      // Assert
      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe('TimeoutError');
    });
  });

  describe('abort', () => {
    test('should build an AbortError DOMException', () => {
      // Act
      const error = Errors.abort();

      // Assert
      expect(error).toBeInstanceOf(DOMException);
      expect(error.name).toBe('AbortError');
    });
  });
});
