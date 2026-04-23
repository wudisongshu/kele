import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync, lstatSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  sanitizeForLog,
  DebugLogger,
  resolveLogRoot,
  setGlobalDebugLogger,
  getGlobalDebugLogger,
  withDebugLogger,
} from '../../src/utils/debug-logger.js';

describe('debug-logger', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kele-debug-test-'));
    setGlobalDebugLogger(null);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
    setGlobalDebugLogger(null);
  });

  describe('sanitizeForLog', () => {
    it('redacts sensitive string patterns', () => {
      const longKey = 'sk-' + 'a'.repeat(48);
      const input = `my api key is ${longKey}`;
      const result = sanitizeForLog(input) as string;
      expect(result).toContain('***REDACTED***');
      expect(result).not.toContain(longKey);
    });

    it('redacts object keys containing apiKey', () => {
      const input = { apiKey: 'secret123', normal: 'ok' };
      const result = sanitizeForLog(input) as Record<string, unknown>;
      expect(result.apiKey).toBe('***REDACTED***');
      expect(result.normal).toBe('ok');
    });

    it('redacts nested sensitive keys', () => {
      const input = { user: { password: 'hunter2' }, data: { token: 'tok_abc' } };
      const result = sanitizeForLog(input) as Record<string, unknown>;
      expect((result.user as Record<string, unknown>).password).toBe('***REDACTED***');
      expect((result.data as Record<string, unknown>).token).toBe('***REDACTED***');
    });

    it('redacts arrays with sensitive strings', () => {
      const input = ['sk-123456789012345678901234567890123456789012345678', 'normal'];
      const result = sanitizeForLog(input) as string[];
      expect(result[0]).toContain('***REDACTED***');
      expect(result[1]).toBe('normal');
    });

    it('passes through numbers and booleans', () => {
      expect(sanitizeForLog(42)).toBe(42);
      expect(sanitizeForLog(true)).toBe(true);
      expect(sanitizeForLog(null)).toBe(null);
    });
  });

  describe('DebugLogger', () => {
    it('creates sessions dir and writes header on init', async () => {
      const logger = new DebugLogger(tempDir, 'task-1', { enabled: true });
      await logger['_ready'];

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      expect(existsSync(sessionsDir)).toBe(true);

      const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
      expect(files.length).toBe(1);

      const content = readFileSync(join(sessionsDir, files[0]), 'utf-8');
      const header = JSON.parse(content.trim().split('\n')[0]);
      expect(header._header).toBe(true);
      expect(header.taskId).toBe('task-1');

      await logger.finalize('success');
    });

    it('buffers entries and flushes on bufferSize', async () => {
      const logger = new DebugLogger(tempDir, 'task-2', { enabled: true, bufferSize: 2 });
      await logger['_ready'];

      await logger.logInput('test', 'event.a', { x: 1 });
      await logger.logInput('test', 'event.b', { x: 2 });

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
      const content = readFileSync(join(sessionsDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      // header + 2 flushed entries
      expect(lines.length).toBe(3);

      await logger.finalize('success');
    });

    it('writes footer on finalize', async () => {
      const logger = new DebugLogger(tempDir, 'task-3', { enabled: true });
      await logger['_ready'];
      await logger.logInput('test', 'event', {});
      await logger.finalize('failed', { error: 'oops' });

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
      const content = readFileSync(join(sessionsDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      const footer = JSON.parse(lines[lines.length - 1]);
      expect(footer._footer).toBe(true);
      expect(footer.status).toBe('failed');
      expect(footer.summary.error).toBe('oops');
    });

    it('creates latest symlink', async () => {
      const logger = new DebugLogger(tempDir, 'task-4', { enabled: true });
      await logger['_ready'];
      await logger.finalize('success');

      const latestPath = join(tempDir, '.kele-logs', 'latest');
      expect(existsSync(latestPath)).toBe(true);
      const stat = lstatSync(latestPath);
      expect(stat.isSymbolicLink()).toBe(true);
    });

    it('cleans up old logs exceeding maxFiles', async () => {
      // Create multiple loggers serially
      for (let i = 0; i < 4; i++) {
        const logger = new DebugLogger(tempDir, `task-old-${i}`, { enabled: true, maxFiles: 2 });
        await logger['_ready'];
        await logger.finalize('success');
      }

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
      expect(files.length).toBeLessThanOrEqual(2);
    });

    it('does nothing when disabled', async () => {
      const logger = new DebugLogger(tempDir, 'task-5', { enabled: false });
      await logger.logInput('test', 'event', { x: 1 });
      await logger.finalize('success');

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      expect(existsSync(sessionsDir)).toBe(false);
    });

    it('respects closed state after finalize', async () => {
      const logger = new DebugLogger(tempDir, 'task-6', { enabled: true });
      await logger['_ready'];
      await logger.finalize('success');
      // Should not throw
      await logger.logInput('test', 'late', { x: 1 });
    });

    it('includes step in logIntermediate', async () => {
      const logger = new DebugLogger(tempDir, 'task-7', { enabled: true, bufferSize: 1 });
      await logger['_ready'];
      await logger.logIntermediate('mod', 'step', { n: 1 }, 5);

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
      const content = readFileSync(join(sessionsDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      const entry = JSON.parse(lines[1]);
      expect(entry.step).toBe(5);
      expect(entry.stage).toBe('intermediate');
      await logger.finalize('success');
    });

    it('logError includes message and stack', async () => {
      const logger = new DebugLogger(tempDir, 'task-8', { enabled: true, bufferSize: 1 });
      await logger['_ready'];
      const err = new Error('test error');
      await logger.logError('mod', err, { extra: 'data' });

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
      const content = readFileSync(join(sessionsDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      const entry = JSON.parse(lines[1]);
      expect(entry.level).toBe('ERROR');
      expect(entry.payload.message).toBe('test error');
      expect(entry.payload.extra).toBe('data');
      await logger.finalize('success');
    });
  });

  describe('global logger helpers', () => {
    it('setGlobalDebugLogger and getGlobalDebugLogger round-trip', () => {
      const logger = new DebugLogger(tempDir, 'g1', { enabled: false });
      setGlobalDebugLogger(logger);
      expect(getGlobalDebugLogger()).toBe(logger);
      setGlobalDebugLogger(null);
      expect(getGlobalDebugLogger()).toBeNull();
    });
  });

  describe('withDebugLogger', () => {
    it('finalizes success on normal return', async () => {
      const result = await withDebugLogger(
        tempDir,
        'w1',
        async (logger) => {
          await logger.logInput('test', 'ok', {});
          return 42;
        },
        { enabled: true },
      );
      expect(result).toBe(42);

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
      const content = readFileSync(join(sessionsDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      expect(JSON.parse(lines[lines.length - 1]).status).toBe('success');
    });

    it('finalizes failed on throw', async () => {
      await expect(
        withDebugLogger(
          tempDir,
          'w2',
          async (_logger) => {
            throw new Error('boom');
          },
          { enabled: true },
        ),
      ).rejects.toThrow('boom');

      const sessionsDir = join(tempDir, '.kele-logs', 'sessions');
      const files = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'));
      const content = readFileSync(join(sessionsDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      expect(JSON.parse(lines[lines.length - 1]).status).toBe('failed');
    });
  });

  describe('resolveLogRoot', () => {
    it('returns existing project root', () => {
      expect(resolveLogRoot(tempDir)).toBe(tempDir);
    });

    it('falls back when project root does not exist', () => {
      const nonexistent = '/tmp/kele-nonexistent-dir-' + Date.now();
      const root = resolveLogRoot(nonexistent);
      // Should be either ~/.kele/logs/ or /tmp/kele-logs
      expect(root).not.toBe(nonexistent);
      expect(existsSync(root)).toBe(true);
    });
  });

  describe('migrateToProjectRoot', () => {
    it('migrates log from temp dir to project dir after setup', async () => {
      const projectDir = join(tmpdir(), 'kele-migrate-test-' + Date.now());
      // logger created BEFORE project dir exists
      const logger = new DebugLogger(projectDir, 'setup-task', { enabled: true });
      await logger['_ready'];
      await logger.logInput('test', 'event', { x: 1 });
      await logger.finalize('success');

      // At this point log is in temp/global dir
      const beforePath = logger['logPath'];
      expect(beforePath).not.toContain('kele-migrate-test');

      // Now create the project dir (as if setup succeeded)
      const actualProjectDir = mkdtempSync(projectDir + '-');
      await logger.migrateToProjectRoot(actualProjectDir);

      // Log should now be in project dir
      const afterPath = logger['logPath'];
      expect(afterPath).toContain('kele-migrate-test');
      expect(existsSync(afterPath)).toBe(true);

      // Symlink should exist in project dir
      const latestPath = join(actualProjectDir, '.kele-logs', 'latest');
      expect(existsSync(latestPath)).toBe(true);

      // Cleanup
      rmSync(actualProjectDir, { recursive: true, force: true });
    });
  });
});
