import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameValidator } from '../../src/core/validator.js';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('GameValidator', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'kele-validator-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('returns 0 score when file does not exist', async () => {
    const validator = new GameValidator(testDir);
    const result = await validator.validate('missing.html');
    expect(result.playable).toBe(false);
    expect(result.score).toBe(0);
    expect(result.checks.http200).toBe(false);
  });

  it('detects valid game HTML', async () => {
    const html = `<!DOCTYPE html>
<html><body>
<canvas id="c"></canvas>
<script>
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  function loop() {
    ctx.fillRect(0,0,10,10);
    requestAnimationFrame(loop);
  }
  document.addEventListener('keydown', function(e) { loop(); });
  loop();
</script>
</body></html>`;
    writeFileSync(join(testDir, 'index.html'), html);
    const validator = new GameValidator(testDir);
    const result = await validator.validate();
    expect(result.checks.http200).toBe(true);
    expect(result.checks.syntaxValid).toBe(true);
    expect(result.checks.canvasRendering).toBe(true);
    expect(result.checks.inputResponsive).toBe(true);
    expect(result.checks.noConsoleErrors).toBe(true);
    expect(result.score).toBe(100);
    expect(result.playable).toBe(true);
  });

  it('detects syntax errors', async () => {
    const html = `<!DOCTYPE html>
<html><script>
  const x = 'unclosed string;
</script></html>`;
    writeFileSync(join(testDir, 'index.html'), html);
    const validator = new GameValidator(testDir);
    const result = await validator.validate();
    expect(result.checks.syntaxValid).toBe(false);
    expect(result.playable).toBe(false);
    expect(result.score).toBeLessThanOrEqual(25);
  });

  it('detects missing canvas', async () => {
    const html = `<!DOCTYPE html>
<html><body><h1>Not a game</h1></body></html>`;
    writeFileSync(join(testDir, 'index.html'), html);
    const validator = new GameValidator(testDir);
    const result = await validator.validate();
    expect(result.checks.canvasRendering).toBe(false);
    expect(result.playable).toBe(false);
  });

  it('detects TODO markers', async () => {
    const html = `<!DOCTYPE html>
<html><body>
<canvas id="c"></canvas>
<script>
  // TODO: implement game
  function loop() { requestAnimationFrame(loop); }
  loop();
</script>
</body></html>`;
    writeFileSync(join(testDir, 'index.html'), html);
    const validator = new GameValidator(testDir);
    const result = await validator.validate();
    expect(result.checks.noConsoleErrors).toBe(false);
    expect(result.score).toBeLessThan(100);
  });
});
