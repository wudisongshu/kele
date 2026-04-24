/**
 * AI Provider Router — simple provider selection and fallback.
 */

import type { AIAdapter, RouteResult } from './provider.js';
import { MockAdapter } from './providers/mock.js';
import { OpenAICompatibleAdapter } from './providers/openai-compatible.js';
import { loadConfig } from '../config/manager.js';

export class ProviderRouter {
  private adapters: Map<string, AIAdapter> = new Map();

  constructor() {
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

  getAllAvailable(excludeMock: boolean = true): AIAdapter[] {
    const all = Array.from(this.adapters.values()).filter((a) => a.isAvailable());
    if (excludeMock) {
      return all.filter((a) => a.name !== 'mock');
    }
    return all;
  }

  /**
   * Route to the most appropriate provider.
   * Priority: preferred > default config > any available > mock
   */
  route(preferred?: string): RouteResult {
    const available = this.listAvailable();

    if (preferred && available.includes(preferred)) {
      return { provider: preferred, adapter: this.adapters.get(preferred)! };
    }

    const config = loadConfig();
    if (config.defaultProvider && available.includes(config.defaultProvider)) {
      return {
        provider: config.defaultProvider,
        adapter: this.adapters.get(config.defaultProvider)!,
      };
    }

    for (const name of available) {
      if (name !== 'mock') {
        return { provider: name, adapter: this.adapters.get(name)! };
      }
    }

    const mock = this.adapters.get('mock')!;
    return { provider: 'mock', adapter: mock };
  }

  getPrimary(): AIAdapter {
    return this.route().adapter;
  }
}

/**
 * Create a router from user configuration.
 */
export function createRouterFromConfig(): ProviderRouter {
  const router = new ProviderRouter();
  const config = loadConfig();

  for (const [name, providerConfig] of Object.entries(config.providers)) {
    router.register(new OpenAICompatibleAdapter(name, providerConfig));
  }

  return router;
}

/**
 * Create a mock-only router for fast testing.
 */
export function createMockRouter(): ProviderRouter {
  return new ProviderRouter();
}
