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
   * Retry strategy:
   * - 401/403: No retry (auth failure)
   * - 429: Retry with exponential backoff
   * - 502/503/504: Retry more aggressively (server-side transient errors)
   * - Network errors: Retry
   *
   * @param prompt - The prompt to send
   * @returns The response text from the AI
   */
  async execute(prompt: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error(
        `${this.name} API key not configured. Run \`kele config --provider ${this.name}\` to set it up.`
      );
    }

    const maxRetries = 2; // 3 attempts total, ~21s max backoff
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeOnce(prompt);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;

        // Never retry auth errors
        if (msg.includes('401') || msg.includes('403')) {
          throw lastError;
        }

        // Check if it's a server-side timeout (504) or gateway error (502/503)
        const isGatewayError = msg.includes('502') || msg.includes('503') || msg.includes('504');
        const isRateLimit = msg.includes('429');

        // On last attempt, give up
        if (attempt >= maxRetries) {
          throw lastError;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
        // Gateway errors wait a bit longer on first retry
        const baseDelay = isGatewayError ? 3000 : 1000;
        const delay = baseDelay * Math.pow(2, attempt);

        const reason = isGatewayError ? '服务端繁忙（504 Gateway Timeout）' : isRateLimit ? '请求频率限制（429）' : '临时网络错误';
        const estimatedWait = isGatewayError
          ? 'Kimi Code 生成代码较慢，每次请求可能需要 3-10 分钟'
          : '';
        console.log(`   🔄 ${this.name} ${reason}，${estimatedWait}`);
        console.log(`      第 ${attempt + 1}/${maxRetries} 次重试，${delay / 1000}秒后再次尝试...`);
        console.log(`      建议：配置 DeepSeek 作为备用 provider，避免单点故障`);
        console.log(`      kele config --provider deepseek --key <key> --url https://api.deepseek.com/v1 --model deepseek-chat`);
        await sleep(delay);
      }
    }

    throw lastError ?? new Error(`${this.name} API call failed after ${maxRetries + 1} attempts`);
  }

  private async executeOnce(prompt: string): Promise<string> {
    const timeoutMs = (this.config.timeout ?? 1800) * 1000; // default 30 min per task
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
