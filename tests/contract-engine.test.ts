import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadContracts,
  matchContract,
  validateMutation,
  buildContractPrompt,
  validateContractCompliance,
  saveCustomContract,
  invalidateContractCache,
  type Contract,
} from '../src/core/contract-engine.js';

describe('contract-engine', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'kele-contract-test-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadContracts', () => {
    it('loads built-in contracts', () => {
      const contracts = loadContracts();
      expect(contracts.length).toBeGreaterThanOrEqual(10);
      const ids = contracts.map((c) => c.id);
      expect(ids).toContain('tetris');
      expect(ids).toContain('tower-defense');
      expect(ids).toContain('snake');
      expect(ids).toContain('flappy-bird');
    });
  });

  describe('matchContract', () => {
    it('matches tetris by exact name', () => {
      const c = matchContract('做一个俄罗斯方块游戏');
      expect(c).not.toBeNull();
      expect(c!.id).toBe('tetris');
    });

    it('matches tetris by alias', () => {
      const c = matchContract('like Tetris');
      expect(c).not.toBeNull();
      expect(c!.id).toBe('tetris');
    });

    it('matches tower defense', () => {
      const c = matchContract('做一个塔防游戏');
      expect(c).not.toBeNull();
      expect(c!.id).toBe('tower-defense');
    });

    it('matches snake', () => {
      const c = matchContract('snake game');
      expect(c).not.toBeNull();
      expect(c!.id).toBe('snake');
    });

    it('matches flappy bird', () => {
      const c = matchContract('flappy bird clone');
      expect(c).not.toBeNull();
      expect(c!.id).toBe('flappy-bird');
    });

    it('returns null for unrelated text', () => {
      const c = matchContract('做一个电商网站');
      expect(c).toBeNull();
    });
  });

  describe('validateMutation', () => {
    const tetris = matchContract('tetris')!;

    it('allows harmless mutation', () => {
      const result = validateMutation(tetris, '加一个爆炸效果');
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });

    it('rejects destructive mutation', () => {
      const result = validateMutation(tetris, '不要消行了');
      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes('消行'))).toBe(true);
    });

    it('preserves core mechanics when valid', () => {
      const result = validateMutation(tetris, '改个主题');
      expect(result.valid).toBe(true);
      expect(result.preservedCore.length).toBeGreaterThan(0);
    });
  });

  describe('buildContractPrompt', () => {
    const tetris = matchContract('tetris')!;

    it('includes core mechanics', () => {
      const prompt = buildContractPrompt(tetris, '');
      expect(prompt).toContain('俄罗斯方块');
      expect(prompt).toContain('7种四格方块');
      expect(prompt).toContain('不可删除或修改');
    });

    it('includes optional mechanics', () => {
      const prompt = buildContractPrompt(tetris, '');
      expect(prompt).toContain('可选增强');
    });

    it('includes user mutation', () => {
      const prompt = buildContractPrompt(tetris, '加个爆炸效果');
      expect(prompt).toContain('爆炸效果');
    });
  });

  describe('validateContractCompliance', () => {
    it('passes when all core mechanics are found', () => {
      const snake = matchContract('snake')!;
      writeFileSync(join(tmpDir, 'game.js'), `
        const snake = { segments: [], direction: 'right' };
        function spawnFood() { /* random */ }
        function grow() { snake.segments.push({}); }
        function checkCollision() { return hitSelf || hitWall; }
        let score = 0;
        function gameLoop() { requestAnimationFrame(gameLoop); }
      `);
      const result = validateContractCompliance(snake, tmpDir);
      expect(result.compliant).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('fails when core mechanics are missing', () => {
      const snake = matchContract('snake')!;
      writeFileSync(join(tmpDir, 'game.js'), `console.log('hello');`);
      const result = validateContractCompliance(snake, tmpDir);
      expect(result.compliant).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    it('checks HTML and JS combined', () => {
      const tetris = matchContract('tetris')!;
      writeFileSync(join(tmpDir, 'index.html'), `<script src="game.js"></script>`);
      writeFileSync(join(tmpDir, 'game.js'), `
        const pieces = ['I','J','L','O','S','T','Z'];
        function rotate() { /* wall kick */ }
        function clearLine() { board.splice(row, 1); }
        function drop() { y += gravity; }
        function gameOver() { alert('over'); }
        function gameLoop() { requestAnimationFrame(gameLoop); }
      `);
      const result = validateContractCompliance(tetris, tmpDir);
      expect(result.compliant).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });

  describe('saveCustomContract', () => {
    it('saves and reloads custom contract', () => {
      invalidateContractCache();
      const custom: Contract = {
        id: 'custom-test-game',
        name: '测试游戏',
        aliases: ['test game'],
        coreMechanics: [
          { id: 'jump', description: '跳跃', immutable: true, evidencePatterns: ['jump'] },
        ],
        optionalMechanics: [],
      };
      saveCustomContract(custom);
      const contracts = loadContracts();
      const found = contracts.find((c) => c.id === 'custom-test-game');
      expect(found).toBeDefined();
      expect(found!.name).toBe('测试游戏');
    });

    it('matches saved custom contract by alias', () => {
      invalidateContractCache();
      const custom: Contract = {
        id: 'custom-rhythm',
        name: '节奏游戏',
        aliases: ['rhythm', '音游', 'music game'],
        coreMechanics: [
          { id: 'beat', description: '节拍判定', immutable: true, evidencePatterns: ['beat', 'rhythm'] },
        ],
        optionalMechanics: [],
      };
      saveCustomContract(custom);
      const matched = matchContract('做一个音游');
      expect(matched).not.toBeNull();
      expect(matched!.id).toBe('custom-rhythm');
    });

    it('persists across cache invalidations when saved to disk', () => {
      invalidateContractCache();
      const custom: Contract = {
        id: 'persistent-game',
        name: '持久测试',
        aliases: ['persistent'],
        coreMechanics: [
          { id: 'test', description: '测试', immutable: true, evidencePatterns: ['test'] },
        ],
        optionalMechanics: [],
      };
      saveCustomContract(custom);
      invalidateContractCache(); // clear memory cache
      const matched = matchContract('persistent game');
      expect(matched).not.toBeNull();
      expect(matched!.id).toBe('persistent-game');
    });

    it('returns null for unknown contract', () => {
      invalidateContractCache();
      const matched = matchContract('something completely unrelated xyz123');
      expect(matched).toBeNull();
    });

    it('matches by name substring', () => {
      invalidateContractCache();
      const matched = matchContract('做一个俄罗斯方块游戏');
      expect(matched).not.toBeNull();
    });
  });
});
