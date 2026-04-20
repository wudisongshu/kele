import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runAcceptanceCriteria } from '../src/core/acceptance-runner.js';
import type { SubProject } from '../src/types/index.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('AcceptanceRunner', () => {
  let tmpDir: string;
  let subProject: SubProject;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'kele-acceptance-test-'));
    subProject = {
      id: 'test-sp',
      name: 'Test SubProject',
      description: 'For testing',
      type: 'development',
      targetDir: tmpDir,
      dependencies: [],
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should pass when no acceptance criteria defined', () => {
    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.results).toHaveLength(0);
  });

  it('should verify file existence', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html></html>');
    subProject.acceptanceCriteria = [
      {
        description: 'index.html exists',
        type: 'functional',
        action: 'verify-file',
        target: 'index.html',
        expected: 'file exists',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('should fail when required file is missing', () => {
    subProject.acceptanceCriteria = [
      {
        description: 'index.html exists',
        type: 'functional',
        action: 'verify-file',
        target: 'index.html',
        expected: 'file exists',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(false);
    expect(result.results[0].passed).toBe(false);
    expect(result.results[0].actual).toContain('File not found');
  });

  it('should check HTML elements', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<!DOCTYPE html><html><body><canvas id="game"></canvas></body></html>');
    subProject.acceptanceCriteria = [
      {
        description: 'Canvas element exists',
        type: 'visual',
        action: 'check-element',
        target: 'canvas',
        expected: 'canvas element present',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.results[0].passed).toBe(true);
  });

  it('should check element by ID', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<div id="score">0</div>');
    subProject.acceptanceCriteria = [
      {
        description: 'Score display exists',
        type: 'visual',
        action: 'check-element',
        target: '#score',
        expected: 'score element present',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
  });

  it('should check text in JS files', () => {
    writeFileSync(join(tmpDir, 'game.js'), 'function handleClick() { selectGem(); }');
    subProject.acceptanceCriteria = [
      {
        description: 'Click handler exists',
        type: 'functional',
        action: 'check-text',
        target: 'game.js',
        expected: 'handleClick',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
  });

  it('should verify game mechanics', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<canvas></canvas>');
    writeFileSync(join(tmpDir, 'game.js'), `
      function render() { ctx.fillRect(0,0,10,10); }
      canvas.addEventListener('click', handleClick);
      function handleClick() { swapGems(); checkMatches(); }
      let score = 0;
      function addScore(p) { score += p; }
      function applyGravity() { fillEmptySlots(); }
      function gameLoop() { requestAnimationFrame(gameLoop); }
    `);
    subProject.acceptanceCriteria = [
      { description: 'Canvas renders game board', type: 'visual', action: 'play-game', target: '', expected: 'rendering works', critical: true },
      { description: 'Click selects gem', type: 'functional', action: 'play-game', target: '', expected: 'click works', critical: true },
      { description: 'Swap and match logic', type: 'functional', action: 'play-game', target: '', expected: 'match works', critical: true },
      { description: 'Score updates', type: 'functional', action: 'play-game', target: '', expected: 'score works', critical: true },
      { description: 'Gravity refills board', type: 'functional', action: 'play-game', target: '', expected: 'gravity works', critical: true },
      { description: 'Game loop runs', type: 'functional', action: 'play-game', target: '', expected: 'loop works', critical: false },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.results.every(r => r.passed)).toBe(true);
  });

  it('should calculate score based on critical vs non-critical', () => {
    writeFileSync(join(tmpDir, 'game.js'), 'console.log("minimal");');
    subProject.acceptanceCriteria = [
      { description: 'Canvas renders game board', type: 'visual', action: 'play-game', target: '', expected: '', critical: true },
      { description: 'Score updates', type: 'functional', action: 'play-game', target: '', expected: '', critical: false },
    ];

    const result = runAcceptanceCriteria(subProject);
    // Critical fails → score = 0 (critical portion) + some non-critical portion
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(70);
  });
});
