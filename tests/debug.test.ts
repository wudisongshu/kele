import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDebug, setDebug, debugLog, debugTimerStart, debugTimerEnd, debugCounter, debugCounterGet } from '../src/debug.js';

describe('debug', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    setDebug(true);
    process.env = { ...originalEnv };
    delete process.env.KELE_DEBUG;
    delete process.env.DEBUG;
  });

  afterEach(() => {
    process.env = originalEnv;
    setDebug(true);
  });

  it('isDebug returns true by default', () => {
    expect(isDebug()).toBe(true);
  });

  it('isDebug returns false when setDebug(false) called', () => {
    setDebug(false);
    expect(isDebug()).toBe(false);
  });

  it('isDebug returns true when KELE_DEBUG=1', () => {
    process.env.KELE_DEBUG = '1';
    expect(isDebug()).toBe(true);
  });

  it('isDebug returns false when KELE_DEBUG=0', () => {
    setDebug(true);
    process.env.KELE_DEBUG = '0';
    expect(isDebug()).toBe(false);
  });

  it('isDebug returns true when DEBUG includes kele', () => {
    process.env.DEBUG = 'kele,other';
    expect(isDebug()).toBe(true);
  });

  it('isDebug returns true when DEBUG does not include kele', () => {
    process.env.DEBUG = 'other';
    expect(isDebug()).toBe(true);
  });

  it('debugLog prints and saves when debug is on', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('test-label', 'test-content');
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('debugLog does nothing when debug is off', () => {
    setDebug(false);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('test', 'content');
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('debugTimerStart/End logs duration when debug is on', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugTimerStart('t2');
    debugTimerEnd('t2');
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('debugTimerStart/End does nothing when debug is off', () => {
    setDebug(false);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugTimerStart('t1');
    debugTimerEnd('t1');
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('debugCounter increments and retrieves count', () => {
    debugCounter('c1');
    debugCounter('c1');
    debugCounter('c1');
    expect(debugCounterGet('c1')).toBe(3);
    expect(debugCounterGet('c1')).toBe(0); // reset after get
  });

  it('debugCounter does nothing when debug is off', () => {
    setDebug(false);
    debugCounter('c2');
    expect(debugCounterGet('c2')).toBe(0);
  });

  it('debugTimerEnd handles unknown timer gracefully', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugTimerEnd('nonexistent');
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
