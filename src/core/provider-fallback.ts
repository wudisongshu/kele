/**
 * ProviderFallback — automatic failover across multiple AI providers.
 *
 * When the primary provider fails (504, rate limit, etc.), automatically
 * retries with the next available provider in the list.
 */

import type { AIAdapter } from '../adapters/base.js';
import { debugLog } from '../debug.js';

export class ProviderFallback {
  private providers: AIAdapter[];
  private currentIndex: number = 0;

  constructor(providers: AIAdapter[]) {
    this.providers = providers.filter((p) => p.isAvailable());
  }

  getPrimary(): AIAdapter {
    return this.providers[this.currentIndex];
  }

  listProviders(): string[] {
    return this.providers.map((p) => p.name);
  }

  /**
   * Execute an AI prompt. If the current provider fails, automatically
   * switch to the next one in the list.
   */
  async execute(prompt: string, onToken?: (token: string) => void): Promise<string> {
    const lastIndex = this.providers.length - 1;
    const failures: string[] = [];

    for (let i = this.currentIndex; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        console.log(`🤖 使用 ${provider.name} 生成代码...`);
        debugLog('ProviderFallback trying', provider.name);
        const result = await provider.execute(prompt, onToken);
        this.currentIndex = i;
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${provider.name}: ${msg}`);
        debugLog('ProviderFallback failed', `${provider.name}: ${msg}`);
        console.log(`❌ ${provider.name} 失败: ${msg.slice(0, 100)}`);

        if (i < lastIndex) {
          console.log(`🔄 自动切换到备用 provider: ${this.providers[i + 1].name}`);
        }
      }
    }

    throw new Error(`所有 provider 均失败:\n${failures.join('\n')}`);
  }
}
