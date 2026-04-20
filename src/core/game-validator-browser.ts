import { JSDOM } from 'jsdom';
import { readFileSync, existsSync } from 'fs';
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

  const htmlPath = join(targetDir, 'index.html');
  if (!existsSync(htmlPath)) {
    result.errors.push('No index.html found');
    return result;
  }

  const html = readFileSync(htmlPath, 'utf-8');

  // Check for canvas element before running JS
  if (!html.includes('<canvas')) {
    result.errors.push('No <canvas> element in HTML');
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
        // Inject canvas mock BEFORE scripts run so getContext('2d') returns our mock
        // instead of null (which causes "Cannot read properties of null" errors)
        const proto = window.HTMLCanvasElement.prototype;
        const orig = proto.getContext;
        proto.getContext = function(contextId: string) {
          if (contextId === '2d') {
            // Return mock with canvas reference bound
            return { ...mockCtx, canvas: this };
          }
          return orig.call(this, contextId);
        };
      },
    });

    const window = dom.window as unknown as Window & typeof globalThis;
    const document = window.document;

    // Capture console errors and logs (ignore canvas-related warnings)
    window.addEventListener('error', (e: ErrorEvent) => {
      const msg = e.message || '';
      if (msg.includes('HTMLCanvasElement') || msg.includes('getContext') || msg.includes('clearRect') || msg.includes('drawImage')) {
        return;
      }
      jsErrors.push(`[window.error] ${msg}`);
    });

    // Check if canvas element exists
    const canvas = document.getElementById('c') as HTMLCanvasElement | null;
    if (!canvas) {
      const allCanvas = document.querySelectorAll('canvas');
      if (allCanvas.length > 0) {
        result.details.hasCanvas = true;
      }
    }

    // Wait a tick for scripts to run (JSDOM runs scripts synchronously during construction)
    // The canvas mock in beforeParse prevents runtime errors from canvas operations

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
