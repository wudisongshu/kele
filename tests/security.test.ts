import { describe, it, expect } from 'vitest';
import { escapePromptInput, sanitizeFilePath, isSafePath } from '../src/core/security.js';

describe('Security', () => {
  describe('escapePromptInput', () => {
    it('should trim and limit length', () => {
      const long = 'a'.repeat(1000);
      expect(escapePromptInput(long)).toHaveLength(503); // 500 + "..."
    });

    it('should remove control characters', () => {
      const input = 'hello\x00\x01world\x0b\x0c';
      expect(escapePromptInput(input)).toBe('helloworld');
    });

    it('should preserve normal text', () => {
      expect(escapePromptInput('做一个游戏')).toBe('做一个游戏');
    });

    it('should handle empty input', () => {
      expect(escapePromptInput('')).toBe('');
      expect(escapePromptInput(null as unknown as string)).toBe('');
    });
  });

  describe('sanitizeFilePath', () => {
    it('should accept safe relative paths', () => {
      expect(sanitizeFilePath('src/index.ts')).toBe('src/index.ts');
      expect(sanitizeFilePath('README.md')).toBe('README.md');
      expect(sanitizeFilePath('.github/workflows/deploy.yml')).toBe('.github/workflows/deploy.yml');
    });

    it('should reject path traversal', () => {
      expect(sanitizeFilePath('../etc/passwd')).toBeNull();
      expect(sanitizeFilePath('foo/../../bar')).toBeNull();
      expect(sanitizeFilePath('..\\windows\\system32')).toBeNull();
    });

    it('should reject absolute paths', () => {
      expect(sanitizeFilePath('/etc/passwd')).toBeNull();
      expect(sanitizeFilePath('C:\\Windows\\system32')).toBeNull();
    });

    it('should reject home directory paths', () => {
      expect(sanitizeFilePath('~/.ssh/id_rsa')).toBeNull();
    });

    it('should reject empty paths', () => {
      expect(sanitizeFilePath('')).toBeNull();
      expect(sanitizeFilePath('.')).toBeNull();
      expect(sanitizeFilePath('  ')).toBeNull();
    });
  });

  describe('isSafePath', () => {
    it('should return true for safe paths', () => {
      expect(isSafePath('index.html')).toBe(true);
    });

    it('should return false for unsafe paths', () => {
      expect(isSafePath('../secret')).toBe(false);
    });
  });
});
