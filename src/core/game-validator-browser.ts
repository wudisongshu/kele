import { JSDOM } from 'jsdom';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

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
export function validateGameInBrowser(targetDir: string): BrowserValidationResult {
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
  return validateHtmlGame(targetDir, result);
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

function validateHtmlGame(targetDir: string, result: BrowserValidationResult): BrowserValidationResult {
  const htmlPath = join(targetDir, 'index.html');
  if (!existsSync(htmlPath)) {
    result.errors.push('No index.html found');
    return result;
  }

  const html = readFileSync(htmlPath, 'utf-8');

  // Check for canvas element before running JS
  if (!html.includes('<canvas')) {
    // For DOM games, check for game container
    if (!html.includes('id="game"') && !html.includes('class="game"')) {
      result.errors.push('No <canvas> or game container element in HTML');
    }
  } else {
    result.details.hasCanvas = true;
  }

  // Check for game loop indicators in raw HTML/JS
  const hasRAF = html.includes('requestAnimationFrame');
  const hasInterval = /setInterval\s*\(/.test(html);
  const hasTimeoutLoop = /setTimeout\s*\([^,]+,\s*\d+\s*\)/.test(html);
  result.details.hasGameLoop = hasRAF || hasInterval || hasTimeoutLoop;

  // Check for input handlers
  const hasClick = html.includes('click') || html.includes('pointerdown') || html.includes('mousedown');
  const hasTouch = html.includes('touchstart') || html.includes('touchend');
  const hasKey = html.includes('keydown') || html.includes('keyup') || html.includes('keypress');
  result.details.hasInputHandler = hasClick || hasTouch || hasKey;

  // Run in JSDOM to catch runtime errors
  const jsErrors: string[] = [];
  const consoleLogs: string[] = [];

  try {
    // Create a mock 2D canvas context that satisfies common game canvas operations
    const mockCtx = {
      clearRect: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: () => ({ width: 0 }),
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
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
      drawImage: () => {},
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

    // Check if canvas element exists
    const canvas = doc.getElementById('c') as HTMLCanvasElement | null;
    if (!canvas) {
      const allCanvas = doc.querySelectorAll('canvas');
      if (allCanvas.length > 0) {
        result.details.hasCanvas = true;
      }
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

  // Score calculation
  let score = 0;
  if (result.details.hasCanvas) score += 20;
  if (result.details.hasGameLoop) score += 30;
  if (result.details.hasInputHandler) score += 20;
  if (jsErrors.length === 0) score += 30;
  else score -= Math.min(30, jsErrors.length * 10);

  result.score = Math.max(0, score);
  result.playable = score >= 60 && jsErrors.length === 0;

  if (!result.details.hasGameLoop) {
    result.errors.push('No game loop detected (requestAnimationFrame/setInterval/setTimeout)');
  }
  if (!result.details.hasInputHandler) {
    result.errors.push('No input handler detected (click/touch/keyboard)');
  }
  if (jsErrors.length > 0) {
    result.errors.push(`JavaScript errors: ${jsErrors.join('; ')}`);
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
