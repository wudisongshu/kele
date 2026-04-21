/**
 * Async utilities for kele.
 *
 * Core principle: kele waits indefinitely for AI responses.
 * No timeouts, no token limits. The user has infinite time and infinite tokens.
 */

/**
 * Previously raced a promise against a timeout.
 * Now simply returns the promise — kele never times out.
 * Kept for backward compatibility.
 */
export function withTimeout<T>(promise: Promise<T>, _label: string, _ms: number): Promise<T> {
  return promise;
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
