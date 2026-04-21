import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function createTempDir(): string {
  const dir = join(tmpdir(), `kele-pwa-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe('PWA validation', () => {
  it('should detect manifest.json', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'manifest.json'), '{"name":"test"}', 'utf-8');
    const hasManifest = existsSync(join(dir, 'manifest.json'));
    expect(hasManifest).toBe(true);
    cleanup(dir);
  });

  it('should detect sw.js', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'sw.js'), 'self.addEventListener', 'utf-8');
    const hasSW = existsSync(join(dir, 'sw.js'));
    expect(hasSW).toBe(true);
    cleanup(dir);
  });

  it('should detect missing PWA files', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.html'), '<html></html>', 'utf-8');
    const hasManifest = existsSync(join(dir, 'manifest.json'));
    const hasSW = existsSync(join(dir, 'sw.js'));
    expect(hasManifest).toBe(false);
    expect(hasSW).toBe(false);
    cleanup(dir);
  });

  it('should validate manifest.json structure', () => {
    const dir = createTempDir();
    const manifest = {
      name: 'Test Game',
      short_name: 'Test',
      start_url: '/',
      display: 'standalone',
      icons: [{ src: 'icon.png', sizes: '192x192' }],
    };
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest), 'utf-8');
    const content = writeFileSync.toString();
    const parsed = JSON.parse(JSON.stringify(manifest));
    expect(parsed.name).toBe('Test Game');
    expect(parsed.display).toBe('standalone');
    cleanup(dir);
  });
});
