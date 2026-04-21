import type { AIAdapter } from './base.js';
import type { ProviderConfig } from '../config/index.js';
import { Agent } from 'undici';

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
  private agent: Agent;

  constructor(name: string, config: ProviderConfig) {
    this.name = name;
    this.config = config;
    const timeoutSeconds = config.timeout ?? 3000;
    const timeoutMs = timeoutSeconds * 1000;
    this.agent = new Agent({
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
    });
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }

  getModelInfo(): { name: string; maxTokens?: number } {
    return {
      name: this.config.model,
      maxTokens: this.config.maxTokens,
    };
  }

  /**
   * Test if the API connection actually works by sending a minimal request.
   * Returns { ok: true } on success, { ok: false, error: string } on failure.
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    if (!this.isAvailable()) {
      return { ok: false, error: 'API key not configured' };
    }
    try {
      const response = await fetch(`${this.config.baseURL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(this.config.headers || {}),
        },
      });
      if (response.ok) {
        return { ok: true };
      }
      const text = await response.text().catch(() => '');
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Execute a prompt with automatic retry and timeout.
   *
   * When onToken is provided, uses streaming mode (stream: true) to avoid
   * gateway timeouts (504). Data flows continuously as SSE, so the connection
   * stays alive even during long generations (3-10 min for code).
   *
   * Retry strategy:
   * - 401/403: No retry (auth failure)
   * - 429: Retry with exponential backoff
   * - 502/503/504: Retry more aggressively (server-side transient errors)
   * - Network errors: Retry
   *
   * @param prompt - The prompt to send
   * @param onToken - Optional callback for real-time token streaming
   * @returns The response text from the AI
   */
  async execute(prompt: string, onToken?: (token: string) => void): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error(
        `${this.name} API key not configured. Run \`kele config --provider ${this.name}\` to set it up.`
      );
    }

    const maxRetries = 2; // 3 attempts total
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeOnce(prompt, onToken);
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

        // Exponential backoff
        // For gateway errors with streaming, this usually means the upstream
        // is genuinely overloaded. Wait longer.
        const baseDelay = isGatewayError ? 5000 : 1000;
        const delay = baseDelay * Math.pow(2, attempt);

        const reason = isGatewayError
          ? '服务端响应慢（可能 AI 正在生成中，但网关超时断开）'
          : isRateLimit
            ? '请求频率限制（429）'
            : '临时网络错误';

        console.log(`   🔄 ${this.name} ${reason}`);
        if (isGatewayError && onToken) {
          console.log(`      💡 已启用流式传输，通常可避免此问题。若仍出现，说明上游确实过载。`);
        }
        console.log(`      第 ${attempt + 1}/${maxRetries} 次重试，${delay / 1000}秒后再次尝试...`);
        console.log(`      建议：配置 DeepSeek 作为备用 provider，避免单点故障`);
        console.log(`      kele config --provider deepseek --key <key> --url https://api.deepseek.com/v1 --model deepseek-chat`);
        await sleep(delay);
      }
    }

    throw lastError ?? new Error(`${this.name} API call failed after ${maxRetries + 1} attempts`);
  }

  private async executeOnce(prompt: string, onToken?: (token: string) => void): Promise<string> {
    // kele principle: wait as long as the user configures. Default 50 min to avoid 5-min Node.js fetch cutoff.
    const controller = new AbortController();

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
      temperature: this.config.temperature ?? 0.3,
    };

    if (this.config.maxTokens) {
      body.max_tokens = this.config.maxTokens;
    }

    // Use streaming when onToken callback is provided
    const useStreaming = !!onToken;
    if (useStreaming) {
      body.stream = true;
    }

    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      dispatcher: this.agent,
    } as RequestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${this.name} API error (${response.status}): ${errorText}`);
    }

    if (useStreaming) {
      return await this.parseStream(response, onToken!);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? '';
  }

  /**
   * Parse an SSE (Server-Sent Events) stream from OpenAI-compatible API.
   * Collects all tokens into a single response string.
   */
  private async parseStream(response: Response, onToken: (token: string) => void): Promise<string> {
    if (!response.body) {
      throw new Error(`${this.name} streaming response has no body`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let tokenCount = 0;
    let firstTokenTime: number | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trimStart(); // Remove 'data:' prefix, optional space

          if (data === '[DONE]') {
            continue; // End of stream marker
          }

          try {
            const chunk = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string | null;
              }>;
            };

            const choice = chunk.choices?.[0];
            const delta = choice?.delta?.content;
            if (delta) {
              content += delta;
              tokenCount++;
              if (firstTokenTime === null) {
                firstTokenTime = Date.now();
              }
              onToken(delta);
            }

            // Detect content filtering or length truncation
            const finishReason = choice?.finish_reason;
            if (finishReason === 'content_filter') {
              throw new Error(`${this.name} API response was blocked by content filter`);
            }
            if (finishReason === 'length') {
              throw new Error(`${this.name} API response was truncated due to max_tokens limit — increase maxTokens in config`);
            }
          } catch (err) {
            // Re-throw our own errors; ignore malformed JSON
            if (err instanceof Error && (err.message.includes('content filter') || err.message.includes('truncated'))) {
              throw err;
            }
            // Ignore malformed JSON lines (e.g. keep-alive pings)
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:') && trimmed.slice(5).trimStart() !== '[DONE]') {
          try {
            const chunk = JSON.parse(trimmed.slice(5).trimStart()) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              content += delta;
              tokenCount++;
              onToken(delta);
            }
          } catch {
            // Ignore
          }
        }
      }

      if (firstTokenTime !== null) {
        const elapsed = ((Date.now() - firstTokenTime) / 1000).toFixed(1);
        console.log(`      ✅ 流式生成完成，共 ${tokenCount} 个 token，用时 ${elapsed} 秒`);
      }

      return content;
    } finally {
      reader.releaseLock();
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
