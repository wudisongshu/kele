import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateGamePlayability } from '../src/core/game-validator.js';

function getTestDir() {
  return join(tmpdir(), `kele-game-val-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('game-validator', () => {
  let TEST_DIR: string;

  beforeEach(() => {
    TEST_DIR = getTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  it('fails for empty directory', () => {
    const result = validateGamePlayability(TEST_DIR);
    expect(result.playable).toBe(false);
    expect(result.score).toBe(0);
    expect(result.issues.some((i) => i.includes('less than 200 characters'))).toBe(true);
  });

  it('passes for a complete game with all critical patterns', () => {
    const gameCode = `
const ROWS = 8;
const COLS = 8;
let grid = [];
let board = [];

function init() {
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = Math.floor(Math.random() * 5);
    }
  }
}

document.addEventListener('click', handleClick);

function handleClick(e) {
  const cell = e.target;
  checkMatch();
}

function checkMatch() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      if (grid[r][c] === grid[r][c+1] && grid[r][c] === grid[r][c+2]) {
        return true;
      }
    }
  }
  return false;
}

let score = 0;
let level = 1;
let steps = 20;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, 100, 100);

function gameLoop() {
  requestAnimationFrame(gameLoop);
  update();
}

function update() {
  score += 10;
}

function eliminate() {
  grid[r][c] = null;
}

function gravity() {
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c] === null) {
        // drop tiles
      }
    }
  }
}

function spawn() {
  grid[r][c] = Math.floor(Math.random() * 5);
}

function swap(r1, c1, r2, c2) {
  const temp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = temp;
}

function animate() {
  cell.style.transform = 'scale(1.2)';
}

function gameOver() {
  alert('Game Over! Score: ' + score);
}
`;
    writeFileSync(join(TEST_DIR, 'game.js'), gameCode);
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body><canvas id="game"></canvas><script src="game.js"></script></body></html>');

    const result = validateGamePlayability(TEST_DIR);
    expect(result.playable).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.issues.filter((i) => i.startsWith('CRITICAL'))).toHaveLength(0);
  });

  it('fails when missing critical patterns', () => {
    const badCode = `
// Just some random code
console.log("hello");
let x = 1;
function foo() { return x + 1; }
`;
    writeFileSync(join(TEST_DIR, 'game.js'), badCode);
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body><script src="game.js"></script></body></html>');

    const result = validateGamePlayability(TEST_DIR);
    expect(result.playable).toBe(false);
    expect(result.issues.filter((i) => i.startsWith('CRITICAL')).length).toBeGreaterThan(0);
  });

  it('reads inline scripts from HTML', () => {
    const html = `<!DOCTYPE html>
<html>
<body>
<canvas id="game"></canvas>
<script>
const ROWS = 8, COLS = 8;
let grid = [];
document.addEventListener('click', function() {});
function checkMatch() { return true; }
let score = 0;
const ctx = document.getElementById('game').getContext('2d');
ctx.fillRect(0,0,10,10);
</script>
</body>
</html>`;
    writeFileSync(join(TEST_DIR, 'index.html'), html);

    const result = validateGamePlayability(TEST_DIR);
    // All critical patterns should be found in inline script
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('detects nice-to-have patterns', () => {
    const code = `
const ROWS = 8, COLS = 8, grid = [];
document.addEventListener('click', () => {});
function checkMatch() { return true; }
let score = 0;
const ctx = document.getElementById('game').getContext('2d');
ctx.fillRect(0,0,10,10);
// minimal game code without nice-to-have features
`;
    writeFileSync(join(TEST_DIR, 'game.js'), code);
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body><canvas id="game"></canvas><script src="game.js"></script></body></html>');

    const result = validateGamePlayability(TEST_DIR);
    // Critical all present, but nice-to-haves missing
    expect(result.score).toBeLessThan(100);
    expect(result.issues.some((i) => i.includes('game loop'))).toBe(true);
  });

  it('handles missing HTML file gracefully', () => {
    const code = `
const ROWS = 8, COLS = 8, grid = [];
document.addEventListener('click', () => {});
function checkMatch() { return true; }
let score = 0;
const ctx = document.getElementById('game').getContext('2d');
ctx.fillRect(0,0,10,10);
`;
    writeFileSync(join(TEST_DIR, 'app.js'), code);
    // No index.html, game.html, or app.html

    const result = validateGamePlayability(TEST_DIR);
    // Should still find patterns in JS files
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('detects missing canvas element', () => {
    const html = `<!DOCTYPE html>
<html><body>
<script>
document.addEventListener('click', () => {});
let score = 0;
</script>
</body></html>`;
    writeFileSync(join(TEST_DIR, 'index.html'), html);

    const result = validateGamePlayability(TEST_DIR);
    expect(result.playable).toBe(false);
    expect(result.issues.some((i) => i.includes('canvas'))).toBe(true);
  });

  it('detects missing input handlers', () => {
    const html = `<!DOCTYPE html>
<html><body>
<canvas id="game"></canvas>
<script>
const ctx = document.getElementById('game').getContext('2d');
ctx.fillRect(0,0,10,10);
let score = 0;
</script>
</body></html>`;
    writeFileSync(join(TEST_DIR, 'index.html'), html);

    const result = validateGamePlayability(TEST_DIR);
    expect(result.playable).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
