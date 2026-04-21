import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { checkMonetizationReadiness } from '../src/core/monetization-readiness.js';

function createTempDir(): string {
  const dir = join(tmpdir(), `kele-mr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe('Monetization Readiness', () => {
  it('passes for a complete web project', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'ads.txt'), 'google.com, pub-xxx, DIRECT', 'utf-8');
    writeFileSync(join(dir, 'manifest.json'), '{"name":"test"}', 'utf-8');
    writeFileSync(join(dir, 'sw.js'), 'self.addEventListener', 'utf-8');
    writeFileSync(join(dir, 'index.html'), '<link rel="manifest" href="manifest.json">', 'utf-8');

    const result = checkMonetizationReadiness(dir, 'web');
    expect(result.monetizable).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
    cleanup(dir);
  });

  it('fails web project missing required files', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.html'), '<html></html>', 'utf-8');

    const result = checkMonetizationReadiness(dir, 'web');
    expect(result.monetizable).toBe(false);
    expect(result.checks.some((c) => c.name === 'ads.txt' && !c.passed)).toBe(true);
    cleanup(dir);
  });

  it('checks mini-program ad SDK', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'game.json'), '{}', 'utf-8');
    writeFileSync(join(dir, 'project.config.json'), '{}', 'utf-8');
    writeFileSync(join(dir, 'index.js'), 'tt.createRewardedVideoAd', 'utf-8');

    const result = checkMonetizationReadiness(dir, 'douyin');
    expect(result.checks.some((c) => c.name === 'ad_sdk_init' && c.passed)).toBe(true);
    cleanup(dir);
  });

  it('checks discord-bot package.json', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'package.json'), '{"name":"bot"}', 'utf-8');

    const result = checkMonetizationReadiness(dir, 'discord-bot');
    expect(result.monetizable).toBe(true);
    cleanup(dir);
  });

  it('checks steam project files', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'package.json'), '{}', 'utf-8');
    writeFileSync(join(dir, 'main.js'), 'require("electron")', 'utf-8');
    writeFileSync(join(dir, 'index.html'), '<html></html>', 'utf-8');

    const result = checkMonetizationReadiness(dir, 'steam');
    expect(result.monetizable).toBe(true);
    cleanup(dir);
  });

  it('checks github-sponsors README', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'README.md'), '# Project\n\nSponsor us!', 'utf-8');

    const result = checkMonetizationReadiness(dir, 'github-sponsors');
    expect(result.monetizable).toBe(true);
    cleanup(dir);
  });

  it('returns generic message for unknown platforms', () => {
    const dir = createTempDir();
    const result = checkMonetizationReadiness(dir, 'unknown-platform');
    expect(result.monetizable).toBe(true);
    expect(result.checks[0].name).toBe('platform_support');
    cleanup(dir);
  });
});
