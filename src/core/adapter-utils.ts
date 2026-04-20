import type { AIAdapter } from '../adapters/base.js';
import type { ProviderRegistry } from '../adapters/index.js';

/**
 * Execute an AI prompt with automatic fallback to mock adapter on failure.
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
  try {
    const output = await routeAdapter.execute(prompt, onToken);
    return { output, provider: routeProvider };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // User-initiated abort — do NOT fallback, just propagate
    if (signal?.aborted) {
      throw err;
    }

    onProgress?.(`   ⚠️  ${routeProvider} error: ${errorMsg.slice(0, 120)}`);

    const mock = registry.get('mock');
    if (mock && routeProvider !== 'mock') {
      onProgress?.(`   🔄 Falling back to mock adapter`);
      const output = await mock.execute(prompt);
      return { output, provider: 'mock' };
    }

    throw err;
  }
}

/**
 * Execute a fix prompt with the same adapter, with optional fallback.
 */
export async function executeFixWithFallback(
  registry: ProviderRegistry,
  prompt: string,
  routeProvider: string,
  routeAdapter: AIAdapter,
  onToken?: (token: string) => void,
  onProgress?: (msg: string) => void
): Promise<string> {
  try {
    return await routeAdapter.execute(prompt, onToken);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    onProgress?.(`   ⚠️  Fix request failed: ${errorMsg.slice(0, 120)}`);

    const mock = registry.get('mock');
    if (mock && routeProvider !== 'mock') {
      onProgress?.(`   🔄 Falling back to mock for fix`);
      return await mock.execute(prompt);
    }

    throw err;
  }
}
