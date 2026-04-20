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

function makeRegistry(mockAdapter?: AIAdapter): ProviderRegistry {
  return {
    get: vi.fn((name: string) => name === 'mock' ? mockAdapter : undefined),
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

  it('falls back to mock adapter on primary failure', async () => {
    const primary = makeFailingAdapter('timeout');
    const mock = makeMockAdapter('mock output');
    const registry = makeRegistry(mock);
    const result = await executeWithFallback(registry, 'prompt', 'deepseek', primary);
    expect(result.output).toBe('mock output');
    expect(result.provider).toBe('mock');
  });

  it('propagates error when no mock adapter available', async () => {
    const primary = makeFailingAdapter('network error');
    const registry = makeRegistry();
    await expect(executeWithFallback(registry, 'prompt', 'deepseek', primary)).rejects.toThrow('network error');
  });

  it('propagates abort signal without fallback', async () => {
    const primary = makeFailingAdapter('aborted');
    const mock = makeMockAdapter('mock output');
    const registry = makeRegistry(mock);
    const signal = AbortSignal.abort();
    await expect(executeWithFallback(registry, 'prompt', 'deepseek', primary, undefined, undefined, signal)).rejects.toThrow('aborted');
  });

  it('does not fallback when primary is already mock', async () => {
    const primary = makeFailingAdapter('mock failed');
    const registry = makeRegistry(primary);
    await expect(executeWithFallback(registry, 'prompt', 'mock', primary)).rejects.toThrow('mock failed');
  });

  it('calls onProgress with error and fallback messages', async () => {
    const primary = makeFailingAdapter('timeout');
    const mock = makeMockAdapter('mock output');
    const registry = makeRegistry(mock);
    const progress: string[] = [];
    await executeWithFallback(registry, 'prompt', 'deepseek', primary, undefined, (msg) => progress.push(msg));
    expect(progress.some(p => p.includes('error'))).toBe(true);
    expect(progress.some(p => p.includes('Falling back'))).toBe(true);
  });
});

describe('executeFixWithFallback', () => {
  it('returns fix output from primary adapter', async () => {
    const primary = makeMockAdapter('fixed code');
    const registry = makeRegistry();
    const result = await executeFixWithFallback(registry, 'fix prompt', 'deepseek', primary);
    expect(result).toBe('fixed code');
  });

  it('falls back to mock for fix requests', async () => {
    const primary = makeFailingAdapter('rate limited');
    const mock = makeMockAdapter('mock fix');
    const registry = makeRegistry(mock);
    const result = await executeFixWithFallback(registry, 'fix prompt', 'deepseek', primary);
    expect(result).toBe('mock fix');
  });

  it('throws when both primary and mock fail', async () => {
    const primary = makeFailingAdapter('primary fail');
    const mock = makeFailingAdapter('mock fail');
    const registry = makeRegistry(mock);
    await expect(executeFixWithFallback(registry, 'fix prompt', 'deepseek', primary)).rejects.toThrow('mock fail');
  });
});
