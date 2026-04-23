import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmdirSync, rmSync } from 'fs';
import { join } from 'path';
import {
  findFilesByExt,
  findHtmlFiles,
  findJsFiles,
  findTsFiles,
  findSourceFiles,
  findJsonFiles,
  isFile,
} from '../src/core/file-utils.js';

const TEST_DIR = join('/tmp', 'kele-file-utils-test');

describe('file-utils', () => {
  beforeAll(() => {
    // Clean up if exists
    try { rmSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'src', 'components'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'node_modules'), { recursive: true });
    mkdirSync(join(TEST_DIR, 'dist'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.git'), { recursive: true });
    mkdirSync(join(TEST_DIR, '.hidden'), { recursive: true });

    writeFileSync(join(TEST_DIR, 'index.html'), '<html></html>');
    writeFileSync(join(TEST_DIR, 'src', 'app.js'), 'console.log("app");');
    writeFileSync(join(TEST_DIR, 'src', 'app.ts'), 'const x = 1;');
    writeFileSync(join(TEST_DIR, 'src', 'components', 'Button.tsx'), 'export default () => {};');
    writeFileSync(join(TEST_DIR, 'src', 'components', 'Header.jsx'), 'export default () => {};');
    writeFileSync(join(TEST_DIR, 'package.json'), '{"name":"test"}');
    writeFileSync(join(TEST_DIR, 'node_modules', 'bad.js'), '// skip me');
    writeFileSync(join(TEST_DIR, 'dist', 'bundle.js'), '// skip me');
    writeFileSync(join(TEST_DIR, '.git', 'config.js'), '// skip me');
    writeFileSync(join(TEST_DIR, '.hidden', 'secret.ts'), 'const secret = 1;');
  });

  afterAll(() => {
    try { rmSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  describe('findFilesByExt', () => {
    it('finds all .js files excluding skip dirs', () => {
      const files = findFilesByExt(TEST_DIR, '.js');
      expect(files).toContain(join(TEST_DIR, 'src', 'app.js'));
      expect(files).not.toContain(join(TEST_DIR, 'node_modules', 'bad.js'));
      expect(files).not.toContain(join(TEST_DIR, 'dist', 'bundle.js'));
    });

    it('finds all .html files', () => {
      const files = findFilesByExt(TEST_DIR, '.html');
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(join(TEST_DIR, 'index.html'));
    });

    it('skips hidden directories by default', () => {
      const files = findFilesByExt(TEST_DIR, '.ts');
      expect(files).toContain(join(TEST_DIR, 'src', 'app.ts'));
      expect(files).not.toContain(join(TEST_DIR, '.hidden', 'secret.ts'));
    });

    it('returns empty array for non-existent directory', () => {
      const files = findFilesByExt('/nonexistent/path/xyz', '.js');
      expect(files).toEqual([]);
    });

    it('respects custom skipDirs', () => {
      const files = findFilesByExt(TEST_DIR, '.ts', ['node_modules']);
      // Should skip node_modules but not dist
      expect(files).not.toContain(join(TEST_DIR, 'node_modules', 'bad.js'));
    });
  });

  describe('findHtmlFiles', () => {
    it('finds HTML files', () => {
      const files = findHtmlFiles(TEST_DIR);
      expect(files).toContain(join(TEST_DIR, 'index.html'));
    });
  });

  describe('findJsFiles', () => {
    it('finds JS files excluding skipped dirs', () => {
      const files = findJsFiles(TEST_DIR);
      expect(files).toContain(join(TEST_DIR, 'src', 'app.js'));
      expect(files).not.toContain(join(TEST_DIR, 'node_modules', 'bad.js'));
    });
  });

  describe('findTsFiles', () => {
    it('finds TS files', () => {
      const files = findTsFiles(TEST_DIR);
      expect(files).toContain(join(TEST_DIR, 'src', 'app.ts'));
      expect(files).not.toContain(join(TEST_DIR, 'src', 'components', 'Button.tsx'));
    });
  });

  describe('findSourceFiles', () => {
    it('finds JS/TS/JSX/TSX files', () => {
      const files = findSourceFiles(TEST_DIR);
      expect(files).toContain(join(TEST_DIR, 'src', 'app.js'));
      expect(files).toContain(join(TEST_DIR, 'src', 'app.ts'));
      expect(files).toContain(join(TEST_DIR, 'src', 'components', 'Button.tsx'));
      expect(files).toContain(join(TEST_DIR, 'src', 'components', 'Header.jsx'));
      expect(files).not.toContain(join(TEST_DIR, 'node_modules', 'bad.js'));
      expect(files).not.toContain(join(TEST_DIR, 'dist', 'bundle.js'));
      // Hidden dirs are skipped
      expect(files).not.toContain(join(TEST_DIR, '.hidden', 'secret.ts'));
    });

    it('returns empty array for non-existent directory', () => {
      const files = findSourceFiles('/nonexistent/path/xyz');
      expect(files).toEqual([]);
    });
  });

  describe('findJsonFiles', () => {
    it('finds JSON files', () => {
      const files = findJsonFiles(TEST_DIR);
      expect(files).toContain(join(TEST_DIR, 'package.json'));
    });
  });

  describe('isFile', () => {
    it('returns true for files', () => {
      expect(isFile(join(TEST_DIR, 'index.html'))).toBe(true);
      expect(isFile(join(TEST_DIR, 'package.json'))).toBe(true);
    });

    it('returns false for directories', () => {
      expect(isFile(join(TEST_DIR, 'src'))).toBe(false);
    });

    it('returns false for non-existent paths', () => {
      expect(isFile(join(TEST_DIR, 'nonexistent.txt'))).toBe(false);
    });
  });

  describe('findFilesByExt', () => {
    it('finds .tsx files', () => {
      const files = findFilesByExt(TEST_DIR, '.tsx');
      expect(files).toContain(join(TEST_DIR, 'src', 'components', 'Button.tsx'));
    });

    it('finds .jsx files', () => {
      const files = findFilesByExt(TEST_DIR, '.jsx');
      expect(files).toContain(join(TEST_DIR, 'src', 'components', 'Header.jsx'));
    });
  });
});
