import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseAIOutput, writeFiles, applyAIOutput } from '../src/core/file-writer.js';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FileWriter', () => {
  describe('parseAIOutput', () => {
    it('should parse JSON with files array', () => {
      const output = JSON.stringify({
        files: [
          { path: 'src/index.ts', content: 'console.log("hello")' },
          { path: 'README.md', content: '# Hello' },
        ],
        notes: 'done',
      });

      const parsed = parseAIOutput(output);
      expect(parsed.files).toHaveLength(2);
      expect(parsed.files[0].path).toBe('src/index.ts');
      expect(parsed.notes).toBe('done');
    });

    it('should parse JSON inside markdown code block', () => {
      const output = '```json\n' + JSON.stringify({
        files: [{ path: 'test.ts', content: '// test' }],
      }) + '\n```';

      const parsed = parseAIOutput(output);
      expect(parsed.files).toHaveLength(1);
      expect(parsed.files[0].path).toBe('test.ts');
    });

    it('should fall back to plain text as notes', () => {
      const output = 'This is just plain text instructions.';
      const parsed = parseAIOutput(output);
      expect(parsed.files).toHaveLength(0);
      expect(parsed.notes).toBe(output);
    });

    it('should handle invalid JSON gracefully', () => {
      const output = '{ invalid json }';
      const parsed = parseAIOutput(output);
      expect(parsed.files).toHaveLength(0);
      expect(parsed.notes).toBe(output);
    });
  });

  describe('writeFiles', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'kele-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should write files to disk', () => {
      const parsed = {
        files: [
          { path: 'src/index.ts', content: 'console.log("hello")' },
          { path: 'package.json', content: '{"name": "test"}' },
        ],
        notes: '',
      };

      const written = writeFiles(tmpDir, parsed);
      expect(written).toContain('src/index.ts');
      expect(written).toContain('package.json');

      expect(readFileSync(join(tmpDir, 'src/index.ts'), 'utf-8')).toBe('console.log("hello")');
      expect(readFileSync(join(tmpDir, 'package.json'), 'utf-8')).toBe('{"name": "test"}');
    });

    it('should create nested directories', () => {
      const parsed = {
        files: [{ path: 'deep/nested/file.txt', content: 'deep content' }],
        notes: '',
      };

      writeFiles(tmpDir, parsed);
      expect(existsSync(join(tmpDir, 'deep/nested/file.txt'))).toBe(true);
    });

    it('should write notes as notes.md', () => {
      const parsed = {
        files: [],
        notes: 'Important instructions here',
      };

      const written = writeFiles(tmpDir, parsed);
      expect(written).toContain('notes.md');
      expect(readFileSync(join(tmpDir, 'notes.md'), 'utf-8')).toBe('Important instructions here');
    });

    it('should deduplicate sub-project prefix from paths', () => {
      // Simulate baseDir ending with 'game-dev' and AI returning 'game-dev/index.html'
      const baseDir = join(tmpDir, 'game-dev');
      const parsed = {
        files: [
          { path: 'game-dev/index.html', content: '<html></html>' },
          { path: 'game-dev/js/game.js', content: 'const game = 1;' },
          { path: 'README.md', content: '# Readme' },
        ],
        notes: '',
      };

      const written = writeFiles(baseDir, parsed);
      expect(written).toContain('index.html');
      expect(written).toContain('js/game.js');
      expect(written).toContain('README.md');
      // Should NOT contain the duplicated prefix
      expect(written).not.toContain('game-dev/index.html');

      // Files should be written without nested 'game-dev/game-dev/'
      expect(existsSync(join(baseDir, 'index.html'))).toBe(true);
      expect(existsSync(join(baseDir, 'js/game.js'))).toBe(true);
      expect(existsSync(join(baseDir, 'README.md'))).toBe(true);
      expect(existsSync(join(baseDir, 'game-dev', 'index.html'))).toBe(false);
    });
  });

  describe('applyAIOutput', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'kele-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should parse and write in one call', () => {
      const output = JSON.stringify({
        files: [{ path: 'hello.txt', content: 'world' }],
      });

      const written = applyAIOutput(tmpDir, output);
      expect(written).toContain('hello.txt');
      expect(readFileSync(join(tmpDir, 'hello.txt'), 'utf-8')).toBe('world');
    });
  });
});
