import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProgressLogger, logEvent } from '../src/core/logger.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { LOG_FILE } from '../src/core/logger.js';

describe('Logger debug method', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // console.debug may not exist, so mock it if needed
    if (console.debug) {
      vi.spyOn(console, 'debug').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have debug method in text mode', () => {
    const logger = createProgressLogger(false);
    expect(logger.debug).toBeTypeOf('function');
    expect(() => logger.debug('test debug')).not.toThrow();
  });

  it('should have debug method in JSON mode', () => {
    const logger = createProgressLogger(true);
    expect(logger.debug).toBeTypeOf('function');
    expect(() => logger.debug('test debug json')).not.toThrow();
  });

  it('should not print debug to console in text mode', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const logger = createProgressLogger(false);
    logger.debug('secret debug msg');
    // Should NOT appear in console.log
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('secret debug msg'));
  });

  it('should accumulate debug entries in json mode', () => {
    const logger = createProgressLogger(true);
    logger.debug('json debug', { key: 'value' });
    const lastEntry = logger.jsonOutput[logger.jsonOutput.length - 1] as Record<string, unknown>;
    expect(lastEntry).toMatchObject({ type: 'debug', message: 'json debug', key: 'value' });
  });

  it('logEvent should accept debug level', () => {
    expect(() => logEvent('debug', 'debug test')).not.toThrow();
  });

  it('warn method works in text mode', () => {
    const logger = createProgressLogger(false);
    expect(() => logger.warn('warning')).not.toThrow();
  });

  it('error method works in text mode', () => {
    const logger = createProgressLogger(false);
    expect(() => logger.error('error msg')).not.toThrow();
  });
});
