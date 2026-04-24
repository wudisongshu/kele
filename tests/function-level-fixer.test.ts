import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FunctionLevelFixer } from '../src/core/function-level-fixer.js';
import type { AIAdapter } from '../src/adapters/base.js';
import { rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join('/tmp', 'kele-function-fixer-test');

function makeMockAdapter(response: string): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockResolvedValue(response),
  } as unknown as AIAdapter;
}

function makeFailingAdapter(): AIAdapter {
  return {
    name: 'mock-fail',
    isAvailable: () => true,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockResolvedValue('{}'),
  } as unknown as AIAdapter;
}

describe('FunctionLevelFixer', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('findStubFunctions', () => {
    it('finds empty function', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function init() {}\nfunction run() { console.log(1); }\n');

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(1);
      expect(stubs[0].name).toBe('init');
    });

    it('finds function with only comment', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function draw() {\n  // TODO\n}\n');

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(1);
      expect(stubs[0].name).toBe('draw');
    });

    it('finds function with TODO keyword', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function update() {\n  // TODO: implement\n  return 0;\n}\n');

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(1);
      expect(stubs[0].name).toBe('update');
    });

    it('ignores fully implemented functions', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function run() { console.log(1); return 2; }\n');

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(0);
    });

    it('finds multiple stubs', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(
        filePath,
        'function a() {}\nfunction b() { /* wip */ }\nfunction c() { console.log(1); }\n',
      );

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(2);
      expect(stubs.map((s) => s.name)).toContain('a');
      expect(stubs.map((s) => s.name)).toContain('b');
    });

    it('extracts context lines', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(
        filePath,
        'const x = 1;\nconst y = 2;\nconst z = 3;\nfunction empty() {}\nconst after = 4;\n',
      );

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(1);
      expect(stubs[0].contextBefore).toContain('x = 1');
      expect(stubs[0].contextAfter).toContain('after = 4');
    });

    it('handles multiline function signatures', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(
        filePath,
        'function longName(\n  arg1,\n  arg2\n) {\n  // TODO\n}\n',
      );

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(1);
      expect(stubs[0].name).toBe('longName');
    });

    it('ignores JavaScript keywords like if/while/for', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(
        filePath,
        'function checkWin() {\n  if (player.score >= 5) {\n    winner = \"player\";\n  }\n  while (running) {\n    update();\n  }\n  for (let i = 0; i < 10; i++) {\n    draw();\n  }\n}\n',
      );

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(0);
    });

    it('detects contaminated functions with leaked game logic in catch blocks', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      // Simulate a function whose body contains a catch block with leaked lockPiece/clearLines logic
      writeFileSync(
        filePath,
        `function drop() {
  try {
    this.piece.y++;
  } catch (err) {
    this.piece.y--;
    this.lockPiece();
    this.board[this.piece.y][this.piece.x] = this.piece.color;
    this.clearLines();
    this.score += 100;
    this.piece = this.newPiece();
    if (this.collide(this.piece)) {
      this.gameOver = true;
    }
  }
}\n`,
      );

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs.length).toBeGreaterThanOrEqual(1);
      const contaminated = stubs.find((s) => s.name === 'drop');
      expect(contaminated).toBeDefined();
      expect(contaminated!.isContaminated).toBe(true);
      expect(contaminated!.originalBody).toContain('this.lockPiece');
    });

    it('ignores clean functions without leaked logic', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(
        filePath,
        `function drop() {
  try {
    this.piece.y++;
  } catch (err) {
    console.error('drop failed', err);
  }
}\n`,
      );

      const stubs = await fixer.findStubFunctions(filePath);
      expect(stubs).toHaveLength(0);
    });

    it('preCheckSyntax detects unclosed string quote', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'broken.html');
      writeFileSync(
        filePath,
        `<!DOCTYPE html>
<html>
<script>
  const x = 'unclosed string;
</script>
</html>`,
      );

      const result = await fixer.preCheckSyntax(filePath);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('preCheckSyntax passes for valid JS', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'valid.html');
      writeFileSync(
        filePath,
        `<!DOCTYPE html>
<html>
<script>
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  function loop() {
    requestAnimationFrame(loop);
  }
</script>
</html>`,
      );

      const result = await fixer.preCheckSyntax(filePath);
      expect(result.valid).toBe(true);
    });

    it('preCheckSyntax fails when no script tag', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'no-script.html');
      writeFileSync(filePath, `<!DOCTYPE html><html><body>Hello</body></html>`);

      const result = await fixer.preCheckSyntax(filePath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No inline script');
    });

    it('fixSyntaxError rewrites file and verifies syntax', async () => {
      const fixedHtml = `<!DOCTYPE html>
<html>
<script>
  const x = 'fixed';
</script>
</html>`;
      const fixer = new FunctionLevelFixer(makeMockAdapter(fixedHtml));
      const filePath = join(TEST_DIR, 'syntax-broken.html');
      writeFileSync(
        filePath,
        `<!DOCTYPE html>
<html>
<script>
  const x = 'broken;
</script>
</html>`,
      );

      const result = await fixer.fixSyntaxError(filePath, 'Unclosed string', 3, 'test game');
      expect(result).toBe(true);

      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('fixed');
    });

    it('fixSyntaxError returns false when AI gives bad response', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter('too short'));
      const filePath = join(TEST_DIR, 'syntax-bad.html');
      writeFileSync(
        filePath,
        `<!DOCTYPE html>
<html>
<script>
  const x = 'broken;
</script>
</html>`,
      );

      const result = await fixer.fixSyntaxError(filePath, 'Unclosed string', 3, 'test game');
      expect(result).toBe(false);
    });
  });

  describe('fixStub', () => {
    it('replaces empty function body', async () => {
      const newBody = '{\n  console.log("fixed");\n}';
      const fixer = new FunctionLevelFixer(makeMockAdapter(newBody));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function init() {}\nfunction run() { console.log(1); }\n');

      const stubs = await fixer.findStubFunctions(filePath);
      const success = await fixer.fixStub(stubs[0], filePath, 'test game');

      expect(success).toBe(true);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('console.log("fixed")');
      expect(content).toContain('function run()');
    });

    it('skips replacement when AI returns too short', async () => {
      const fixer = new FunctionLevelFixer(makeFailingAdapter());
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function init() {}\n');

      const stubs = await fixer.findStubFunctions(filePath);
      const success = await fixer.fixStub(stubs[0], filePath, 'test game');

      expect(success).toBe(false);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toBe('function init() {}\n');
    });
  });

  describe('fixFile', () => {
    it('fixes all stubs in one round', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter('{\n  return 42;\n}'));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function a() {}\nfunction b() {}\n');

      const result = await fixer.fixFile(filePath, 'test game', 3);

      expect(result).toBe(true);
      const content = readFileSync(filePath, 'utf-8');
      expect(content).toContain('return 42');
      expect(content).not.toContain('function a() {}');
      expect(content).not.toContain('function b() {}');
    });

    it('returns true when no stubs exist', async () => {
      const fixer = new FunctionLevelFixer(makeMockAdapter(''));
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function run() { console.log(1); }\n');

      const result = await fixer.fixFile(filePath, 'test game', 3);

      expect(result).toBe(true);
    });

    it('returns false when some stubs remain unfixed', async () => {
      const fixer = new FunctionLevelFixer(makeFailingAdapter());
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function a() {}\n');

      const result = await fixer.fixFile(filePath, 'test game', 3);

      expect(result).toBe(false);
    });

    it('runs multiple rounds if needed', async () => {
      // First call fixes a, second call fixes b
      const adapter = makeMockAdapter('{\n  return 1;\n}');
      let callCount = 0;
      adapter.execute = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve('{\n  return ' + callCount + ';\n}');
      });

      const fixer = new FunctionLevelFixer(adapter);
      const filePath = join(TEST_DIR, 'game.js');
      writeFileSync(filePath, 'function a() {}\nfunction b() {}\n');

      const result = await fixer.fixFile(filePath, 'test game', 3);

      expect(result).toBe(true);
      expect(callCount).toBe(2);
    });
  });
});
