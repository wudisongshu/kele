import { describe, it, expect, vi } from 'vitest';
import { generateProjectSlug, printNoProviderHelp, formatDuration, collectHeaders, parseTimeout } from '../src/cli/utils.js';

describe('generateProjectSlug', () => {
  it('uses English words from idea text', () => {
    expect(generateProjectSlug('A cool game', 'game')).toBe('cool-game');
    expect(generateProjectSlug('Todo list app', 'tool')).toBe('todo-list-app');
  });

  it('limits to 3 words', () => {
    expect(generateProjectSlug('One two three four five', 'tool')).toBe('one-two-three');
  });

  it('falls back to type + random suffix for non-English text', () => {
    const slug = generateProjectSlug('一个中文想法', 'game');
    expect(slug.startsWith('game-')).toBe(true);
    expect(slug.length).toBeGreaterThan(10);
  });

  it('handles mixed Chinese and English', () => {
    expect(generateProjectSlug('一个 cool game', 'game')).toBe('cool-game');
  });
});

describe('printNoProviderHelp', () => {
  it('prints provider setup instructions', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    printNoProviderHelp();

    console.log = originalLog;
    expect(logs.some(l => l.includes('kimi'))).toBe(true);
    expect(logs.some(l => l.includes('deepseek'))).toBe(true);
    expect(logs.some(l => l.includes('mock'))).toBe(true);
  });
});

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(59000)).toBe('59.0s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });
});

describe('collectHeaders', () => {
  it('collects header key-value pairs', () => {
    const result = collectHeaders('X-Custom: value', {});
    expect(result).toEqual({ 'X-Custom': 'value' });
  });

  it('accumulates multiple headers', () => {
    const result = collectHeaders('X-First: one', { 'X-Second': 'two' });
    expect(result).toEqual({ 'X-Second': 'two', 'X-First': 'one' });
  });

  it('ignores malformed headers', () => {
    const result = collectHeaders('no-colon-here', { existing: 'val' });
    expect(result).toEqual({ existing: 'val' });
  });
});

describe('parseTimeout', () => {
  it('parses valid timeout', () => {
    expect(parseTimeout('5000')).toBe(5000);
    expect(parseTimeout('60')).toBe(60);
  });

  it('falls back to default for invalid input', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseTimeout('invalid')).toBe(3000);
    expect(parseTimeout('-1')).toBe(3000);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('parses timeout with number input', () => {
    expect(parseTimeout(5000 as any)).toBe(5000);
  });
});
