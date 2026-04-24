import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlayabilityValidator } from '../src/core/playability-validator.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), `kele-playability-test-${Date.now()}`);

describe('PlayabilityValidator', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('detects syntax errors and marks unplayable', async () => {
    const validator = new PlayabilityValidator(TEST_DIR);
    // Intentional syntax error: missing closing brace and invalid syntax
    writeFileSync(
      join(TEST_DIR, 'index.html'),
      `<!DOCTYPE html>
<html>
<head><title>Broken Game</title></head>
<body>
<canvas id="c"></canvas>
<script>
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  function init() {
    c.width = 400;
    c.height = 400;
    // Syntax error below: unmatched brace + invalid token
    if (true {
      console.log('broken'
    }
  }
  requestAnimationFrame(init);
</script>
</body>
</html>`,
    );

    const result = await validator.validate('index.html');
    expect(result.checks.syntaxValid).toBe(false);
    expect(result.playable).toBe(false);
    expect(result.score).toBeLessThanOrEqual(50);
    expect(result.details.some((d) => d.includes('语法错误'))).toBe(true);
  });

  it('passes syntax check for valid game code', async () => {
    const validator = new PlayabilityValidator(TEST_DIR);
    writeFileSync(
      join(TEST_DIR, 'index.html'),
      `<!DOCTYPE html>
<html>
<head><title>Valid Game</title></head>
<body>
<canvas id="c"></canvas>
<script>
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  function loop() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(loop);
  }
  canvas.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft') x -= 5;
  });
  loop();
</script>
</body>
</html>`,
    );

    const result = await validator.validate('index.html');
    expect(result.checks.http200).toBe(true);
    expect(result.checks.syntaxValid).toBe(true);
    expect(result.checks.canvasRendering).toBe(true); // static fallback
    expect(result.checks.inputResponsive).toBe(true);  // static fallback
  });

  it('returns zero score when file does not exist', async () => {
    const validator = new PlayabilityValidator(TEST_DIR);
    const result = await validator.validate('nonexistent.html');
    expect(result.checks.http200).toBe(false);
    expect(result.score).toBe(0);
    expect(result.playable).toBe(false);
  });

  it('detects missing canvas and game loop', async () => {
    const validator = new PlayabilityValidator(TEST_DIR);
    writeFileSync(
      join(TEST_DIR, 'index.html'),
      `<!DOCTYPE html>
<html><body><h1>Not a game</h1></body></html>`,
    );

    const result = await validator.validate('index.html');
    expect(result.checks.http200).toBe(true);
    expect(result.checks.syntaxValid).toBe(true); // no scripts to check
    expect(result.checks.canvasRendering).toBe(false);
    expect(result.checks.inputResponsive).toBe(false);
    expect(result.score).toBeLessThan(75);
    expect(result.playable).toBe(false);
  });
});
