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

  describe('Ad Revenue Optimizer checks', () => {
    it('detects ad containers in HTML', () => {
      const dir = createTempDir();
      writeFileSync(join(dir, 'ads.txt'), 'google.com, pub-xxx, DIRECT', 'utf-8');
      writeFileSync(join(dir, 'manifest.json'), '{}', 'utf-8');
      writeFileSync(join(dir, 'sw.js'), '', 'utf-8');
      writeFileSync(join(dir, 'index.html'), '<div id="ad-banner-bottom"></div><div id="ad-interstitial"></div><link rel="manifest">', 'utf-8');

      const result = checkMonetizationReadiness(dir, 'web');
      const containerCheck = result.checks.find((c) => c.name === 'ad_containers');
      expect(containerCheck?.passed).toBe(true);
      cleanup(dir);
    });

    it('fails ad container check when missing', () => {
      const dir = createTempDir();
      writeFileSync(join(dir, 'ads.txt'), 'google.com, pub-xxx, DIRECT', 'utf-8');
      writeFileSync(join(dir, 'manifest.json'), '{}', 'utf-8');
      writeFileSync(join(dir, 'sw.js'), '', 'utf-8');
      writeFileSync(join(dir, 'index.html'), '<link rel="manifest">', 'utf-8');

      const result = checkMonetizationReadiness(dir, 'web');
      const containerCheck = result.checks.find((c) => c.name === 'ad_containers');
      expect(containerCheck?.passed).toBe(false);
      cleanup(dir);
    });

    it('detects ad trigger functions', () => {
      const dir = createTempDir();
      writeFileSync(join(dir, 'ads.txt'), 'google.com, pub-xxx, DIRECT', 'utf-8');
      writeFileSync(join(dir, 'manifest.json'), '{}', 'utf-8');
      writeFileSync(join(dir, 'sw.js'), '', 'utf-8');
      writeFileSync(join(dir, 'index.html'), `
        <div id="ad-banner-bottom"></div>
        <link rel="manifest">
        <script>
          function showBannerAd() {}
          function showInterstitialAd() {}
          function showRewardedAd() {}
        </script>
      `, 'utf-8');

      const result = checkMonetizationReadiness(dir, 'web');
      const triggerCheck = result.checks.find((c) => c.name === 'ad_trigger_functions');
      expect(triggerCheck?.passed).toBe(true);
      cleanup(dir);
    });

    it('fails ad trigger check with only 1 function', () => {
      const dir = createTempDir();
      writeFileSync(join(dir, 'ads.txt'), 'google.com, pub-xxx, DIRECT', 'utf-8');
      writeFileSync(join(dir, 'manifest.json'), '{}', 'utf-8');
      writeFileSync(join(dir, 'sw.js'), '', 'utf-8');
      writeFileSync(join(dir, 'index.html'), '<link rel="manifest"><script>function showBannerAd() {}</script>', 'utf-8');

      const result = checkMonetizationReadiness(dir, 'web');
      const triggerCheck = result.checks.find((c) => c.name === 'ad_trigger_functions');
      expect(triggerCheck?.passed).toBe(false);
      cleanup(dir);
    });

    it('detects ad frequency cap (lastAdTime)', () => {
      const dir = createTempDir();
      writeFileSync(join(dir, 'ads.txt'), 'google.com, pub-xxx, DIRECT', 'utf-8');
      writeFileSync(join(dir, 'manifest.json'), '{}', 'utf-8');
      writeFileSync(join(dir, 'sw.js'), '', 'utf-8');
      writeFileSync(join(dir, 'index.html'), `
        <link rel="manifest">
        <script>
          let lastAdTime = 0;
          function showInterstitialAd() {
            if (Date.now() - lastAdTime >= 30000) { lastAdTime = Date.now(); }
          }
        </script>
      `, 'utf-8');

      const result = checkMonetizationReadiness(dir, 'web');
      const freqCheck = result.checks.find((c) => c.name === 'ad_frequency_cap');
      expect(freqCheck?.passed).toBe(true);
      cleanup(dir);
    });

    it('fails ad frequency cap when missing', () => {
      const dir = createTempDir();
      writeFileSync(join(dir, 'ads.txt'), 'google.com, pub-xxx, DIRECT', 'utf-8');
      writeFileSync(join(dir, 'manifest.json'), '{}', 'utf-8');
      writeFileSync(join(dir, 'sw.js'), '', 'utf-8');
      writeFileSync(join(dir, 'index.html'), '<link rel="manifest"><script>function showAd() {}</script>', 'utf-8');

      const result = checkMonetizationReadiness(dir, 'web');
      const freqCheck = result.checks.find((c) => c.name === 'ad_frequency_cap');
      expect(freqCheck?.passed).toBe(false);
      cleanup(dir);
    });

    it('detects mini-program ad triggers and frequency', () => {
      const dir = createTempDir();
      writeFileSync(join(dir, 'game.json'), '{}', 'utf-8');
      writeFileSync(join(dir, 'project.config.json'), '{}', 'utf-8');
      writeFileSync(join(dir, 'index.js'), `
        let lastAdTime = 0;
        function showBannerAd() { wx.createBannerAd({}); }
        function showRewardedAd() { wx.createRewardedVideoAd({}); }
      `, 'utf-8');

      const result = checkMonetizationReadiness(dir, 'wechat-miniprogram');
      expect(result.checks.some((c) => c.name === 'ad_trigger_functions' && c.passed)).toBe(true);
      expect(result.checks.some((c) => c.name === 'ad_frequency_cap' && c.passed)).toBe(true);
      cleanup(dir);
    });

    it('returns score for all platforms', () => {
      const dir = createTempDir();
      writeFileSync(join(dir, 'index.html'), '<html></html>', 'utf-8');

      const result = checkMonetizationReadiness(dir, 'web');
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      cleanup(dir);
    });

    it('includes checks array in result', () => {
      const dir = createTempDir();
      const result = checkMonetizationReadiness(dir, 'web');
      expect(Array.isArray(result.checks)).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
      cleanup(dir);
    });
  });
});
