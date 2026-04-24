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
