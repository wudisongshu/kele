import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameGenerator } from '../../src/core/generator.js';
import { GameValidator } from '../../src/core/validator.js';
import { MockAdapter } from '../../src/ai/providers/mock.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TEST_CASES = [
  { name: 'Snake', input: '做一个贪吃蛇游戏' },
  { name: 'Pong', input: '做一个弹球游戏' },
  { name: 'Tetris', input: '做一个俄罗斯方块游戏' },
  { name: 'Breakout', input: '做一个打砖块游戏' },
  { name: 'Flappy Bird', input: '做一个像素鸟游戏' },
];

describe('E2E: Generate classic games', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'kele-e2e-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  for (const testCase of TEST_CASES) {
    it(`generates a playable ${testCase.name} game`, async () => {
      const adapter = new MockAdapter();
      const generator = new GameGenerator(adapter, testDir);
      const result = await generator.generate(testCase.input);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(join(testDir, 'index.html'));

      const validator = new GameValidator(testDir);
      const playability = await validator.validate('index.html');

      expect(playability.checks.http200).toBe(true);
      expect(playability.checks.syntaxValid).toBe(true);
      expect(playability.checks.canvasRendering).toBe(true);
      expect(playability.checks.inputResponsive).toBe(true);
      expect(playability.checks.noConsoleErrors).toBe(true);
      expect(playability.score).toBe(100);
      expect(playability.playable).toBe(true);
    });
  }
});
