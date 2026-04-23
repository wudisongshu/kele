import { describe, it, expect, vi } from 'vitest';
import { executeWithFallback, executeFixWithFallback } from '../src/core/adapter-utils.js';
import type { AIAdapter } from '../src/adapters/base.js';
import type { ProviderRegistry } from '../src/adapters/index.js';

function makeMockAdapter(output: string): AIAdapter {
  return {
    name: 'mock',
    execute: vi.fn().mockResolvedValue(output),
  } as unknown as AIAdapter;
}

function makeFailingAdapter(error: string): AIAdapter {
  return {
    name: 'failing',
    execute: vi.fn().mockRejectedValue(new Error(error)),
  } as unknown as AIAdapter;
}

function makeRegistry(_mockAdapter?: AIAdapter): ProviderRegistry {
  return {
    get: vi.fn((name: string) => name === 'mock' ? undefined : undefined),
    route: vi.fn(),
    list: vi.fn().mockReturnValue([]),
  } as unknown as ProviderRegistry;
}

describe('executeWithFallback', () => {
  it('returns primary adapter output on success', async () => {
    const primary = makeMockAdapter('primary output');
    const registry = makeRegistry();
    const result = await executeWithFallback(registry, 'prompt', 'deepseek', primary);
    expect(result.output).toBe('primary output');
    expect(result.provider).toBe('deepseek');
  });

  it('throws on primary failure (no silent mock fallback)', async () => {
    const primary = makeFailingAdapter('timeout');
    const registry = makeRegistry();
    await expect(executeWithFallback(registry, 'prompt', 'deepseek', primary)).rejects.toThrow('timeout');
  });

  it('propagates error when no mock adapter available', async () => {
    const primary = makeFailingAdapter('network error');
    const registry = makeRegistry();
    await expect(executeWithFallback(registry, 'prompt', 'deepseek', primary)).rejects.toThrow('network error');
  });

  it('propagates abort signal without fallback', async () => {
    const primary = makeFailingAdapter('aborted');
    const registry = makeRegistry();
    const signal = AbortSignal.abort();
    await expect(executeWithFallback(registry, 'prompt', 'deepseek', primary, undefined, undefined, signal)).rejects.toThrow('aborted');
  });

  it('throws immediately on non-retryable errors without retrying', async () => {
    const primary = makeFailingAdapter('invalid api key');
    const registry = makeRegistry();
    await expect(executeWithFallback(registry, 'prompt', 'deepseek', primary)).rejects.toThrow('invalid api key');
    expect(primary.execute).toHaveBeenCalledTimes(1);
  });

  it('passes onToken callback to adapter', async () => {
    const primary = makeMockAdapter('output');
    const registry = makeRegistry();
    const onToken = vi.fn();
    await executeWithFallback(registry, 'prompt', 'deepseek', primary, onToken);
    expect(primary.execute).toHaveBeenCalledWith('prompt', onToken);
  });

  it('calls onProgress for retryable errors', async () => {
    const primary = makeFailingAdapter('429 Too Many Requests');
    const registry = makeRegistry();
    const onProgress = vi.fn();
    await expect(executeWithFallback(registry, 'prompt', 'deepseek', primary, undefined, onProgress)).rejects.toThrow('429');
    const progressCalls = onProgress.mock.calls.map((c) => c[0]);
    expect(progressCalls.some((msg: string) => msg.includes('429'))).toBe(true);
    expect(progressCalls.some((msg: string) => msg.includes('重试'))).toBe(true);
  });

  it('does not fallback when primary is already mock', async () => {
    const primary = makeFailingAdapter('mock failed');
    const registry = makeRegistry(primary);
    await expect(executeWithFallback(registry, 'prompt', 'mock', primary)).rejects.toThrow('mock failed');
  });

  it('retries up to 5 times on retryable errors', async () => {
    const primary = makeFailingAdapter('502 Bad Gateway');
    const registry = makeRegistry();
    await expect(executeWithFallback(registry, 'prompt', 'deepseek', primary)).rejects.toThrow('502 Bad Gateway');
    expect(primary.execute).toHaveBeenCalledTimes(6); // initial + 5 retries
  });
});

describe('executeFixWithFallback', () => {
  it('returns fix output from primary adapter', async () => {
    const primary = makeMockAdapter('fixed code');
    const registry = makeRegistry();
    const result = await executeFixWithFallback(registry, 'fix prompt', 'deepseek', primary);
    expect(result).toBe('fixed code');
  });

  it('throws on fix failure (no silent mock fallback)', async () => {
    const primary = makeFailingAdapter('rate limited');
    const registry = makeRegistry();
    await expect(executeFixWithFallback(registry, 'fix prompt', 'deepseek', primary)).rejects.toThrow('rate limited');
  });

  it('throws when primary fails', async () => {
    const primary = makeFailingAdapter('primary fail');
    const registry = makeRegistry();
    await expect(executeFixWithFallback(registry, 'fix prompt', 'deepseek', primary)).rejects.toThrow('primary fail');
  });

  it('returns output from successful adapter', async () => {
    const primary = makeMockAdapter('success output');
    const registry = makeRegistry();
    const result = await executeWithFallback(registry, 'prompt', 'deepseek', primary);
    expect(result.output).toBe('success output');
    expect(result.provider).toBe('deepseek');
  });
});
