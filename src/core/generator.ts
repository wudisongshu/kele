/**
 * GameGenerator — whole-file HTML5 game generator with syntax validation & retry.
 *
 * Core flow:
 * 1. Build prompt from user input
 * 2. Call AI provider (with streaming for long generations)
 * 3. Extract HTML from markdown/JSON wrappers
 * 4. Write to disk
 * 5. Validate JS syntax via vm.Script
 * 6. On syntax failure: discard and regenerate (up to 2 retries)
 *
 * No per-function patching — avoids infinite-loop bugs from false positives.
 */

import { join } from 'path';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { Script } from 'vm';
import type { AIAdapter } from '../ai/provider.js';
import { debugLog } from '../utils/logger.js';
import { injectPWATags, generatePWA } from '../pwa/generator.js';

export interface GenerateResult {
  success: boolean;
  filePath: string;
  error?: string;
  attempts: number;
  gameTitle?: string;
}

export interface GeneratorOptions {
  /** Max retry attempts on syntax error (default: 3) */
  maxAttempts?: number;
  /** Minimum code length to accept (default: 100) */
  minCodeLength?: number;
}

export class GameGenerator {
  private provider: AIAdapter;
  private projectRoot: string;
  private options: Required<GeneratorOptions>;

  constructor(provider: AIAdapter, projectRoot: string, options: GeneratorOptions = {}) {
    this.provider = provider;
    this.projectRoot = projectRoot;
    this.options = {
      maxAttempts: options.maxAttempts ?? 3,
      minCodeLength: options.minCodeLength ?? 100,
    };
  }

  /**
   * Generate a single-file HTML5 game.
   */
  async generate(userInput: string): Promise<GenerateResult> {
    const filePath = join(this.projectRoot, 'index.html');

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      const result = await this.attemptGenerate(userInput, filePath, attempt);
      if (result.success || attempt === this.options.maxAttempts) {
        if (result.success) {
          const html = await readFile(filePath, 'utf-8');
          const gameTitle = extractGameTitle(html) || userInput;
          await this.injectPWA(gameTitle, userInput);
          return { ...result, gameTitle };
        }
        return result;
      }
    }

    return { success: false, filePath: '', error: 'Max attempts reached', attempts: this.options.maxAttempts };
  }

  private async injectPWA(gameTitle: string, userInput: string): Promise<void> {
    try {
      const filePath = join(this.projectRoot, 'index.html');
      const html = await readFile(filePath, 'utf-8');
      const injected = injectPWATags(html);
      await writeFile(filePath, injected, 'utf-8');

      await generatePWA(this.projectRoot, {
        name: gameTitle,
        shortName: gameTitle.slice(0, 12),
        description: userInput,
      });

      debugLog('generator:pwa', 'PWA assets generated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('generator:pwa-error', msg);
    }
  }

  private async attemptGenerate(
    userInput: string,
    filePath: string,
    attempt: number,
  ): Promise<GenerateResult> {
    try {
      const prompt = buildGamePrompt(userInput, attempt > 1);
      debugLog('generator', `attempt=${attempt}`);
      debugLog('generator:prompt', prompt.slice(0, 200));

      let tokenCount = 0;
      const rawCode = await this.provider.execute(prompt, (_token: string) => {
        tokenCount++;
        if (tokenCount % 100 === 0) process.stdout.write('.');
      });
      if (tokenCount >= 100) process.stdout.write('\n');

      debugLog('generator:raw-length', String(rawCode.length));

      const code = extractCode(rawCode);
      if (!code || code.length < this.options.minCodeLength) {
        return { success: false, filePath: '', error: 'AI returned empty or too short code', attempts: attempt };
      }

      await mkdir(this.projectRoot, { recursive: true });
      await writeFile(filePath, code, 'utf-8');

      // vm.Script syntax validation — mandatory
      const syntaxResult = validateSyntax(code);
      if (syntaxResult.valid) {
        debugLog('generator:syntax', 'passed');
        return { success: true, filePath, attempts: attempt };
      }

      debugLog('generator:syntax-error', syntaxResult.error ?? 'unknown');
      return { success: false, filePath: '', error: `Syntax error: ${syntaxResult.error}`, attempts: attempt };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('generator:error', msg);
      return { success: false, filePath: '', error: msg, attempts: attempt };
    }
  }
}

/**
 * Validate JavaScript syntax inside <script> tags using vm.Script.
 */
export function validateSyntax(html: string): { valid: boolean; error?: string } {
  const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
  let allScripts = '';
  for (const match of scriptMatches) {
    allScripts += match[1] + '\n';
  }

  if (allScripts.trim().length === 0) {
    return { valid: true };
  }

  try {
    new Script(allScripts);
    return { valid: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: msg };
  }
}

/**
 * Build a game generation prompt. On retry, adds a warning about prior syntax errors.
 */
export function buildGamePrompt(userInput: string, isRetry: boolean): string {
  const base = `你是一个前端游戏开发专家。请根据以下需求，生成一个完整的、可玩的 HTML5 游戏。

需求：${userInput}

要求：
1. 所有代码（HTML + CSS + JavaScript）必须内嵌在一个 index.html 文件中
2. 使用 HTML5 Canvas 进行渲染
3. 游戏必须完整可玩：有开始界面、核心玩法、计分系统、游戏结束/重新开始
4. 支持键盘控制（方向键 + 空格），如果是移动端游戏还要支持触摸控制
5. 代码中不允许有任何 TODO 注释、空函数、占位符（stub）或 "wip" 标记
6. 每个函数必须有完整的实现逻辑，不能只有函数签名
7. 使用 requestAnimationFrame 实现游戏循环
8. 返回格式：直接返回完整的 HTML 代码字符串，不要包裹在 markdown 代码块中

DEATH LINE: 如果输出包含空函数或 TODO，任务将被拒绝并重写。`;

  if (isRetry) {
    return base + '\n\n⚠️ 上一轮生成的代码存在 JavaScript 语法错误。请务必仔细检查代码，确保没有未闭合的括号、引号或其他语法问题。';
  }
  return base;
}

/**
 * Extract game title from generated HTML <title> tag.
 */
export function extractGameTitle(html: string): string | null {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match ? match[1].trim() || null : null;
}

/**
 * Extract raw HTML from various AI response formats.
 */
export function extractCode(raw: string): string {
  const htmlMatch = raw.match(/```html\n?([\s\S]*?)```/);
  if (htmlMatch) return htmlMatch[1].trim();

  const genericMatch = raw.match(/```\n?([\s\S]*?)```/);
  if (genericMatch) return genericMatch[1].trim();

  try {
    const json = JSON.parse(raw);
    if (json.files && Array.isArray(json.files) && json.files[0]?.content) {
      return json.files[0].content;
    }
    if (json.content && typeof json.content === 'string') {
      return json.content;
    }
    if (json.code && typeof json.code === 'string') {
      return json.code;
    }
  } catch {
    // not JSON
  }

  return raw.trim();
}
