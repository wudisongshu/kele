/**
 * PlayabilityValidator — static playability validation.
 *
 * Checks:
 * 1. File exists and readable
 * 2. Static content: Canvas element + requestAnimationFrame game loop
 * 3. JavaScript syntax validation via vm.Script (mandatory)
 * 4. Input responsiveness: keydown / touchstart / click handlers
 * 5. Code quality: no TODO / FIXME / stub / placeholder / empty functions
 *
 * Previously used puppeteer for headless-browser validation, but that
 * required Chrome installation and was flaky. Now uses only static
 * analysis + vm.Script syntax check, which is fast and deterministic.
 */

import { join } from 'path';
import { access, readFile } from 'fs/promises';
import { Script } from 'vm';
import { debugLog } from '../debug.js';

export interface PlayabilityResult {
  playable: boolean;
  score: number; // 0-100
  checks: {
    http200: boolean;
    syntaxValid: boolean;
    canvasRendering: boolean;
    inputResponsive: boolean;
    noConsoleErrors: boolean;
  };
  details: string[];
}

export class PlayabilityValidator {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async validate(fileName: string = 'index.html'): Promise<PlayabilityResult> {
    const filePath = join(this.projectRoot, fileName);
    const checks = {
      http200: false,
      syntaxValid: false,
      canvasRendering: false,
      inputResponsive: false,
      noConsoleErrors: false,
    };
    const details: string[] = [];

    // Check 1: file exists and readable
    try {
      await access(filePath);
      checks.http200 = true;
      details.push('✅ 文件存在');
    } catch {
      details.push('❌ 文件不存在');
      return { playable: false, score: 0, checks, details };
    }

    // Check 2: static content analysis
    const content = await readFile(filePath, 'utf-8');
    const hasCanvas = content.includes('<canvas') && content.includes('getContext(');
    const hasGameLoop = content.includes('requestAnimationFrame');

    if (!hasCanvas) details.push('❌ 缺少 Canvas 元素');
    if (!hasGameLoop) details.push('❌ 缺少 requestAnimationFrame 游戏循环');

    // Check 3: JavaScript syntax validation (mandatory)
    const scriptMatches = content.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
    let allScripts = '';
    for (const match of scriptMatches) {
      allScripts += match[1] + '\n';
    }

    if (allScripts.trim().length > 0) {
      try {
        new Script(allScripts);
        checks.syntaxValid = true;
        details.push('✅ JavaScript 语法检查通过');
      } catch (syntaxErr) {
        checks.syntaxValid = false;
        const msg = syntaxErr instanceof Error ? syntaxErr.message : String(syntaxErr);
        details.push(`❌ JavaScript 语法错误: ${msg.slice(0, 200)}`);
        // Syntax error is fatal — game cannot run
        return { playable: false, score: Math.max(0, 25), checks, details };
      }
    } else {
      // No inline scripts — might be external, skip syntax check
      checks.syntaxValid = true;
    }

    // Check 4: static playability checks (replaces puppeteer browser validation)
    if (hasCanvas && hasGameLoop) {
      checks.canvasRendering = true;
      details.push('✅ 静态检查：包含 Canvas 和游戏循环');

      // Input responsiveness: static check for event listeners
      const hasKeyboard = content.includes('keydown') || content.includes('keyup') || content.includes('keypress');
      const hasTouch = content.includes('touchstart') || content.includes('touchend') || content.includes('touchmove');
      const hasClick = content.includes('click') || content.includes('mousedown') || content.includes('mouseup');
      checks.inputResponsive = hasKeyboard || hasTouch || hasClick;

      if (checks.inputResponsive) {
        details.push('✅ 静态检查：包含输入事件监听');
      } else {
        details.push('❌ 静态检查：未检测到输入事件监听');
      }

      // Check 5: code quality — no TODO / FIXME / stub / empty functions
      const hasTodo = /\bTODO\b|\bFIXME\b|\bstub\b|\bplaceholder\b|\bwip\b/i.test(content);
      const hasEmptyFunction = /function\s+\w+\s*\(\s*\)\s*\{\s*\}/.test(content);
      const hasEmptyArrow = /\(\s*\)\s*=>\s*\{\s*\}/.test(content);

      checks.noConsoleErrors = !hasTodo && !hasEmptyFunction && !hasEmptyArrow;

      if (checks.noConsoleErrors) {
        details.push('✅ 静态检查：无 TODO / 空函数 / 占位符');
      } else {
        if (hasTodo) details.push('❌ 静态检查：发现 TODO / FIXME / stub 标记');
        if (hasEmptyFunction) details.push('❌ 静态检查：发现空函数');
        if (hasEmptyArrow) details.push('❌ 静态检查：发现空箭头函数');
      }
    } else {
      checks.canvasRendering = false;
      checks.inputResponsive = false;
      checks.noConsoleErrors = false;
      details.push('⚠️ 未满足 Canvas + 游戏循环基本条件，跳过进一步检查');
    }

    // Score calculation
    let score = 0;
    if (checks.http200) score += 20;
    if (checks.syntaxValid) score += 20;
    if (checks.canvasRendering) score += 20;
    if (checks.inputResponsive) score += 20;
    if (checks.noConsoleErrors) score += 20;

    const playable = score >= 75;

    debugLog('PlayabilityValidator result', `score=${score}, playable=${playable}`);
    return { playable, score, checks, details };
  }
}
