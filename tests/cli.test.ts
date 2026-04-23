import { describe, it, expect, vi } from 'vitest';
import { validateTaskOutput } from '../src/core/task-validator.js';
import { validateGameInBrowser } from '../src/core/game-validator-browser.js';
import { generateProjectSlug, formatDuration, collectHeaders, parseTimeout, version } from '../src/cli/utils.js';
import { MockAdapter } from '../src/adapters/mock.js';

describe('kele CLI', () => {
  it('has a version string', () => {
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  it('generateProjectSlug creates slug from english words', () => {
    expect(generateProjectSlug('build a snake game', 'game')).toBe('build-snake-game');
    expect(generateProjectSlug('tower defense', 'game')).toBe('tower-defense');
  });

  it('generateProjectSlug falls back to type + random suffix for non-english', () => {
    const slug = generateProjectSlug('塔防游戏', 'game');
    expect(slug.startsWith('game-')).toBe(true);
    expect(slug.length).toBeGreaterThan(10);
  });

  it('formatDuration formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('collectHeaders accumulates headers', () => {
    const result = collectHeaders('Authorization: Bearer xxx', {});
    expect(result).toEqual({ Authorization: 'Bearer xxx' });

    const result2 = collectHeaders('X-Custom: value', result);
    expect(result2).toEqual({ Authorization: 'Bearer xxx', 'X-Custom': 'value' });
  });

  it('parseTimeout parses valid numbers', () => {
    expect(parseTimeout('30')).toBe(30);
    expect(parseTimeout('100')).toBe(100);
  });

  it('parseTimeout warns and returns default for invalid input', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseTimeout('invalid')).toBe(3000);
    expect(parseTimeout('-1')).toBe(3000);
    expect(parseTimeout('0')).toBe(3000);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('validate command', () => {
  it('validates project directory', () => {
    const result = validateTaskOutput('./src', 'test');
    expect(result.issues.length).toBeGreaterThanOrEqual(0);
    expect(typeof result.score).toBe('number');
  });

  it('validates game directory without canvas', async () => {
    const result = await validateGameInBrowser('./src');
    expect(result.playable).toBe(false);
    expect(result.score).toBeLessThan(60);
  });
});

describe('mock adapter', () => {
  it('returns different game types', async () => {
    const mock = new MockAdapter();
    const snakeResult = await mock.execute('build a snake game core feature');
    expect(snakeResult).toContain('snake');
    const tetrisResult = await mock.execute('build tetris core feature');
    expect(tetrisResult).toContain('tetris');
  });

  it('returns tower defense game for tower keywords', async () => {
    const mock = new MockAdapter();
    const result = await mock.execute('build a tower defense game core feature');
    const parsed = JSON.parse(result);
    expect(parsed.files[0].content).toContain('塔防');
  });

  it('returns platformer game for platform/jump keywords', async () => {
    const mock = new MockAdapter();
    const result = await mock.execute('build a platform jumping game core feature');
    const parsed = JSON.parse(result);
    expect(parsed.files[0].content).toContain('平台');
  });

  it('returns racing game for car/race keywords', async () => {
    const mock = new MockAdapter();
    const result = await mock.execute('build a racing car game core feature');
    const parsed = JSON.parse(result);
    expect(parsed.files[0].content).toContain('赛车');
  });

  it('returns genre-aware research', async () => {
    const mock = new MockAdapter();
    const result = await mock.execute('research snake game 分析');
    expect(result.toLowerCase()).toContain('贪吃蛇');
  });

  it('returns match-3 game for match keywords', async () => {
    const mock = new MockAdapter();
    const result = await mock.execute('build a match-3 game core feature');
    const parsed = JSON.parse(result);
    expect(parsed.files.length).toBeGreaterThan(0);
    expect(parsed.files[0].path).toBe('index.html');
  });
});
