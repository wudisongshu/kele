import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logEvent, createProgressLogger, printJsonOutput, setLogDir } from '../src/core/logger.js';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

let TEST_LOG_DIR: string;

describe('logger', () => {
  beforeEach(() => {
    TEST_LOG_DIR = mkdtempSync(join(tmpdir(), 'kele-logs-test-'));
    setLogDir(TEST_LOG_DIR);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (existsSync(TEST_LOG_DIR)) {
      const files = require('fs').readdirSync(TEST_LOG_DIR);
      for (const f of files) {
        if (f.startsWith('kele-') && f.endsWith('.log')) {
          rmSync(join(TEST_LOG_DIR, f), { force: true });
        }
      }
    }
  });

  describe('logEvent', () => {
    it('writes a log entry to file', () => {
      logEvent('info', 'test message', { key: 'value' });
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(TEST_LOG_DIR, `kele-${date}.log`);
      expect(existsSync(logFile)).toBe(true);
      const content = readFileSync(logFile, 'utf-8');
      expect(content).toContain('test message');
      expect(content).toContain('"level":"info"');
    });

    it('writes error level log', () => {
      logEvent('error', 'something went wrong');
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(TEST_LOG_DIR, `kele-${date}.log`);
      const content = readFileSync(logFile, 'utf-8');
      expect(content).toContain('"level":"error"');
      expect(content).toContain('something went wrong');
    });
  });

  describe('createProgressLogger', () => {
    it('logs messages in normal mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const logger = createProgressLogger(false);
      logger.log('hello world');
      expect(consoleSpy).toHaveBeenCalledWith('hello world');
    });

    it('outputs JSON in json mode', () => {
      const logger = createProgressLogger(true);
      logger.log('json message');
      expect(logger.jsonOutput).toHaveLength(1);
      expect(logger.jsonOutput[0]).toMatchObject({ type: 'progress', message: 'json message' });
    });
  });

  describe('printJsonOutput', () => {
    it('prints JSON stringified data', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      printJsonOutput({ test: true });
      expect(consoleSpy).toHaveBeenCalledOnce();
      const output = consoleSpy.mock.calls[0][0];
      expect(JSON.parse(output)).toEqual({ test: true });
    });
  });

  describe('createProgressLogger', () => {
    it('accumulates multiple JSON messages', () => {
      const logger = createProgressLogger(true);
      logger.log('first');
      logger.log('second');
      expect(logger.jsonOutput).toHaveLength(2);
      expect(logger.jsonOutput[0].message).toBe('first');
      expect(logger.jsonOutput[1].message).toBe('second');
    });

    it('warn method logs warnings', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logger = createProgressLogger(false);
      logger.warn('warning message');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('warning message'));
    });
  });
});
