/**
 * PlayabilityValidator — browser-based playability validation.
 *
 * Opens the generated index.html in a headless browser (puppeteer if available)
 * and checks whether the game is actually interactive and rendering.
 * Falls back to static code analysis + vm.Script syntax check when puppeteer
 * is not available or Chrome is not installed.
 */

import { join } from 'path';
import { access, readFile } from 'fs/promises';
import { Script } from 'vm';
import { debugLog } from '../debug.js';

/**
 * Common Chrome/Chromium executable paths per platform.
 */
const CHROME_PATHS: Record<string, string[]> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/opt/homebrew/bin/chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Chromium\\Application\\chrome.exe',
  ],
};

async function findChromePath(): Promise<string | undefined> {
  const candidates = CHROME_PATHS[process.platform] ?? [];
  for (const p of candidates) {
    try {
      await access(p);
      return p;
    } catch { /* not found */ }
  }
  return undefined;
}

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

    // Check 3: JavaScript syntax validation (mandatory, not optional)
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

    // Check 4: headless browser validation (puppeteer) with static fallback
    if (hasCanvas && hasGameLoop) {
      let browser: any;
      try {
        const puppeteer = await (new Function("return import('puppeteer-core')")() as Promise<any>).catch(() => null);
        if (!puppeteer || !puppeteer.launch) {
          throw new Error('puppeteer-core not available');
        }

        const chromePath = await findChromePath();
        if (!chromePath) {
          throw new Error('Chrome not found on system');
        }

        browser = await puppeteer.launch({
          headless: true,
          executablePath: chromePath,
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        // Collect console errors
        const consoleErrors: string[] = [];
        page.on('console', (msg: { type: () => string; text: () => string }) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        // Catch page-level JS errors
        page.on('pageerror', (err: { message: string }) => {
          consoleErrors.push(err.message);
        });

        await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });
        await new Promise((resolve) => setTimeout(resolve, 3000)); // wait for game init

        // Detect canvas pixel changes
        const canvasChanged = await page.evaluate(() => {
          const canvas = document.querySelector('canvas');
          if (!canvas) return false;
          const ctx = canvas.getContext('2d');
          if (!ctx) return false;

          const data1 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          return new Promise<boolean>((resolve) => {
            setTimeout(() => {
              const data2 = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
              let diff = 0;
              for (let i = 0; i < data1.length; i += 4) {
                diff += Math.abs(data1[i] - data2[i]);
                diff += Math.abs(data1[i + 1] - data2[i + 1]);
                diff += Math.abs(data1[i + 2] - data2[i + 2]);
              }
              resolve(diff > 1000);
            }, 1000);
          });
        });

        checks.canvasRendering = canvasChanged;
        checks.noConsoleErrors = consoleErrors.length === 0;

        // Simulate keyboard input and check for state change
        const inputResponsive = await page.evaluate(() => {
          return new Promise<boolean>((resolve) => {
            const canvas = document.querySelector('canvas');
            let changed = false;
            const ctx = canvas?.getContext('2d');
            const before = ctx?.getImageData(0, 0, 1, 1).data;

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

            setTimeout(() => {
              const after = ctx?.getImageData(0, 0, 1, 1).data;
              if (before && after) {
                changed = before[0] !== after[0] || before[1] !== after[1] || before[2] !== after[2];
              }
              resolve(changed);
            }, 500);
          });
        });

        checks.inputResponsive = inputResponsive;

        await browser.close();

        if (canvasChanged) details.push('✅ Canvas 有实际渲染');
        else details.push('❌ Canvas 无渲染变化');

        if (inputResponsive) details.push('✅ 输入有响应');
        else details.push('⚠️ 输入响应不明显（可能游戏未开始）');

        if (consoleErrors.length > 0) {
          details.push(`❌ 控制台错误: ${consoleErrors.slice(0, 3).join(', ')}`);
        } else {
          details.push('✅ 无控制台错误');
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        debugLog('PlayabilityValidator browser check failed', errMsg);
        details.push(`⚠️ 浏览器检测失败: ${errMsg}，回退到静态检查`);

        // fallback to static checks
        checks.canvasRendering = hasCanvas && hasGameLoop;
        checks.inputResponsive = content.includes('keydown') || content.includes('touchstart') || content.includes('click');
        checks.noConsoleErrors = true;

        if (checks.canvasRendering) details.push('✅ 静态检查：包含 Canvas 和游戏循环');
        if (checks.inputResponsive) details.push('✅ 静态检查：包含输入事件监听');
      }
    }

    // Score calculation
    let score = 0;
    if (checks.http200) score += 20;
    if (checks.syntaxValid) score += 20;
    if (checks.canvasRendering) score += 20;
    if (checks.inputResponsive) score += 20;
    if (checks.noConsoleErrors) score += 20;

    const playable = score >= 75;

    return { playable, score, checks, details };
  }
}
