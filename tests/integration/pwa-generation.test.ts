import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { generatePWA, injectPWATags } from '../../src/pwa/generator.js';

describe('Integration: PWA generation', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'kele-pwa-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('generates manifest.json with correct structure', async () => {
    await generatePWA(testDir, { name: 'Test Game', description: 'A test' });

    const manifestPath = join(testDir, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    expect(manifest.name).toBe('Test Game');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons).toHaveLength(2);
    expect(manifest.icons[0].sizes).toBe('192x192');
    expect(manifest.icons[1].sizes).toBe('512x512');
  });

  it('generates sw.js with cache strategy', async () => {
    await generatePWA(testDir, { name: 'Test Game' });

    const swPath = join(testDir, 'sw.js');
    expect(existsSync(swPath)).toBe(true);

    const sw = readFileSync(swPath, 'utf-8');
    expect(sw).toContain('CACHE_NAME');
    expect(sw).toContain('install');
    expect(sw).toContain('activate');
    expect(sw).toContain('fetch');
    expect(sw).toContain('caches.open');
  });

  it('caches all sub-pages when pages are provided', async () => {
    const pages = [
      { name: '首页', fileName: 'home.html', description: '入口', icon: '🏠', title: '首页' },
      { name: '对战', fileName: 'match.html', description: '对战模式', icon: '🎮', title: '对战' },
    ];

    await generatePWA(testDir, { name: 'Test Game' }, pages);

    const swPath = join(testDir, 'sw.js');
    const sw = readFileSync(swPath, 'utf-8');
    expect(sw).toContain('./home.html');
    expect(sw).toContain('./match.html');
    expect(sw).toContain('./data-bridge.js');
    expect(sw).toContain('./icons/icon-192.svg');
    expect(sw).toContain('./icons/icon-512.svg');
  });

  it('generates SVG icons', async () => {
    await generatePWA(testDir, { name: 'Test Game' });

    const icon192 = join(testDir, 'icons', 'icon-192.svg');
    const icon512 = join(testDir, 'icons', 'icon-512.svg');

    expect(existsSync(icon192)).toBe(true);
    expect(existsSync(icon512)).toBe(true);

    const svg = readFileSync(icon192, 'utf-8');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('injects PWA tags into HTML with head', () => {
    const html = '<html><head></head><body></body></html>';
    const result = injectPWATags(html);

    expect(result).toContain('rel="manifest"');
    expect(result).toContain('manifest.json');
    expect(result).toContain('serviceWorker.register');
    expect(result).toContain('theme-color');
  });

  it('injects PWA tags into HTML without head', () => {
    const html = '<html><body></body></html>';
    const result = injectPWATags(html);

    expect(result).toContain('rel="manifest"');
    expect(result).toContain('<head>');
  });

  it('does not double-inject PWA tags', () => {
    const html = '<html><head><link rel="manifest" href="manifest.json"></head><body></body></html>';
    const result = injectPWATags(html);
    expect(result).toBe(html);
  });
});
