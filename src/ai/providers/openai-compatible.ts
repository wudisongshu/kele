/**
 * OpenAI-Compatible AI Adapter
 *
 * Works with any API that follows OpenAI's chat completions format:
 * - Kimi (Moonshot), Kimi Code, DeepSeek, Qwen, OpenAI, etc.
 */

import type { AIAdapter } from '../provider.js';
import type { ProviderConfig } from '../../config/types.js';
import { Agent } from 'undici';

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

  async execute(prompt: string, onToken?: (token: string) => void): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error(
        `${this.name} API key not configured. Run \`kele config --provider ${this.name}\` to set it up.`
      );
    }

    const maxRetries = 2;
    let lastError: Error | undefined;
    let hasReceivedTokens = false;

    // Wrap onToken to track whether the stream has started
    const wrappedOnToken = onToken
      ? (token: string) => {
          hasReceivedTokens = true;
          onToken(token);
        }
      : undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeOnce(prompt, wrappedOnToken);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;

        if (msg.includes('401') || msg.includes('403')) {
          throw lastError;
        }

        // If stream already started, do NOT retry — AI is generating,
        // and retrying would restart from scratch. Better to surface the error.
        if (hasReceivedTokens) {
          throw lastError;
        }

        const isGatewayError = msg.includes('502') || msg.includes('503') || msg.includes('504');
        const isRateLimit = msg.includes('429');

        if (attempt >= maxRetries) {
          throw lastError;
        }

        const baseDelay = isGatewayError ? 5000 : 1000;
        const delay = baseDelay * Math.pow(2, attempt);
        const reason = isGatewayError
          ? '服务端响应慢'
          : isRateLimit
            ? '请求频率限制（429）'
            : '临时网络错误';

        console.log(`   🔄 ${this.name} ${reason}，${delay / 1000}秒后重试...`);
        await sleep(delay);
      }
    }

    throw lastError ?? new Error(`${this.name} API call failed after ${maxRetries + 1} attempts`);
  }

  private async executeOnce(prompt: string, onToken?: (token: string) => void): Promise<string> {
    const controller = new AbortController();

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

    body.max_tokens = this.config.maxTokens ?? 100000;

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
      throw new Error(`${this.name} API error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    if (useStreaming) {
      return await this.parseStream(response, onToken!);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? '';
  }

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
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trimStart();
          if (data === '[DONE]') continue;

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

            const finishReason = choice?.finish_reason;
            if (finishReason === 'content_filter') {
              throw new Error(`${this.name} API response was blocked by content filter`);
            }
            if (finishReason === 'length') {
              throw new Error(`${this.name} API response was truncated due to max_tokens limit`);
            }
          } catch (err) {
            if (err instanceof Error && (err.message.includes('content filter') || err.message.includes('truncated'))) {
              throw err;
            }
          }
        }
      }

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
            // ignore
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
