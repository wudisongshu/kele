import { JSDOM } from 'jsdom';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { scorePlayability, type PlayabilityScore } from './game-playability.js';
import { validateContractCompliance, type Contract } from './contract-engine.js';
import { debugLog } from '../debug.js';

export interface BrowserValidationResult {
  playable: boolean;
  score: number; // 0-100
  errors: string[];
  details: {
    hasCanvas: boolean;
    canvasDrawn: boolean;
    hasGameLoop: boolean;
    hasInputHandler: boolean;
    jsErrors: string[];
    consoleLogs: string[];
  };
  playability?: PlayabilityScore;
}

export type GameProjectType = 'html-canvas' | 'html-dom' | 'framework' | 'miniprogram' | 'unknown';

/**
 * Detect the type of game project based on file structure.
 */
export function detectGameProjectType(targetDir: string): GameProjectType {
  const files = readdirSync(targetDir);

  // Check for mini-program manifests
  if (files.includes('game.json')) {
    return 'miniprogram';
  }

  // Check for framework projects
  if (files.includes('package.json')) {
    return 'framework';
  }

  // Check for HTML projects
  if (files.includes('index.html')) {
    const html = readFileSync(join(targetDir, 'index.html'), 'utf-8');
    if (html.includes('<canvas')) {
      return 'html-canvas';
    }
    return 'html-dom';
  }

  return 'unknown';
}

/**
 * Load an HTML file in a simulated browser (JSDOM) and validate
 * whether it renders a playable game.
 *
 * This catches:
 * - Blank pages (no canvas rendering)
 * - JavaScript runtime errors
 * - Missing game loops or input handlers
 * - Files that reference non-existent resources
 */
export async function validateGameInBrowser(targetDir: string, contract?: Contract, subProjectType?: string): Promise<BrowserValidationResult> {
  const result: BrowserValidationResult = {
    playable: false,
    score: 0,
    errors: [],
    details: {
      hasCanvas: false,
      canvasDrawn: false,
      hasGameLoop: false,
      hasInputHandler: false,
      jsErrors: [],
      consoleLogs: [],
    },
  };

  // --- Skip game validation for non-game sub-projects ---
  if (subProjectType === 'deployment' || subProjectType === 'monetization' || subProjectType === 'setup') {
    result.playable = true;
    result.score = 100;
    return result;
  }

  // --- Contract compliance check (before expensive JSDOM) ---
  if (contract) {
    const compliance = validateContractCompliance(contract, targetDir);
    if (!compliance.compliant) {
      for (const missingId of compliance.missing) {
        const mechanic = contract.coreMechanics.find((m) => m.id === missingId);
        result.errors.push(`契约验证失败: 缺少核心机制 "${mechanic?.description || missingId}"`);
      }
      result.playable = false;
      result.score = Math.max(0, 20 - compliance.missing.length * 10);
      return result;
    }
  }

  const projectType = detectGameProjectType(targetDir);

  // For framework and mini-program projects, we do static validation only
  // (JSDOM can't run React/Vue builds or mini-program environments)
  if (projectType === 'framework') {
    return validateFrameworkGame(targetDir, result);
  }
  if (projectType === 'miniprogram') {
    return validateMiniProgramGame(targetDir, result);
  }

  // For HTML games (canvas or DOM), run JSDOM validation
  const htmlResult = await validateHtmlGame(targetDir, result);

  // ui-polish: relax game-loop requirement (focus on styling/audio)
  if (subProjectType === 'ui-polish') {
    htmlResult.playable = htmlResult.details.hasCanvas || htmlResult.details.hasInputHandler;
    if (!htmlResult.playable) {
      htmlResult.errors.push('UI polish requires existing canvas or input handlers to enhance');
    }
    // Remove game-loop-specific errors for ui-polish
    htmlResult.errors = htmlResult.errors.filter(
      (e) => !e.includes('game loop') && !e.includes('No input handler'),
    );
  }

  return htmlResult;
}

