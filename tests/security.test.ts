import { describe, it, expect } from 'vitest';
import { escapePromptInput, sanitizeFilePath, isSafePath } from '../src/core/security.js';

describe('Security', () => {
  describe('escapePromptInput', () => {
    it('should trim and limit length', () => {
      const long = 'a'.repeat(3000);
      expect(escapePromptInput(long)).toHaveLength(2003); // 2000 + "..."
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

    it('should escape quotes and backticks to prevent prompt injection', () => {
      expect(escapePromptInput('say "hello"')).toBe('say \\"hello\\"');
      expect(escapePromptInput('run `rm -rf`')).toBe('run \\`rm -rf\\`');
      expect(escapePromptInput('path\\to\\file')).toBe('path\\\\to\\\\file');
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

    it('should accept dot-relative paths', () => {
      expect(sanitizeFilePath('./js/game.js')).toBe('./js/game.js');
      expect(sanitizeFilePath('./index.html')).toBe('./index.html');
    });

    it('should reject embedded path traversal', () => {
      expect(sanitizeFilePath('foo/bar/../baz')).toBeNull();
      expect(sanitizeFilePath('assets/../../secret')).toBeNull();
    });

    it('should reject null bytes', () => {
      expect(sanitizeFilePath('file\0.txt')).toBeNull();
      expect(sanitizeFilePath('index\0.html')).toBeNull();
    });

    it('should reject overly long paths', () => {
      expect(sanitizeFilePath('a'.repeat(501))).toBeNull();
      expect(sanitizeFilePath('a'.repeat(500))).toBe('a'.repeat(500));
    });

    it('should reject sensitive system files', () => {
      expect(sanitizeFilePath('.env')).toBeNull();
      expect(sanitizeFilePath('.env.local')).toBeNull();
      expect(sanitizeFilePath('.ssh/id_rsa')).toBeNull();
      expect(sanitizeFilePath('.git/config')).toBeNull();
      expect(sanitizeFilePath('.npmrc')).toBeNull();
      expect(sanitizeFilePath('id_ed25519')).toBeNull();
      expect(sanitizeFilePath('.bashrc')).toBeNull();
      expect(sanitizeFilePath('.zshrc')).toBeNull();
      expect(sanitizeFilePath('.profile')).toBeNull();
      expect(sanitizeFilePath('.keystore')).toBeNull();
      expect(sanitizeFilePath('.key')).toBeNull();
      expect(sanitizeFilePath('.pem')).toBeNull();
      expect(sanitizeFilePath('.crt')).toBeNull();
      expect(sanitizeFilePath('.p12')).toBeNull();
      expect(sanitizeFilePath('.pfx')).toBeNull();
      expect(sanitizeFilePath('.cer')).toBeNull();
    });

    it('should reject system directories', () => {
      expect(sanitizeFilePath('/etc/passwd')).toBeNull();
      expect(sanitizeFilePath('/usr/bin/node')).toBeNull();
      expect(sanitizeFilePath('/bin/bash')).toBeNull();
      expect(sanitizeFilePath('/var/log/syslog')).toBeNull();
      expect(sanitizeFilePath('/sys/devices')).toBeNull();
      expect(sanitizeFilePath('/proc/self/environ')).toBeNull();
      expect(sanitizeFilePath('/dev/null')).toBeNull();
    });

    it('should handle mixed slashes', () => {
      expect(sanitizeFilePath('js\\game.js')).toBe('js/game.js');
      expect(sanitizeFilePath('css\\style.css')).toBe('css/style.css');
    });

    it('should reject non-string input', () => {
      expect(sanitizeFilePath(null as unknown as string)).toBeNull();
      expect(sanitizeFilePath(undefined as unknown as string)).toBeNull();
      expect(sanitizeFilePath(123 as unknown as string)).toBeNull();
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
