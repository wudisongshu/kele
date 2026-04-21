import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  detectGameProjectType,
  validateGameInBrowser,
  quickGameCheck,
} from '../src/core/game-validator-browser.js';

function getTestDir() {
  return join(tmpdir(), `kele-gvb-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('game-validator-browser', () => {
  let TEST_DIR: string;

  beforeEach(() => {
    TEST_DIR = getTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  describe('detectGameProjectType', () => {
    it('detects miniprogram by game.json', () => {
      writeFileSync(join(TEST_DIR, 'game.json'), '{}');
      expect(detectGameProjectType(TEST_DIR)).toBe('miniprogram');
    });

    it('detects framework by package.json', () => {
      writeFileSync(join(TEST_DIR, 'package.json'), '{}');
      expect(detectGameProjectType(TEST_DIR)).toBe('framework');
    });

    it('detects html-canvas by canvas tag', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body><canvas></canvas></body></html>');
      expect(detectGameProjectType(TEST_DIR)).toBe('html-canvas');
    });

    it('detects html-dom without canvas', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body><div id="game"></div></body></html>');
      expect(detectGameProjectType(TEST_DIR)).toBe('html-dom');
    });

    it('returns unknown for empty directory', () => {
      expect(detectGameProjectType(TEST_DIR)).toBe('unknown');
    });
  });

  describe('validateGameInBrowser', () => {
    it('validates framework project with build script', () => {
      writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
        scripts: { build: 'echo build', dev: 'echo dev' },
        dependencies: { phaser: '^3.0.0' },
      }));
      mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
      writeFileSync(join(TEST_DIR, 'src', 'game.js'), 'console.log(1)');
      writeFileSync(join(TEST_DIR, 'index.html'), '<html></html>');

      const result = validateGameInBrowser(TEST_DIR);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.playable).toBe(true);
    });

    it('fails framework project without build script', () => {
      writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }));
      const result = validateGameInBrowser(TEST_DIR);
      expect(result.playable).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates miniprogram project', () => {
      writeFileSync(join(TEST_DIR, 'game.json'), JSON.stringify({ deviceOrientation: 'portrait' }));
      writeFileSync(join(TEST_DIR, 'game.js'), `
        const canvas = createCanvas();
        const ctx = canvas.getContext('2d');
        function loop() { requestAnimationFrame(loop); }
        canvas.onTouchStart = function(e) {};
      `);

      const result = validateGameInBrowser(TEST_DIR);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.playable).toBe(true);
    });

    it('fails miniprogram without entry file', () => {
      writeFileSync(join(TEST_DIR, 'game.json'), '{}');
      const result = validateGameInBrowser(TEST_DIR);
      expect(result.playable).toBe(false);
    });

    it('validates HTML canvas game', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), `
<!DOCTYPE html>
<html>
<body>
<canvas id="game"></canvas>
<script>
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.fillRect(0,0,10,10);
function gameLoop() { requestAnimationFrame(gameLoop); }
gameLoop();
document.addEventListener('click', function() {});
</script>
</body>
</html>
      `);
      writeFileSync(join(TEST_DIR, 'manifest.json'), '{}');
      writeFileSync(join(TEST_DIR, 'sw.js'), '');

      const result = validateGameInBrowser(TEST_DIR);
      expect(result.details.hasCanvas).toBe(true);
      expect(result.details.hasGameLoop).toBe(true);
      expect(result.details.hasInputHandler).toBe(true);
    });

    it('validates HTML DOM game', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), `
<!DOCTYPE html>
<html>
<body>
<div id="game"></div>
<script>
function update() { setInterval(update, 1000); }
document.addEventListener('keydown', function() {});
</script>
</body>
</html>
      `);

      const result = validateGameInBrowser(TEST_DIR);
      expect(result.details.hasGameLoop).toBe(true);
      expect(result.details.hasInputHandler).toBe(true);
    });

    it('fails HTML without game elements', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body><div>Hello</div></body></html>');
      const result = validateGameInBrowser(TEST_DIR);
      expect(result.playable).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns error for missing index.html', () => {
      const result = validateGameInBrowser(TEST_DIR);
      expect(result.errors[0]).toContain('No index.html');
    });
  });

  describe('quickGameCheck', () => {
    it('passes for valid HTML game', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), `
<!DOCTYPE html>
<html><body>
<canvas id="game"></canvas>
<script src="game.js"></script>
</body></html>
      `);
      writeFileSync(join(TEST_DIR, 'game.js'), 'console.log(1)');

      const result = quickGameCheck(TEST_DIR);
      expect(result.ok).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('fails for missing index.html', () => {
      const result = quickGameCheck(TEST_DIR);
      expect(result.ok).toBe(false);
      expect(result.issues[0]).toContain('Missing index.html');
    });

    it('fails for HTML without game container', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), '<html><body><div>text</div></body></html>');
      const result = quickGameCheck(TEST_DIR);
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.includes('No canvas'))).toBe(true);
    });

    it('fails for missing script tags', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), '<html><body><canvas></canvas></body></html>');
      const result = quickGameCheck(TEST_DIR);
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.includes('No <script>'))).toBe(true);
    });

    it('detects missing referenced script', () => {
      writeFileSync(join(TEST_DIR, 'index.html'), '<html><body><script src="missing.js"></script></body></html>');
      const result = quickGameCheck(TEST_DIR);
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.includes('missing.js'))).toBe(true);
    });

    it('passes for valid miniprogram', () => {
      writeFileSync(join(TEST_DIR, 'game.json'), '{}');
      writeFileSync(join(TEST_DIR, 'game.js'), '');
      const result = quickGameCheck(TEST_DIR);
      expect(result.ok).toBe(true);
    });

    it('fails miniprogram without game.json', () => {
      writeFileSync(join(TEST_DIR, 'game.js'), '');
      const result = quickGameCheck(TEST_DIR);
      expect(result.ok).toBe(false);
    });

    it('passes for valid framework project', () => {
      writeFileSync(join(TEST_DIR, 'package.json'), '{}');
      writeFileSync(join(TEST_DIR, 'index.html'), '<html></html>');
      const result = quickGameCheck(TEST_DIR);
      expect(result.ok).toBe(true);
    });
  });
});
