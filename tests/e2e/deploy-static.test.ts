import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameGenerator } from '../../src/core/generator.js';
import { GameValidator } from '../../src/core/validator.js';
import { MockAdapter } from '../../src/ai/providers/mock.js';
import { deployStatic } from '../../src/deploy/platforms/static.js';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('E2E: Generate and deploy static', () => {
  let testDir: string;
  let outDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'kele-deploy-'));
    outDir = join(testDir, 'output');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('generates a game with PWA assets and deploys statically', async () => {
    const adapter = new MockAdapter();
    const generator = new GameGenerator(adapter, testDir);
    const result = await generator.generate('做一个贪吃蛇游戏');

    expect(result.success).toBe(true);

    // Validate playability
    const validator = new GameValidator(testDir);
    const playability = await validator.validate('index.html');
    expect(playability.playable).toBe(true);

    // Verify PWA assets exist
    expect(existsSync(join(testDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(testDir, 'sw.js'))).toBe(true);
    expect(existsSync(join(testDir, 'icons', 'icon-192.svg'))).toBe(true);
    expect(existsSync(join(testDir, 'icons', 'icon-512.svg'))).toBe(true);

    // Verify index.html has PWA references
    const html = readFileSync(join(testDir, 'index.html'), 'utf-8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('serviceWorker.register');

    // Static deploy
    const deployResult = await deployStatic(testDir, outDir);
    expect(deployResult.success).toBe(true);

    // Verify output directory has all files
    expect(existsSync(join(outDir, 'index.html'))).toBe(true);
    expect(existsSync(join(outDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(outDir, 'sw.js'))).toBe(true);
    expect(existsSync(join(outDir, 'icons', 'icon-192.svg'))).toBe(true);
    expect(existsSync(join(outDir, 'icons', 'icon-512.svg'))).toBe(true);
  });
});
