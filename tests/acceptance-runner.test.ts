import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runAcceptanceCriteria, normalizeCriterion, isDescriptiveExpectation } from '../src/core/acceptance-runner.js';
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

  it('should smart-detect game logic JS file when hardcoded path is missing', () => {
    mkdirSync(join(tmpDir, 'src'));
    writeFileSync(join(tmpDir, 'src', 'app.js'), 'function gameLoop() { requestAnimationFrame(gameLoop); }');
    subProject.acceptanceCriteria = [
      {
        description: 'Main game logic file exists',
        type: 'functional',
        action: 'verify-file',
        target: 'js/game.js',
        expected: 'file exists',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].actual).toContain('src/app.js');
  });

  it('should smart-detect stylesheet when hardcoded path is missing', () => {
    writeFileSync(join(tmpDir, 'styles.css'), 'body { margin: 0; }');
    subProject.acceptanceCriteria = [
      {
        description: 'Stylesheet exists',
        type: 'functional',
        action: 'verify-file',
        target: 'css/style.css',
        expected: 'file exists',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].actual).toContain('styles.css');
  });

  it('should smart-detect canvas in index.html', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<!DOCTYPE html><html><body><canvas id="game"></canvas></body></html>');
    subProject.acceptanceCriteria = [
      {
        description: 'Canvas element exists',
        type: 'visual',
        action: 'verify-file',
        target: 'index.html',
        expected: 'has canvas',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].actual).toContain('index.html');
  });

  it('should smart-detect canvas via getContext in JS', () => {
    writeFileSync(join(tmpDir, 'script.js'), 'const ctx = canvas.getContext("2d");');
    subProject.acceptanceCriteria = [
      {
        description: 'Canvas 2D context initialized',
        type: 'functional',
        action: 'verify-file',
        target: 'game.js',
        expected: 'contains getContext',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.results[0].passed).toBe(true);
    expect(result.results[0].actual).toContain('script.js');
  });

  it('should fail when critical criterion is not met', () => {
    subProject.acceptanceCriteria = [
      {
        description: 'Must have nonexistent file',
        type: 'structural',
        action: 'verify-file',
        target: 'nonexistent.txt',
        expected: 'file exists',
        critical: true,
      },
    ];

    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(false);
    expect(result.results[0].passed).toBe(false);
  });
});


describe('normalizeCriterion', () => {
  it('infers file_exists from verify-file + existence expected', () => {
    const c = normalizeCriterion({
      description: 'index.html exists', type: 'functional', action: 'verify-file',
      target: 'index.html', expected: 'file exists', critical: true,
    });
    expect(c.inferredCheckType).toBe('file_exists');
  });

  it('infers file_exists from verify-file + "is present" expected', () => {
    const c = normalizeCriterion({
      description: 'Setup doc', type: 'functional', action: 'verify-file',
      target: 'SETUP.md', expected: 'SETUP.md is present in project root', critical: true,
    });
    expect(c.inferredCheckType).toBe('file_exists');
  });

  it('infers content_contains from check-text', () => {
    const c = normalizeCriterion({
      description: 'Has canvas', type: 'visual', action: 'check-text',
      target: 'index.html', expected: 'file contains <canvas', critical: true,
    });
    expect(c.inferredCheckType).toBe('content_contains');
    expect(c.expected).toBe('<canvas');
  });

  it('infers content_contains from verify-file + non-existence expected', () => {
    const c = normalizeCriterion({
      description: 'Has getContext', type: 'functional', action: 'verify-file',
      target: 'game.js', expected: 'contains getContext', critical: true,
    });
    expect(c.inferredCheckType).toBe('content_contains');
  });

  it('preserves explicit checkType when provided', () => {
    const c = normalizeCriterion({
      description: 'X', type: 'functional', action: 'verify-file',
      checkType: 'content_contains', target: 'a.js', expected: 'foo', critical: true,
    });
    expect(c.inferredCheckType).toBe('content_contains');
  });

  it('detects descriptive expectations', () => {
    expect(isDescriptiveExpectation('file contains <canvas')).toBe(true);
    expect(isDescriptiveExpectation('has viewport')).toBe(true);
    expect(isDescriptiveExpectation('must include cookie')).toBe(true);
    expect(isDescriptiveExpectation('<canvas id="game"')).toBe(false);
    expect(isDescriptiveExpectation('import { foo }')).toBe(false);
  });
});

describe('runAcceptanceCriteria with checkType', () => {
  let tmpDir: string;
  let subProject: SubProject;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'kele-acceptance-v2-'));
    subProject = {
      id: 'test-sp', name: 'Test', description: 'For testing', type: 'development',
      targetDir: tmpDir, dependencies: [], status: 'pending', createdAt: new Date().toISOString(),
    };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('file_exists only checks existence, not content', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<html></html>');
    subProject.acceptanceCriteria = [{
      description: 'index.html exists', type: 'functional', action: 'verify-file',
      checkType: 'file_exists', target: 'index.html', expected: 'index.html is present in project root', critical: true,
    }];
    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
    expect(result.results[0].actual).toContain('File exists');
  });

  it('content_contains matches real code snippet', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<!DOCTYPE html><html><body><canvas id="game"></canvas></body></html>');
    subProject.acceptanceCriteria = [{
      description: 'Canvas exists', type: 'visual', action: 'check-text',
      checkType: 'content_contains', target: 'index.html', expected: '<canvas id="game">', critical: true,
    }];
    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
  });

  it('content_contains cleans descriptive prefix', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<meta name="viewport" content="width=device-width">');
    subProject.acceptanceCriteria = [{
      description: 'Viewport meta', type: 'visual', action: 'check-text',
      target: 'index.html', expected: 'file contains viewport', critical: true,
    }];
    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
  });

  it('regex_match uses pattern', () => {
    writeFileSync(join(tmpDir, 'index.html'), '<meta name="viewport" content="width=device-width">');
    subProject.acceptanceCriteria = [{
      description: 'Viewport regex', type: 'visual', action: 'check-text',
      checkType: 'regex_match', target: 'index.html', expected: '', regexPattern: '<meta[^>]+viewport', critical: true,
    }];
    const result = runAcceptanceCriteria(subProject);
    expect(result.passed).toBe(true);
  });
});
