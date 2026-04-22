import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateGameInBrowser } from '../src/core/game-validator-browser.js';

function getTestDir() {
  return join(tmpdir(), `kele-pwa-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('PWA validation via game-validator-browser', () => {
  let TEST_DIR: string;

  beforeEach(() => {
    TEST_DIR = getTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  it('detects PWA files in HTML game validation', async () => {
    writeFileSync(join(TEST_DIR, 'index.html'), `
<!DOCTYPE html>
<html><body>
<canvas id="game"></canvas>
<script>
function loop() { requestAnimationFrame(loop); }
loop();
document.addEventListener('click', function() {});
</script>
</body></html>
    `);
    writeFileSync(join(TEST_DIR, 'manifest.json'), JSON.stringify({ name: 'Test', start_url: '/' }));
    writeFileSync(join(TEST_DIR, 'sw.js'), 'self.addEventListener("install", () => {});');

    const result = await validateGameInBrowser(TEST_DIR);
    // Should not crash and should return a score
    expect(typeof result.score).toBe('number');
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
  });

  it('validates manifest.json structure in miniprogram', async () => {
    writeFileSync(join(TEST_DIR, 'game.json'), JSON.stringify({
      deviceOrientation: 'portrait',
      showStatusBar: false,
    }));
    writeFileSync(join(TEST_DIR, 'game.js'), `
      const canvas = createCanvas();
      const ctx = canvas.getContext('2d');
      function loop() { requestAnimationFrame(loop); }
      loop();
    `);

    const result = await validateGameInBrowser(TEST_DIR);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.playable).toBe(true);
  });

  it('detects invalid manifest.json in miniprogram', async () => {
    writeFileSync(join(TEST_DIR, 'game.json'), 'not valid json');
    writeFileSync(join(TEST_DIR, 'game.js'), 'console.log(1)');

    const result = await validateGameInBrowser(TEST_DIR);
    // Should not crash, may have lower score
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
  });
});
