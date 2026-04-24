/**
 * QuickModeEngine — fast single-file game generator for simple ideas.
 *
 * When the user asks for a simple game/tool (e.g. Tetris, Snake, 2048),
 * skip the heavy AI Incubator pipeline and generate a single index.html
 * directly. Falls back to Incubator on failure or complex requests.
 */

import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { ProviderFallback } from './provider-fallback.js';
import { PlayabilityValidator, type PlayabilityResult } from './playability-validator.js';
import { FunctionLevelFixer } from './function-level-fixer.js';
import { debugLog } from '../debug.js';

export class QuickModeEngine {
  private fallback: ProviderFallback;
  private projectRoot: string;

  constructor(fallback: ProviderFallback, projectRoot: string) {
    this.fallback = fallback;
    this.projectRoot = projectRoot;
  }

  /**
   * Determine whether the user input describes a simple game/tool.
   *
   * Rules:
   * - Contains simple-game keywords (tetris, snake, break-out, 2048, etc.)
   * - Does NOT contain complex keywords (platform, mini-program, payment,
   *   user system, leaderboard, multiplayer, backend, database, etc.)
   */
  isSimpleGame(input: string): boolean {
    const lower = input.toLowerCase();

    const simpleKeywords = [
      '游戏', '方块', '贪吃蛇', '打砖块', '弹球', 'flappy', 'bird',
      '2048', '猜数字', '计算器', 'todo', '待办', '时钟', '天气',
      '汇率', '工具', 'tetris', 'snake', 'breakout', 'pong', 'ball',
      'puzzle', 'minesweeper', '扫雷', 'pacman', '吃豆人',
    ];

    const complexKeywords = [
      '小程序', '支付', '用户系统', '排行榜', '多人', '后端', '数据库',
      '服务器', '登录', '注册', '社交', '聊天', '直播', '电商', '商城',
      '部署到', '接入广告', '变现', '平台', 'backend', 'database',
      'server', 'multiplayer', 'login', 'auth', 'payment', 'leaderboard',
      'deploy', 'monetize', 'advertisement', 'ads',
    ];

    const hasSimple = simpleKeywords.some((k) => lower.includes(k));
    const hasComplex = complexKeywords.some((k) => lower.includes(k));

    return hasSimple && !hasComplex;
  }

  /**
   * Execute the quick-mode generation pipeline.
   */
  async execute(userInput: string): Promise<{ success: boolean; filePath: string; error?: string }> {
    try {
      // 1. Build minimal prompt
      const prompt = this.buildPrompt(userInput);
      debugLog('QuickMode prompt', prompt);

      // 2. Call AI (with automatic provider failover, streaming for long generations)
      let tokenCount = 0;
      const rawCode = await this.fallback.execute(prompt, (_token: string) => {
        tokenCount++;
        if (tokenCount % 100 === 0) {
          process.stdout.write('.');
        }
      });
      if (tokenCount >= 100) process.stdout.write('\n');
      debugLog('QuickMode raw response length', String(rawCode.length));

      // 3. Extract code from markdown / JSON wrappers
      const code = this.extractCode(rawCode);

      if (!code || code.length < 100) {
        return { success: false, filePath: '', error: 'AI returned empty or too short code' };
      }

      // 4. Write to disk
      const filePath = join(this.projectRoot, 'index.html');
      await mkdir(this.projectRoot, { recursive: true });
      await writeFile(filePath, code, 'utf-8');

      // 5. Syntax pre-check: catch JS syntax errors before stub fixing
      const fixer = new FunctionLevelFixer(this.fallback.getPrimary());
      const syntaxCheck = await fixer.preCheckSyntax(filePath);
      if (!syntaxCheck.valid) {
        console.log(`❌ 检测到语法错误: ${syntaxCheck.error?.slice(0, 100)}`);
        if (syntaxCheck.line) {
          console.log(`   错误位置: 第 ${syntaxCheck.line} 行附近`);
        }
        console.log('🔧 尝试修复语法错误...');
        const syntaxFixed = await fixer.fixSyntaxError(
          filePath,
          syntaxCheck.error ?? 'Unknown syntax error',
          syntaxCheck.line,
          userInput,
        );
        if (!syntaxFixed) {
          return { success: false, filePath: '', error: `语法错误修复失败: ${syntaxCheck.error}` };
        }
        console.log('✅ 语法错误已修复');
      }

      // 6. Fix any stub functions before validation
      const fixed = await fixer.fixFile(filePath, userInput, 3);
      if (!fixed) {
        debugLog('QuickMode fixer', '部分空函数未能自动修复');
      }

      return { success: true, filePath };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('QuickMode execute error', msg);
      return { success: false, filePath: '', error: msg };
    }
  }

  /**
   * Validate the generated index.html for playability.
   */
  async validate(): Promise<PlayabilityResult> {
    const validator = new PlayabilityValidator(this.projectRoot);
    return validator.validate('index.html');
  }

  /**
   * Build a minimal prompt, kept under ~500 tokens.
   */
  private buildPrompt(userInput: string): string {
    return `你是一个前端游戏开发专家。请根据以下需求，生成一个完整的、可玩的 HTML5 游戏。

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
