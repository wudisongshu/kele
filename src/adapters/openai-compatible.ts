import type { AIAdapter } from './base.js';
import type { ProviderConfig } from '../config/index.js';

/**
 * OpenAI-Compatible AI Adapter
 *
 * Works with any API that follows OpenAI's chat completions format:
 * - Kimi (Moonshot): https://api.moonshot.cn/v1
 * - Kimi Code: https://api.kimi.com/coding/v1
 * - DeepSeek: https://api.deepseek.com/v1
 * - Qwen (DashScope): https://dashscope.aliyuncs.com/compatible-mode/v1
 * - OpenAI: https://api.openai.com/v1
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

  /**
   * Execute a prompt with automatic retry and timeout.
   *
   * @param prompt - The prompt to send
   * @param retryCount - Number of retries on transient failures (default: 1)
   * @returns The response text from the AI
   */
  async execute(prompt: string, retryCount = 1): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error(
        `${this.name} API key not configured. Run \`kele config --provider ${this.name}\` to set it up.`
      );
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        return await this.executeOnce(prompt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry on auth errors (4xx except 429 rate limit)
        if (lastError.message.includes('401') || lastError.message.includes('403')) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt >= retryCount) {
          throw lastError;
        }

        // Exponential backoff: 1s, 2s
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
      }
    }

    throw lastError ?? new Error(`${this.name} API call failed after ${retryCount + 1} attempts`);
  }

  private async executeOnce(prompt: string): Promise<string> {
    const timeoutMs = (this.config.timeout ?? 10800) * 1000; // default 3 hours
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Auto-inject Kimi Code User-Agent if baseURL matches
      const isKimiCode = this.config.baseURL.includes('api.kimi.com');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      };
      if (isKimiCode && !headers['User-Agent']) {
        headers['User-Agent'] = 'KimiCLI/0.77';
      }

      const body: Record<string, unknown> = {
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
        temperature: this.config.temperature ?? 0.7,
      };

      if (this.config.maxTokens) {
        body.max_tokens = this.config.maxTokens;
      }

      const response = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${this.name} API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      return data.choices[0]?.message?.content ?? '';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `${this.name} API request timed out after ${timeoutMs / 1000}s. ` +
          'Consider increasing timeout with `kele config --provider <name>` or reducing task complexity.'
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
