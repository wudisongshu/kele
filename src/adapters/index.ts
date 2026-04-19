import type { AIAdapter, RouteResult } from './base.js';
import { MockAdapter } from './mock.js';
import { OpenAICompatibleAdapter } from './openai-compatible.js';
import { loadConfig } from '../config/index.js';
import type { Complexity, AIProvider } from '../types/index.js';

export * from './base.js';
export { MockAdapter } from './mock.js';
export { OpenAICompatibleAdapter } from './openai-compatible.js';

/**
 * AI Provider Registry — manages all available AI adapters.
 */
export class ProviderRegistry {
  private adapters: Map<string, AIAdapter> = new Map();

  constructor() {
    // Always register mock as ultimate fallback
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
   * - simple tasks → free/cheap provider
   * - complex tasks → preferred/default provider (usually higher quality)
   * - if preferred unavailable → fallback to mock
   */
  route(_complexity: Complexity, preferred?: AIProvider): RouteResult {
    const available = this.listAvailable();

    // If user specified a preferred provider and it's available, use it
    if (preferred && available.includes(preferred)) {
      return {
        provider: preferred,
        adapter: this.adapters.get(preferred)!,
      };
    }

    // Use default provider from config if available
    const config = loadConfig();
    if (config.defaultProvider && available.includes(config.defaultProvider)) {
      return {
        provider: config.defaultProvider as AIProvider,
        adapter: this.adapters.get(config.defaultProvider)!,
      };
    }

    // Fallback: use any available real provider
    for (const name of available) {
      if (name !== 'mock') {
        return {
          provider: name as AIProvider,
          adapter: this.adapters.get(name)!,
        };
      }
    }

    // Ultimate fallback: mock
    const mock = this.adapters.get('mock')!;
    return { provider: 'mock' as AIProvider, adapter: mock };
  }
}

/**
 * Create a registry from user configuration.
 * Loads all configured providers from ~/.kele/config.json
 */
export function createRegistryFromConfig(): ProviderRegistry {
  const registry = new ProviderRegistry();
  const config = loadConfig();

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    registry.register(new OpenAICompatibleAdapter(name, providerConfig));
  }

  return registry;
}

/**
 * Create a mock-only registry for fast testing.
 * No API calls are made — all responses come from the mock adapter.
 */
export function createMockRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}
