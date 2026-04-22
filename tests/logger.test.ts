import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logEvent, createProgressLogger, printJsonOutput } from '../src/core/logger.js';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_DIR = join(homedir(), '.kele', 'logs');

describe('logger', () => {
  beforeEach(() => {
    // Clean up log files before each test
    if (existsSync(LOG_DIR)) {
      const files = require('fs').readdirSync(LOG_DIR);
      for (const f of files) {
        if (f.startsWith('kele-') && f.endsWith('.log')) {
          rmSync(join(LOG_DIR, f), { force: true });
        }
      }
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logEvent', () => {
    it('writes a log entry to file', () => {
      logEvent('info', 'test message', { key: 'value' });
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(LOG_DIR, `kele-${date}.log`);
      expect(existsSync(logFile)).toBe(true);
      const content = readFileSync(logFile, 'utf-8');
      expect(content).toContain('test message');
      expect(content).toContain('"level":"info"');
    });

    it('writes error level log', () => {
      logEvent('error', 'something went wrong');
      const date = new Date().toISOString().split('T')[0];
      const logFile = join(LOG_DIR, `kele-${date}.log`);
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
});
