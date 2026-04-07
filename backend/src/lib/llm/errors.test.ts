import { describe, it, expect } from 'vitest';
import { AtlasProviderError, isAtlasProviderError, isRetryableError } from './errors';

describe('AtlasProviderError', () => {
  it('should construct with all fields', () => {
    const err = new AtlasProviderError({
      provider: 'openrouter',
      model: 'qwen/qwen3.6-plus:free',
      phase: 'stream_connect',
      originalMessage: '401 Unauthorized',
    });

    expect(err.name).toBe('AtlasProviderError');
    expect(err.provider).toBe('openrouter');
    expect(err.model).toBe('qwen/qwen3.6-plus:free');
    expect(err.phase).toBe('stream_connect');
    expect(err.isRetryable).toBe(true);
    expect(err.originalMessage).toBe('401 Unauthorized');
    expect(err.code).toBe('atlas_provider_stream_connect');
    expect(err.message).toContain('openrouter');
  });

  it('should respect explicit code', () => {
    const err = new AtlasProviderError({
      provider: 'ollama',
      model: 'qwen3',
      phase: 'embedding',
      originalMessage: 'model not found',
      code: 'custom_code',
      isRetryable: false,
    });

    expect(err.code).toBe('custom_code');
    expect(err.isRetryable).toBe(false);
  });
});

describe('isAtlasProviderError', () => {
  it('should return true for AtlasProviderError', () => {
    const err = new AtlasProviderError({
      provider: 'test', model: 'test', phase: 'non_stream', originalMessage: 'test',
    });
    expect(isAtlasProviderError(err)).toBe(true);
  });

  it('should return false for regular errors', () => {
    expect(isAtlasProviderError(new Error('test'))).toBe(false);
    expect(isAtlasProviderError(null)).toBe(false);
    expect(isAtlasProviderError(undefined)).toBe(false);
    expect(isAtlasProviderError('string')).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('should return isRetryable from AtlasProviderError', () => {
    const retryable = new AtlasProviderError({
      provider: 'test', model: 'test', phase: 'non_stream',
      originalMessage: 'timeout', isRetryable: true,
    });
    expect(isRetryableError(retryable)).toBe(true);

    const nonRetryable = new AtlasProviderError({
      provider: 'test', model: 'test', phase: 'non_stream',
      originalMessage: 'invalid key', isRetryable: false,
    });
    expect(isRetryableError(nonRetryable)).toBe(false);
  });

  it('should infer retryability from regular error messages', () => {
    expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    expect(isRetryableError(new Error('Network error'))).toBe(true);
    expect(isRetryableError(new Error('timeout'))).toBe(true);
    expect(isRetryableError(new Error('API key invalid'))).toBe(false);
    expect(isRetryableError(new Error('unauthorized'))).toBe(false);
  });
});
