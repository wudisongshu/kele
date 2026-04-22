import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { assembleProject } from '../src/core/project-assembler.js';

describe('project-assembler', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'kele-assembler-'));
  });

  afterEach(() => {
    // cleanup handled by OS tmp cleanup, but we can leave it
  });

  it('returns patched:false when index.html does not exist', () => {
    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(false);
    expect(result.patches).toEqual([]);
  });

  it('returns patched:false when no patch files exist', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html><body></body></html>');
    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(false);
    expect(result.patches).toEqual([]);
  });

  it('merges a single patch file before </body>', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html><body><canvas></canvas></body></html>');
    writeFileSync(join(tmpDir, 'ads.patch.html'), '<script src="js/ads.js"></script>');

    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(true);
    expect(result.patches).toEqual(['ads.patch.html']);

    const content = readFileSync(join(tmpDir, 'index.html'), 'utf-8');
    expect(content).toContain('<script src="js/ads.js"></script>');
    expect(content).toContain('</body>');
    expect(content.indexOf('<script')).toBeLessThan(content.indexOf('</body>'));

    expect(existsSync(join(tmpDir, 'ads.patch.html'))).toBe(false);
  });

  it('merges multiple patch files in directory order', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html><body>content</body></html>');
    writeFileSync(join(tmpDir, 'a.patch.html'), '<div id="a"></div>');
    writeFileSync(join(tmpDir, 'b.patch.html'), '<div id="b"></div>');

    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(true);
    expect(result.patches).toContain('a.patch.html');
    expect(result.patches).toContain('b.patch.html');

    const content = readFileSync(join(tmpDir, 'index.html'), 'utf-8');
    expect(content).toContain('<div id="a"></div>');
    expect(content).toContain('<div id="b"></div>');
    expect(existsSync(join(tmpDir, 'a.patch.html'))).toBe(false);
    expect(existsSync(join(tmpDir, 'b.patch.html'))).toBe(false);
  });

  it('ignores empty patch files', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html><body></body></html>');
    writeFileSync(join(tmpDir, 'empty.patch.html'), '   \n   ');

    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(false);
    expect(result.patches).toEqual([]);
    // Empty patch file should still be deleted
    expect(existsSync(join(tmpDir, 'empty.patch.html'))).toBe(false);
  });

  it('ignores non-.patch.html files', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html><body></body></html>');
    writeFileSync(join(tmpDir, 'ads.html'), '<script>alert(1)</script>');
    writeFileSync(join(tmpDir, 'patch.txt'), 'not html');

    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(false);
    expect(existsSync(join(tmpDir, 'ads.html'))).toBe(true);
    expect(existsSync(join(tmpDir, 'patch.txt'))).toBe(true);
  });

  it('ignores patch files in subdirectories (shallow search)', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html><body></body></html>');
    const subDir = join(tmpDir, 'sub');
    mkdirSync(subDir);
    writeFileSync(join(subDir, 'nested.patch.html'), '<div>nested</div>');

    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(false);
    expect(existsSync(join(subDir, 'nested.patch.html'))).toBe(true);
  });

  it('matches </body> case-insensitively', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html><body></BODY></html>');
    writeFileSync(join(tmpDir, 'test.patch.html'), '<span>patch</span>');

    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(true);

    const content = readFileSync(join(tmpDir, 'index.html'), 'utf-8');
    expect(content).toContain('<span>patch</span>');
    expect(content).toContain('</BODY>');
  });

  it('does not modify index.html when no valid patches', () => {
    const original = '<html><body>unchanged</body></html>';
    writeFileSync(join(tmpDir, 'index.html'), original);

    const result = assembleProject(tmpDir);
    expect(result.patched).toBe(false);

    const content = readFileSync(join(tmpDir, 'index.html'), 'utf-8');
    expect(content).toBe(original);
  });
});
