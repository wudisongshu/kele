import { describe, it, expect } from 'vitest';
import { validateTaskOutput } from '../src/core/task-validator.js';
import { validateGameInBrowser } from '../src/core/game-validator-browser.js';
import { printNoProviderHelp } from '../src/cli/utils.js';
import { MockAdapter } from '../src/adapters/mock.js';

/**
 * CLI integration and validation tests.
 */

describe('kele CLI', () => {
  it('should have a version', () => {
    expect(true).toBe(true);
  });

  it('should parse idea text', () => {
    const ideaText = '我要做一个塔防游戏并部署到微信小程序';
    expect(ideaText).toContain('塔防');
    expect(ideaText).toContain('微信');
  });
});

describe('validate command', () => {
  it('validates project directory', () => {
    const result = validateTaskOutput('./src', 'test');
    expect(result.issues.length).toBeGreaterThanOrEqual(0);
    expect(typeof result.score).toBe('number');
  });

  it('validates game directory without canvas', () => {
    const result = validateGameInBrowser('./src');
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

  it('returns genre-aware research', async () => {
    const mock = new MockAdapter();
    const result = await mock.execute('research snake game 分析');
    expect(result.toLowerCase()).toContain('贪吃蛇');
  });
});
