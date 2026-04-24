/**
 * QuickGenerate — whole-file game generator with syntax validation & retry.
 *
 * Replaces the previous FunctionLevelFixer approach:
 * - Generates the full HTML file in one shot
 * - Validates JS syntax with vm.Script
 * - On syntax failure: discards the file and re-generates from scratch (up to 2 retries)
 * - No per-function patching (avoids infinite-loop bugs from false positives)
 */

import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { Script } from 'vm';
import { ProviderFallback } from './provider-fallback.js';
import { debugLog } from '../debug.js';

export interface QuickGenerateResult {
  success: boolean;
  filePath: string;
  error?: string;
  attempts: number;
}

export class QuickGenerate {
  constructor(private fallback: ProviderFallback, private projectRoot: string) {}

  /**
   * Generate a single-file HTML5 game.
   * Attempts up to 3 times (1 initial + 2 retries on syntax error).
   */
  async generate(userInput: string): Promise<QuickGenerateResult> {
    const filePath = join(this.projectRoot, 'index.html');

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const prompt = this.buildPrompt(userInput, attempt > 1);
        debugLog('QuickGenerate attempt', String(attempt));
        debugLog('QuickGenerate prompt', prompt.slice(0, 200));

        let tokenCount = 0;
        const rawCode = await this.fallback.execute(prompt, (_token: string) => {
          tokenCount++;
          if (tokenCount % 100 === 0) {
            process.stdout.write('.');
          }
        });
        if (tokenCount >= 100) process.stdout.write('\n');

        debugLog('QuickGenerate raw response length', String(rawCode.length));

        const code = this.extractCode(rawCode);
        if (!code || code.length < 100) {
          if (attempt === 3) {
            return {
              success: false,
              filePath: '',
              error: 'AI returned empty or too short code',
              attempts: attempt,
            };
          }
          continue;
        }

        await mkdir(this.projectRoot, { recursive: true });
        await writeFile(filePath, code, 'utf-8');

        // vm.Script syntax validation — mandatory
        const scriptMatches = code.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
        let allScripts = '';
        for (const match of scriptMatches) {
          allScripts += match[1] + '\n';
        }

        if (allScripts.trim().length > 0) {
          try {
            new Script(allScripts);
            debugLog('QuickGenerate syntax check', 'passed');
            return { success: true, filePath, attempts: attempt };
          } catch (syntaxErr) {
            const msg = syntaxErr instanceof Error ? syntaxErr.message : String(syntaxErr);
            debugLog('QuickGenerate syntax error', msg);
            if (attempt === 3) {
              return {
                success: false,
                filePath: '',
                error: `Syntax error after ${attempt} attempts: ${msg}`,
                attempts: attempt,
              };
            }
            // Continue to next retry — prompt already includes error warning
          }
        } else {
          // No inline scripts — might be external, accept as-is
          return { success: true, filePath, attempts: attempt };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog('QuickGenerate error', msg);
        if (attempt === 3) {
          return { success: false, filePath: '', error: msg, attempts: attempt };
        }
      }
    }

    return { success: false, filePath: '', error: 'Max attempts reached', attempts: 3 };
  }

  /**
   * Build a minimal prompt. On retry, adds a warning about prior syntax errors.
   */
  private buildPrompt(userInput: string, isRetry: boolean): string {
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
      return (
        base +
        '\n\n⚠️ 上一轮生成的代码存在 JavaScript 语法错误。请务必仔细检查代码，确保没有未闭合的括号、引号或其他语法问题。'
      );
    }
    return base;
  }

  /**
   * Extract raw HTML from various AI response formats.
   */
  private extractCode(raw: string): string {
    // Markdown code block: ```html ... ```
    const htmlMatch = raw.match(/```html\n?([\s\S]*?)```/);
    if (htmlMatch) return htmlMatch[1].trim();

    // Generic markdown code block: ``` ... ```
    const genericMatch = raw.match(/```\n?([\s\S]*?)```/);
    if (genericMatch) return genericMatch[1].trim();

    // JSON wrapper with files array
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
      // not JSON — ignore
    }

    return raw.trim();
  }
}
