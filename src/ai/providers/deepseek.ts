/**
 * DeepSeek AI Adapter — thin wrapper over OpenAI-compatible adapter.
 * Kept for backwards compatibility; new code should use OpenAICompatibleAdapter directly.
 */

import type { AIAdapter } from '../provider.js';
import { OpenAICompatibleAdapter } from './openai-compatible.js';

export class DeepSeekAdapter implements AIAdapter {
  readonly name = 'deepseek';
  private inner: OpenAICompatibleAdapter;

  constructor(config: { apiKey: string; model?: string; maxTokens?: number }) {
    this.inner = new OpenAICompatibleAdapter('deepseek', {
      apiKey: config.apiKey,
      baseURL: 'https://api.deepseek.com/v1',
      model: config.model ?? 'deepseek-chat',
      maxTokens: config.maxTokens ?? 100000,
    });
  }

  isAvailable(): boolean {
    return this.inner.isAvailable();
  }

  testConnection(): Promise<{ ok: boolean; error?: string }> {
    return this.inner.testConnection();
  }

  execute(prompt: string, onToken?: (token: string) => void): Promise<string> {
    return this.inner.execute(prompt, onToken);
  }
}