function validateFrameworkGame(targetDir: string, result: BrowserValidationResult): BrowserValidationResult {
  const pkgPath = join(targetDir, 'package.json');
  if (!existsSync(pkgPath)) {
    result.errors.push('Framework project missing package.json');
    return result;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    // Check for build script
    if (scripts.build || scripts['build:prod']) {
      result.score += 30;
    } else {
      result.errors.push('No build script in package.json');
    }

    // Check for dev script
    if (scripts.dev || scripts.start) {
      result.score += 20;
    }

    // Check for source files
    const srcDir = join(targetDir, 'src');
    if (existsSync(srcDir)) {
      const srcFiles = readdirSync(srcDir, { recursive: true }) as string[];
      const jsFiles = srcFiles.filter((f) => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.jsx') || f.endsWith('.tsx'));
      if (jsFiles.length > 0) {
        result.score += 20;
      }
    }

    // Check for index.html
    if (existsSync(join(targetDir, 'index.html'))) {
      result.score += 10;
    }

    // Check for game-related dependencies
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const gameLibs = ['phaser', 'three', 'pixi.js', 'babylonjs', 'react', 'vue'];
    const hasGameLib = gameLibs.some((lib) => deps[lib]);
    if (hasGameLib) {
      result.score += 20;
    }

    result.playable = result.score >= 70;
    if (!result.playable) {
      result.errors.push(`Framework project validation: ${result.score}/100 — missing build scripts, source files, or game dependencies`);
    }
  } catch (err) {
    result.errors.push(`Failed to parse package.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

function validateMiniProgramGame(targetDir: string, result: BrowserValidationResult): BrowserValidationResult {
  const gameJsonPath = join(targetDir, 'game.json');
  if (!existsSync(gameJsonPath)) {
    result.errors.push('Mini-program project missing game.json');
    return result;
  }

  try {
    JSON.parse(readFileSync(gameJsonPath, 'utf-8'));
    result.score += 20; // Has manifest

    // Check for entry file
    const entryFiles = ['index.js', 'game.js', 'main.js'];
    const hasEntry = entryFiles.some((f) => existsSync(join(targetDir, f)));
    if (hasEntry) {
      result.score += 30;
    } else {
      result.errors.push('No entry file found (index.js, game.js, main.js)');
    }

    // Check for canvas creation in entry file
    for (const f of entryFiles) {
      const fpath = join(targetDir, f);
      if (existsSync(fpath)) {
        const content = readFileSync(fpath, 'utf-8');
        if (content.includes('createCanvas') || content.includes('getContext')) {
          result.score += 20;
          break;
        }
      }
    }

    // Check for game loop
    for (const f of entryFiles) {
      const fpath = join(targetDir, f);
      if (existsSync(fpath)) {
        const content = readFileSync(fpath, 'utf-8');
        if (content.includes('requestAnimationFrame') || content.includes('setInterval') || content.includes('loop')) {
          result.score += 20;
          break;
        }
      }
    }

    // Check for input handling
    for (const f of entryFiles) {
      const fpath = join(targetDir, f);
      if (existsSync(fpath)) {
        const content = readFileSync(fpath, 'utf-8');
        if (content.includes('onTouch') || content.includes('onClick') || content.includes('event')) {
          result.score += 10;
          break;
        }
      }
    }

    result.playable = result.score >= 70;
    if (!result.playable) {
      result.errors.push(`Mini-program validation: ${result.score}/100 — check game.json, entry file, canvas, and game loop`);
    }
  } catch (err) {
    result.errors.push(`Failed to parse game.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  return result;
}

/**
 * Extract all script content from an HTML file for static analysis.
 * Includes inline <script> blocks and external <script src="..."> files.
 * Supports one level of depth for dynamically referenced JS files.
 */
function extractHtmlScripts(html: string, targetDir: string): string {
  let combined = html;

  // 1. Extract inline <script>...</script> content (already in html, but keep for clarity)
  const inlineScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const tag of inlineScripts) {
    const content = tag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    combined += '\n' + content;
  }

  // 2. Read external <script src="..."> files
  const srcRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  const loadedPaths = new Set<string>();
  while ((match = srcRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && !src.startsWith('http') && !src.startsWith('//')) {
      const cleanSrc = src.replace(/^\.\//, '').replace(/^\//, '');
      const jsPath = join(targetDir, cleanSrc);
      if (existsSync(jsPath) && !loadedPaths.has(jsPath)) {
        loadedPaths.add(jsPath);
        try {
          const jsContent = readFileSync(jsPath, 'utf-8');
          combined += '\n' + jsContent;

          // 3. One-level deep: detect dynamically loaded JS files inside the loaded script
          const dynamicJsRegex = /["']([^"']+\.js)["']/g;
          let dynMatch: RegExpExecArray | null;
          while ((dynMatch = dynamicJsRegex.exec(jsContent)) !== null) {
            const dynSrc = dynMatch[1];
            if (dynSrc && !dynSrc.startsWith('http') && !dynSrc.startsWith('//')) {
              const dynCleanSrc = dynSrc.replace(/^\.\//, '').replace(/^\//, '');
              const dynPath = join(targetDir, dynCleanSrc);
              if (existsSync(dynPath) && !loadedPaths.has(dynPath)) {
                loadedPaths.add(dynPath);
                try {
                  combined += '\n' + readFileSync(dynPath, 'utf-8');
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  debugLog(`Game validator browser dyn script read failed: ${dynPath}`, msg);
                }
              }
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          debugLog('Game validator browser script match failed', msg);
        }
      }
    }
  }

  return combined;
}

async function validateHtmlGame(targetDir: string, result: BrowserValidationResult): Promise<BrowserValidationResult> {
  const htmlPath = join(targetDir, 'index.html');
  if (!existsSync(htmlPath)) {
    result.errors.push('No index.html found');
    return result;
  }

  const html = readFileSync(htmlPath, 'utf-8');

  // Check for PWA files
  const hasManifest = existsSync(join(targetDir, 'manifest.json'));
  const hasServiceWorker = existsSync(join(targetDir, 'sw.js'));
  if (hasManifest && hasServiceWorker) {
    result.score += 5; // Bonus for PWA support
  }

  // Check for canvas element before running JS
  if (!html.includes('<canvas')) {
    // For DOM games, check for game container
    if (!html.includes('id="game"') && !html.includes('class="game"')) {
      result.errors.push('No <canvas> or game container element in HTML');
    }
  } else {
    result.details.hasCanvas = true;
  }

  // Combine HTML with all inline and external script content for static analysis
  const allScriptContent = extractHtmlScripts(html, targetDir);

  // Check for game loop indicators in combined HTML + JS content
  const hasRAF = allScriptContent.includes('requestAnimationFrame');
  const hasInterval = /setInterval\s*\(/.test(allScriptContent);
  const hasTimeoutLoop = /setTimeout\s*\([^,]+,\s*\d+\s*\)/.test(allScriptContent);
  result.details.hasGameLoop = hasRAF || hasInterval || hasTimeoutLoop;

  // Check for input handlers in combined HTML + JS content
  const hasClick = allScriptContent.includes('click') || allScriptContent.includes('pointerdown') || allScriptContent.includes('mousedown');
  const hasTouch = allScriptContent.includes('touchstart') || allScriptContent.includes('touchend');
  const hasKey = allScriptContent.includes('keydown') || allScriptContent.includes('keyup') || allScriptContent.includes('keypress');
  result.details.hasInputHandler = hasClick || hasTouch || hasKey;

  // Run in JSDOM to catch runtime errors
  const jsErrors: string[] = [];
  const consoleLogs: string[] = [];

  try {
    // Create a mock 2D canvas context that satisfies common game canvas operations
    let drawCalls = 0;

    const mockCtx = {
      clearRect: () => {},
      fillRect: () => { drawCalls++; },
      strokeRect: () => { drawCalls++; },
      fillText: () => { drawCalls++; },
      strokeText: () => {},
      measureText: (text: string) => ({ width: (text?.length || 0) * 8 }),
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => { drawCalls++; },
      arcTo: () => {},
      bezierCurveTo: () => {},
      quadraticCurveTo: () => {},
      rect: () => {},
      ellipse: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      setTransform: () => {},
      transform: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createPattern: () => ({}),
      drawImage: () => { drawCalls++; },
      getImageData: () => ({ data: new Uint8ClampedArray(0) }),
      putImageData: () => {},
      createImageData: () => ({ data: new Uint8ClampedArray(0) }),
      clip: () => {},
      setLineDash: () => {},
      getLineDash: () => [],
      isPointInPath: () => false,
      isPointInStroke: () => false,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      lineCap: 'butt',
      lineJoin: 'miter',
      miterLimit: 10,
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      direction: 'ltr',
      shadowColor: '#000',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    };

    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      resources: 'usable',
      url: 'file://' + targetDir + '/',
      pretendToBeVisual: true,
      beforeParse(window: any) {
        // Track whether any input event handler actually runs
        window.__kele_eventHandlerRan = false;

        const origAddEventListener = window.EventTarget.prototype.addEventListener;
        window.EventTarget.prototype.addEventListener = function(type: string, handler: any, options?: any) {
          const wrapped = function(this: any, event: any) {
            if (
              type === 'click' || type === 'mousedown' || type === 'pointerdown' ||
              type === 'touchstart' || type === 'touchend' || type === 'touchmove' ||
              type === 'keydown' || type === 'keyup' || type === 'keypress'
            ) {
              window.__kele_eventHandlerRan = true;
            }
            if (typeof handler === 'function') {
              return handler.call(this, event);
            }
            if (handler && typeof handler.handleEvent === 'function') {
              return handler.handleEvent(event);
            }
          };
          return origAddEventListener.call(this, type, wrapped, options);
        };

        const proto = window.HTMLCanvasElement.prototype;
        const orig = proto.getContext;
        proto.getContext = function(contextId: string) {
          if (contextId === '2d') {
            return { ...mockCtx, canvas: this };
          }
          return orig.call(this, contextId);
        };
      },
    });

    const window = dom.window as unknown as Window & typeof globalThis;
    const doc = window.document;

    // Capture console errors and logs
    window.addEventListener('error', (e: ErrorEvent) => {
      const msg = e.message || '';
      if (msg.includes('HTMLCanvasElement') || msg.includes('getContext') || msg.includes('clearRect') || msg.includes('drawImage')) {
        return;
      }
      jsErrors.push(`[window.error] ${msg}`);
    });

    // Wait for scripts to initialize and register loops / listeners
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check if canvas element exists
    const canvas = doc.getElementById('c') as HTMLCanvasElement | null;
    if (!canvas) {
      const allCanvas = doc.querySelectorAll('canvas');
      if (allCanvas.length > 0) {
        result.details.hasCanvas = true;
      }
    } else {
      result.details.hasCanvas = true;
    }

    // Dispatch a simulated click on the canvas to test input handling
    const targetCanvas = doc.querySelector('canvas') as HTMLCanvasElement | null;
    if (targetCanvas) {
      const clickEvent = new window.MouseEvent('click', { bubbles: true, cancelable: true });
      targetCanvas.dispatchEvent(clickEvent);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Dispatch a simulated keydown on the document to test keyboard input
    const keyEvent = new window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    doc.dispatchEvent(keyEvent);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Dispatch a simulated touchstart on the canvas to test touch input
    if (targetCanvas) {
      const touchEvent = new window.Event('touchstart', { bubbles: true, cancelable: true });
      targetCanvas.dispatchEvent(touchEvent);
    }

    // Set canvasDrawn based on actual draw calls
    result.details.canvasDrawn = drawCalls > 0;

    // If an event handler actually ran during our dispatched events, confirm input handling
    const eventHandlerRan = (window as unknown as { __kele_eventHandlerRan?: boolean }).__kele_eventHandlerRan || false;
    if (eventHandlerRan) {
      result.details.hasInputHandler = true;
    }

    dom.window.close();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('HTMLCanvasElement') && !msg.includes('getContext') && !msg.includes('clearRect')) {
      jsErrors.push(`[JSDOM fatal] ${msg}`);
    }
  }

  result.details.jsErrors = jsErrors;
  result.details.consoleLogs = consoleLogs;

  // Detect game state elements (score, restart, game over, start screen)
  const hasScoreDisplay = html.includes('score') || html.includes('得分') || html.includes('分数');
  const hasRestart = html.includes('restart') || html.includes('重新开始') || html.includes('retry');
  const hasGameOver = html.includes('game over') || html.includes('结束');
  const hasStartScreen = html.includes('start') || html.includes('开始') || html.includes('play') || html.includes('click to start');

  // Detect DOM game container (for non-canvas games like word puzzles, card games, etc.)
  const hasDomGameContainer = html.includes('id="game"') || html.includes('class="game"') || html.includes('id="board"') || html.includes('class="board"');

  // Score calculation — fair for all game types
  let score = 0;
  if (result.details.hasCanvas) {
    score += 20; // Canvas game
  } else if (hasDomGameContainer) {
    score += 20; // DOM/SVG game gets equal points
  }
  if (result.details.hasGameLoop) score += 25;
  if (result.details.hasInputHandler) score += 20;
  if (jsErrors.length === 0) score += 25;
  else score -= Math.min(25, jsErrors.length * 10);
  if (hasScoreDisplay) score += 4;
  if (hasRestart) score += 3;
  if (hasGameOver) score += 2;
  if (hasStartScreen) score += 1;

  result.score = Math.min(100, Math.max(0, score));
  // DOM games have slightly lower threshold due to JSDOM limitations in detecting some interactions
  const threshold = result.details.hasCanvas ? 60 : (hasDomGameContainer ? 55 : 60);
  result.playable = score >= threshold && jsErrors.length === 0;

  if (!result.details.hasGameLoop) {
    result.errors.push('No game loop detected (requestAnimationFrame/setInterval/setTimeout)');
  }
  if (!result.details.hasInputHandler) {
    result.errors.push('No input handler detected (click/touch/keyboard)');
  }
  if (jsErrors.length > 0) {
    result.errors.push(`JavaScript errors: ${jsErrors.join('; ')}`);
  }

  // Playability scoring (objective, based on code structure)
  try {
    const playability = scorePlayability(targetDir);
    result.playability = playability;
    // Blend browser validation score with playability score
    result.score = Math.round(result.score * 0.4 + playability.total * 0.6);
    // Update playable flag based on playability
    if (playability.total < 40) {
      result.playable = false;
      result.errors.push(`可玩性评分过低 (${playability.total}/100)，${playability.suggestions[0] || '建议增加游戏内容'}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog('Playability scoring error', msg);
    // ignore playability scoring errors
  }

  return result;
}

/**
 * Quick check: does the generated output look like a valid game?
 * Runs static analysis without a browser.
 */
export function quickGameCheck(targetDir: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const projectType = detectGameProjectType(targetDir);

  if (projectType === 'miniprogram') {
    if (!existsSync(join(targetDir, 'game.json'))) {
      issues.push('Missing game.json for mini-program');
    }
    const entryFiles = ['index.js', 'game.js', 'main.js'];
    const hasEntry = entryFiles.some((f) => existsSync(join(targetDir, f)));
    if (!hasEntry) {
      issues.push('No entry file for mini-program');
    }
    return { ok: issues.length === 0, issues };
  }

  if (projectType === 'framework') {
    if (!existsSync(join(targetDir, 'package.json'))) {
      issues.push('Missing package.json for framework project');
    }
    const htmlPath = join(targetDir, 'index.html');
    if (!existsSync(htmlPath)) {
      issues.push('Missing index.html for framework project');
    }
    return { ok: issues.length === 0, issues };
  }

  // HTML game
  const htmlPath = join(targetDir, 'index.html');
  if (!existsSync(htmlPath)) {
    issues.push('Missing index.html');
    return { ok: false, issues };
  }

  const html = readFileSync(htmlPath, 'utf-8');

  if (!html.includes('<canvas') && !html.includes('<svg') && !html.includes('<div id="game"')) {
    issues.push('No canvas, svg, or game container found');
  }

  const scriptTags = html.match(/<script[^>]*>/g) || [];
  if (scriptTags.length === 0) {
    issues.push('No <script> tags — game logic missing');
  }

  // Check for external script refs that might 404
  const srcMatches = html.match(/<script[^>]+src=["']([^"']+)["']/g) || [];
  for (const match of srcMatches) {
    const src = match.match(/src=["']([^"']+)["']/)?.[1];
    if (src && !src.startsWith('http') && !src.startsWith('//')) {
      const resolved = join(targetDir, src.replace(/^\.\//, '').replace(/^\//, ''));
      if (!existsSync(resolved)) {
        issues.push(`Referenced script not found: ${src}`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
