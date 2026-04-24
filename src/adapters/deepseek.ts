import type { AIAdapter } from './base.js';

/**
 * DeepSeek AI Adapter — free tier available.
 * Docs: https://platform.deepseek.com/
 */

const API_BASE = 'https://api.deepseek.com/v1';

export interface DeepSeekConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export class DeepSeekAdapter implements AIAdapter {
  readonly name = 'deepseek';
  private config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = {
      model: 'deepseek-chat',
      maxTokens: 100000,
      ...config,
    };
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isAvailable()) return { ok: false, error: 'API key not configured' };
    try {
      const response = await fetch(`${API_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      if (response.ok) return { ok: true };
      const text = await response.text().catch(() => '');
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async execute(prompt: string, _onToken?: (token: string) => void): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('DeepSeek API key not configured. Run `kele config` to set it up.');
    }

    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: 'You are a senior software engineer. Respond in structured JSON when generating code.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices?.[0]?.message?.content ?? '';
  }
}
