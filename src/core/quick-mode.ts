/**
 * QuickModeEngine — fast single-file game generator for simple ideas.
 *
 * Delegates code generation to QuickGenerate (whole-file + vm.Script validation + retry).
 * No per-function patching — avoids infinite-loop bugs from false positives.
 */

import { ProviderFallback } from './provider-fallback.js';
import { PlayabilityValidator, type PlayabilityResult } from './playability-validator.js';
import { QuickGenerate } from './quick-generate.js';

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
   * Delegates to QuickGenerate for whole-file generation + syntax validation.
   */
  async execute(userInput: string): Promise<{ success: boolean; filePath: string; error?: string }> {
    const generator = new QuickGenerate(this.fallback, this.projectRoot);
    const result = await generator.generate(userInput);
    return {
      success: result.success,
      filePath: result.filePath,
      error: result.error,
    };
  }

  /**
   * Validate the generated index.html for playability.
   */
  async validate(): Promise<PlayabilityResult> {
    const validator = new PlayabilityValidator(this.projectRoot);
    return validator.validate('index.html');
  }
}
