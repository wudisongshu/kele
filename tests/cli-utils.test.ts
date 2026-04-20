import { describe, it, expect } from 'vitest';
import { generateProjectSlug, printNoProviderHelp } from '../src/cli/utils.js';

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
    expect(logs.some(l => l.includes('Mock'))).toBe(true);
  });
});
