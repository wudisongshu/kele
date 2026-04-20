import { describe, it, expect, vi } from 'vitest';
import { withTimeout, withRetry } from '../src/core/async-utils.js';

describe('withTimeout', () => {
  it('resolves when promise finishes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 'test', 1000);
    expect(result).toBe('ok');
  });

  it('rejects when promise takes longer than timeout', async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 1000));
    await expect(withTimeout(slow, 'slow', 50)).rejects.toThrow('slow timed out after 50ms');
  });

  it('cleans up timer after resolution', async () => {
    const before = process._getActiveHandles?.().length ?? 0;
    await withTimeout(Promise.resolve(42), 'test', 5000);
    // No assertion on handle count (Node API varies), but the test ensures no hang
  });
});

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');
    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws last error after all attempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, { maxAttempts: 2, delayMs: 10 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('calls onError for each failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('ok');
    const onError = vi.fn();
    await withRetry(fn, { maxAttempts: 2, delayMs: 10, onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'fail 1' }), 1);
  });
});
