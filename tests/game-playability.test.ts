import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  detectGameType,
  scorePlayability,
  generateSuggestions,
  formatPlayabilityScore,
} from '../src/core/game-playability.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), `kele-play-test-${Date.now()}`);

function writeGame(code: string, dir = TEST_DIR) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), `<!DOCTYPE html><html><script>${code}</script></html>`);
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
});

describe('detectGameType', () => {
  it('detects tower defense', () => {
    expect(detectGameType('class Tower { } enemy wave', '做一个塔防游戏')).toBe('tower-defense');
  });

  it('detects platformer', () => {
    expect(detectGameType('jump platform gravity', '平台跳跃游戏')).toBe('platformer');
  });

  it('detects racing', () => {
    expect(detectGameType('car speed race', '赛车游戏')).toBe('racing');
  });

  it('falls back to generic', () => {
    expect(detectGameType('hello world', '未知游戏')).toBe('generic');
  });
});

describe('scorePlayability', () => {
  it('scores a full tower defense game highly', () => {
    const code = `
      class ArrowTower {}
      class CannonTower {}
      class FastEnemy {}
      class BossEnemy {}
      function spawnEnemy() {}
      let waveNumber = 1;
      let gold = 100;
      function upgradeTower() {}
      function showShop() {}
      canvas.addEventListener('click', placeTower);
      canvas.addEventListener('drag', dragTower);
      function createParticle() {}
      function drawHealthBar() {}
    `;
    writeGame(code);
    const score = scorePlayability(TEST_DIR, '塔防游戏');
    expect(score.gameType).toBe('tower-defense');
    expect(score.total).toBeGreaterThanOrEqual(60);
    expect(score.categories.length).toBe(6);
    expect(['good', 'excellent']).toContain(score.verdict);
  });

  it('scores an empty game poorly', () => {
    const code = 'console.log("hello")';
    writeGame(code);
    const score = scorePlayability(TEST_DIR, '空游戏');
    expect(score.total).toBeLessThan(40);
    expect(score.verdict).toBe('poor');
    expect(score.suggestions.length).toBeGreaterThan(0);
  });

  it('scores a platformer with physics', () => {
    const code = `
      const gravity = 0.5;
      function jump() {}
      const velocity = { x: 0, y: 0 };
      class MovingPlatform {}
      class SpikeTrap {}
      function collectCoin() {}
      let lives = 3;
      function respawn() {}
    `;
    writeGame(code);
    const score = scorePlayability(TEST_DIR, '平台跳跃');
    expect(score.gameType).toBe('platformer');
    expect(score.categories.some((c) => c.name === '物理手感')).toBe(true);
    expect(score.total).toBeGreaterThanOrEqual(40);
  });

  it('scores a racing game with controls', () => {
    const code = `
      function steer() {}
      function accelerate() {}
      function brake() {}
      class Obstacle {}
      class RoadBlock {}
      let speed = 100;
      function boost() {}
      localStorage.setItem('bestTime', '12.5');
    `;
    writeGame(code);
    const score = scorePlayability(TEST_DIR, '赛车');
    expect(score.gameType).toBe('racing');
    expect(score.categories.some((c) => c.name === '操控响应')).toBe(true);
    expect(score.total).toBeGreaterThanOrEqual(40);
  });

  it('includes category details', () => {
    const code = `
      class Tower1 {}
      class Tower2 {}
      let gold = 0;
    `;
    writeGame(code);
    const score = scorePlayability(TEST_DIR, '塔防');
    const towerCat = score.categories.find((c) => c.name === '防御塔多样性');
    expect(towerCat).toBeDefined();
    expect(towerCat!.details.length).toBeGreaterThan(0);
  });
});

describe('generateSuggestions', () => {
  it('suggests improvements for low scores', () => {
    const categories = [
      { name: '防御塔多样性', score: 0, maxScore: 20, weight: 20, details: [] },
      { name: '敌人类型多样性', score: 5, maxScore: 20, weight: 20, details: [] },
    ];
    const suggestions = generateSuggestions(categories, 'tower-defense');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('防御塔'))).toBe(true);
  });

  it('returns positive message when all categories are good', () => {
    const categories = [
      { name: '防御塔多样性', score: 20, maxScore: 20, weight: 20, details: [] },
    ];
    const suggestions = generateSuggestions(categories, 'tower-defense');
    expect(suggestions.some((s) => s.includes('良好'))).toBe(true);
  });
});

describe('formatPlayabilityScore', () => {
  it('formats a readable report', () => {
    const score = scorePlayability(TEST_DIR, '塔防');
    const formatted = formatPlayabilityScore(score);
    expect(formatted).toContain('可玩性评分');
    expect(formatted).toContain('改进建议');
  });

  it('marks excellent scores correctly', () => {
    const formatted = formatPlayabilityScore({
      total: 85,
      categories: [],
      suggestions: [],
      verdict: 'excellent',
      gameType: 'tower-defense',
    });
    expect(formatted).toContain('优秀');
  });
});
