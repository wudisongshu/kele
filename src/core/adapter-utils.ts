import type { AIAdapter } from '../adapters/base.js';
import type { ProviderRegistry } from '../adapters/index.js';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = process.env.VITEST
  ? [10, 20] // fast delays in tests
  : [1000, 2000]; // exponential backoff: 1s, 2s

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an AI prompt with automatic retry (exponential backoff) and fallback to mock adapter on failure.
 * Returns the AI output and the effective provider name.
 */
export async function executeWithFallback(
  registry: ProviderRegistry,
  prompt: string,
  routeProvider: string,
  routeAdapter: AIAdapter,
  onToken?: (token: string) => void,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<{ output: string; provider: string }> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Check abort before each attempt
    if (signal?.aborted) {
      throw new Error('Execution aborted by user');
    }

    try {
      if (attempt > 0) {
        onProgress?.(`   🔄  ${routeProvider} 第 ${attempt + 1} 次尝试...`);
      }
      const output = await routeAdapter.execute(prompt, onToken);
      return { output, provider: routeProvider };
    } catch (err) {
      lastErr = err;

      // User-initiated abort — do NOT retry or fallback, just propagate
      if (signal?.aborted) {
        throw err;
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      const isRetryable = isRetryableError(err);

      onProgress?.(`   ⚠️  ${routeProvider} error: ${errorMsg.slice(0, 120)}`);

      // If retryable and we haven't exhausted retries, wait and retry
      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS[attempt] ?? 4000;
        onProgress?.(`   ⏳  ${delay / 1000} 秒后重试...`);
        await sleep(delay);
        continue;
      }

      // Non-retryable or exhausted retries — try fallback
      break;
    }
  }

  const mock = registry.get('mock');
  if (mock && routeProvider !== 'mock') {
    onProgress?.(`   ⚠️  AI provider "${routeProvider}" failed after ${MAX_RETRIES + 1} attempts. Falling back to mock mode.`);
    onProgress?.(`      ⚠️  WARNING: Mock output is generic and may NOT match your specific idea.`);
    onProgress?.(`      💡  To use your real provider, check: kele config --provider ${routeProvider}`);
    const output = await mock.execute(prompt);
    return { output, provider: 'mock' };
  }

  throw lastErr;
}

/**
 * Execute a fix prompt with the same adapter, with retry and optional fallback.
 */
export async function executeFixWithFallback(
  registry: ProviderRegistry,
  prompt: string,
  routeProvider: string,
  routeAdapter: AIAdapter,
  onToken?: (token: string) => void,
  onProgress?: (msg: string) => void
): Promise<string> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        onProgress?.(`   🔄  Fix 第 ${attempt + 1} 次尝试...`);
      }
      return await routeAdapter.execute(prompt, onToken);
    } catch (err) {
      lastErr = err;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isRetryable = isRetryableError(err);

      onProgress?.(`   ⚠️  Fix request failed: ${errorMsg.slice(0, 120)}`);

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS[attempt] ?? 4000;
        onProgress?.(`   ⏳  ${delay / 1000} 秒后重试...`);
        await sleep(delay);
        continue;
      }

      break;
    }
  }

  const mock = registry.get('mock');
  if (mock && routeProvider !== 'mock') {
    onProgress?.(`   ⚠️  Fix request failed on "${routeProvider}". Falling back to mock.`);
    onProgress?.(`      ⚠️  WARNING: Mock fix output is generic and may NOT match your idea.`);
    return await mock.execute(prompt);
  }

  throw lastErr;
}
