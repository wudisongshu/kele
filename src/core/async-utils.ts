/**
 * Async utilities for kele.
 */

/**
 * Race a promise against a timeout. Cleans up the timer when the promise
 * resolves or rejects to avoid leaving dangling timers in the event loop.
 */
export function withTimeout<T>(promise: Promise<T>, label: string, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const hint = ms < 300000
        ? ' (提示: 用 --timeout 增加超时时间，或用 --mock 模式测试)'
        : '';
      reject(new Error(`${label} timed out after ${ms}ms${hint}`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Retry an async operation with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; delayMs?: number; onError?: (err: Error, attempt: number) => void } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, onError } = options;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      onError?.(lastError, attempt);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs * attempt));
      }
    }
  }

  throw lastError!;
}
