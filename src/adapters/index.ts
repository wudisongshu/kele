import type { AIAdapter, RouteResult } from './base.js';
import { MockAdapter } from './mock.js';
import { DeepSeekAdapter } from './deepseek.js';
import type { DeepSeekConfig } from './deepseek.js';
import type { Complexity, AIProvider } from '../types/index.js';

export * from './base.js';
export { MockAdapter } from './mock.js';
export { DeepSeekAdapter } from './deepseek.js';

/**
 * AI Provider Registry — manages all available AI adapters.
 */
export class ProviderRegistry {
  private adapters: Map<string, AIAdapter> = new Map();

  constructor() {
    // Always register mock as fallback
    this.register(new MockAdapter());
  }

  register(adapter: AIAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): AIAdapter | undefined {
    return this.adapters.get(name);
  }

  listAvailable(): string[] {
    return Array.from(this.adapters.values())
      .filter((a) => a.isAvailable())
      .map((a) => a.name);
  }

  /**
   * Route a task to the most appropriate AI provider.
   *
   * Rules:
   * - simple tasks → free provider (deepseek, qwen)
   * - complex tasks → paid provider (claude, openai)
   * - if preferred provider unavailable → fallback to mock
   */
  route(complexity: Complexity, preferred?: AIProvider): RouteResult {
    const available = this.listAvailable();

    // Free providers (priority order)
    const freeProviders: AIProvider[] = ['deepseek', 'qwen'];
    // Paid providers (priority order)
    const paidProviders: AIProvider[] = ['claude', 'openai'];

    let candidates: AIProvider[];

    if (preferred && available.includes(preferred)) {
      candidates = [preferred];
    } else if (complexity === 'simple') {
      candidates = freeProviders;
    } else {
      // For medium and complex, prefer paid but allow free fallback
      candidates = [...paidProviders, ...freeProviders];
    }

    for (const name of candidates) {
      const adapter = this.adapters.get(name);
      if (adapter && adapter.isAvailable()) {
        return { provider: name as AIProvider, adapter };
      }
    }

    // Ultimate fallback: mock
    const mock = this.adapters.get('mock')!;
    return { provider: 'mock' as AIProvider, adapter: mock };
  }
}

/**
 * Create a registry from user configuration.
 */
export function createRegistry(config: {
  deepseek?: DeepSeekConfig;
} = {}): ProviderRegistry {
  const registry = new ProviderRegistry();

  if (config.deepseek) {
    registry.register(new DeepSeekAdapter(config.deepseek));
  }

  return registry;
}
