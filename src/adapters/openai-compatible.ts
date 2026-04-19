import type { AIAdapter } from './base.js';
import type { ProviderConfig } from '../config/index.js';

/**
 * OpenAI-Compatible AI Adapter
 *
 * Works with any API that follows OpenAI's chat completions format:
 * - Kimi (Moonshot)
 * - DeepSeek
 * - Qwen (DashScope)
 * - OpenAI
 * - Any other compatible provider
 */

export class OpenAICompatibleAdapter implements AIAdapter {
  readonly name: string;
  private config: ProviderConfig;

  constructor(name: string, config: ProviderConfig) {
    this.name = name;
    this.config = config;
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }

  async execute(prompt: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error(
        `${this.name} API key not configured. Run \`kele config --provider ${this.name}\` to set it up.`
      );
    }

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a senior software engineer and business analyst. ' +
              'When generating code, return structured JSON with a "files" array containing {path, content}. ' +
              'For analysis tasks, return clear structured insights.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${this.name} API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? '';
  }
}
