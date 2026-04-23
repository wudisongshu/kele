import { describe, it, expect, vi } from 'vitest';
import { withTimeout, withRetry } from '../src/core/async-utils.js';

describe('withTimeout', () => {
  it('returns the resolved value (no timeout in kele)', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 'test', 1000);
    expect(result).toBe('ok');
  });

  it('waits indefinitely for slow promises (kele never times out)', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('done'), 50));
    const result = await withTimeout(slow, 'slow', 10); // 10ms is ignored
    expect(result).toBe('done');
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

  it('succeeds immediately with maxAttempts 1', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 1, delayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws immediately when maxAttempts is 1 and fn fails', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, { maxAttempts: 1, delayMs: 10 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries with increasing attempt numbers', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');
    const onError = vi.fn();
    await withRetry(fn, { maxAttempts: 3, delayMs: 10, onError });
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: 'fail 1' }), 1);
    expect(onError).toHaveBeenNthCalledWith(2, expect.objectContaining({ message: 'fail 2' }), 2);
  });

  it('returns rejected promise for synchronous errors', async () => {
    const fn = vi.fn().mockImplementation(() => { throw new Error('sync fail'); });
    await expect(withRetry(fn, { maxAttempts: 2, delayMs: 10 })).rejects.toThrow('sync fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
