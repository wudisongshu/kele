import { describe, it, expect, vi } from 'vitest';
import { ProviderFallback } from '../src/core/provider-fallback.js';
import type { AIAdapter } from '../src/adapters/base.js';

function makeMockAdapter(name: string, response: string): AIAdapter {
  return {
    name,
    isAvailable: () => true,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockResolvedValue(response),
  } as unknown as AIAdapter;
}

function makeFailingAdapter(name: string, errorMsg: string): AIAdapter {
  return {
    name,
    isAvailable: () => true,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockRejectedValue(new Error(errorMsg)),
  } as unknown as AIAdapter;
}

function makeUnavailableAdapter(name: string): AIAdapter {
  return {
    name,
    isAvailable: () => false,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockResolvedValue('ok'),
  } as unknown as AIAdapter;
}

describe('ProviderFallback', () => {
  it('filters out unavailable providers', () => {
    const a = makeMockAdapter('a', 'ok');
    const b = makeUnavailableAdapter('b');
    const fb = new ProviderFallback([a, b]);
    expect(fb.listProviders()).toEqual(['a']);
  });

  it('returns primary provider', () => {
    const a = makeMockAdapter('a', 'ok');
    const b = makeMockAdapter('b', 'ok');
    const fb = new ProviderFallback([a, b]);
    expect(fb.getPrimary().name).toBe('a');
  });

  it('uses first provider on success', async () => {
    const a = makeMockAdapter('a', 'result-a');
    const b = makeMockAdapter('b', 'result-b');
    const fb = new ProviderFallback([a, b]);

    const result = await fb.execute('prompt');
    expect(result).toBe('result-a');
    expect(a.execute).toHaveBeenCalledTimes(1);
    expect(b.execute).toHaveBeenCalledTimes(0);
  });

  it('switches to second provider when first fails', async () => {
    const a = makeFailingAdapter('a', '504 timeout');
    const b = makeMockAdapter('b', 'result-b');
    const fb = new ProviderFallback([a, b]);

    const result = await fb.execute('prompt');
    expect(result).toBe('result-b');
    expect(a.execute).toHaveBeenCalledTimes(1);
    expect(b.execute).toHaveBeenCalledTimes(1);
  });

  it('switches to third provider when first two fail', async () => {
    const a = makeFailingAdapter('a', 'error-a');
    const b = makeFailingAdapter('b', 'error-b');
    const c = makeMockAdapter('c', 'result-c');
    const fb = new ProviderFallback([a, b, c]);

    const result = await fb.execute('prompt');
    expect(result).toBe('result-c');
    expect(a.execute).toHaveBeenCalledTimes(1);
    expect(b.execute).toHaveBeenCalledTimes(1);
    expect(c.execute).toHaveBeenCalledTimes(1);
  });

  it('throws when all providers fail', async () => {
    const a = makeFailingAdapter('a', 'timeout');
    const b = makeFailingAdapter('b', 'rate limit');
    const fb = new ProviderFallback([a, b]);

    await expect(fb.execute('prompt')).rejects.toThrow('所有 provider 均失败');
    await expect(fb.execute('prompt')).rejects.toThrow('timeout');
    await expect(fb.execute('prompt')).rejects.toThrow('rate limit');
  });

  it('remembers working provider for subsequent calls', async () => {
    const a = makeFailingAdapter('a', 'error');
    const b = makeMockAdapter('b', 'ok');
    const fb = new ProviderFallback([a, b]);

    await fb.execute('prompt1');
    await fb.execute('prompt2');

    // First call tries a then b; second call starts from b (index 1)
    expect(a.execute).toHaveBeenCalledTimes(1);
    expect(b.execute).toHaveBeenCalledTimes(2);
  });

  it('passes onToken callback through', async () => {
    const a = makeMockAdapter('a', 'ok');
    const fb = new ProviderFallback([a]);
    const onToken = vi.fn();

    await fb.execute('prompt', onToken);
    expect(a.execute).toHaveBeenCalledWith('prompt', onToken);
  });
});
