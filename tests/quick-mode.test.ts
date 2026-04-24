import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QuickModeEngine } from '../src/core/quick-mode.js';
import type { AIAdapter } from '../src/adapters/base.js';
import { rmSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join('/tmp', 'kele-quick-mode-test');

function makeMockAdapter(response: string): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockResolvedValue(response),
  } as unknown as AIAdapter;
}

function makeFailingAdapter(errorMsg: string): AIAdapter {
  return {
    name: 'mock-fail',
    isAvailable: () => true,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockRejectedValue(new Error(errorMsg)),
  } as unknown as AIAdapter;
}

describe('QuickModeEngine', () => {
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

  describe('isSimpleGame', () => {
    it('returns true for simple game keywords', () => {
      const engine = new QuickModeEngine(makeMockAdapter(''), TEST_DIR);
      expect(engine.isSimpleGame('我要做一个贪吃蛇游戏')).toBe(true);
      expect(engine.isSimpleGame('做个俄罗斯方块')).toBe(true);
      expect(engine.isSimpleGame('snake game')).toBe(true);
      expect(engine.isSimpleGame('tetris')).toBe(true);
      expect(engine.isSimpleGame('做个2048')).toBe(true);
      expect(engine.isSimpleGame('flappy bird')).toBe(true);
      expect(engine.isSimpleGame('待办清单工具')).toBe(true);
      expect(engine.isSimpleGame('计算器')).toBe(true);
    });

    it('returns false for complex keywords', () => {
      const engine = new QuickModeEngine(makeMockAdapter(''), TEST_DIR);
      expect(engine.isSimpleGame('做个带支付的RPG游戏')).toBe(false);
      expect(engine.isSimpleGame('多人在线对战游戏')).toBe(false);
      expect(engine.isSimpleGame('小程序版本的塔防')).toBe(false);
      expect(engine.isSimpleGame('带用户系统的贪吃蛇')).toBe(false);
      expect(engine.isSimpleGame('接入广告的弹球游戏')).toBe(false);
      expect(engine.isSimpleGame('带排行榜的打砖块')).toBe(false);
    });

    it('returns false when both simple and complex keywords present', () => {
      const engine = new QuickModeEngine(makeMockAdapter(''), TEST_DIR);
      expect(engine.isSimpleGame('做个带支付的贪吃蛇游戏')).toBe(false);
    });

    it('returns false for unrelated input', () => {
      const engine = new QuickModeEngine(makeMockAdapter(''), TEST_DIR);
      expect(engine.isSimpleGame('帮我写一篇论文')).toBe(false);
      expect(engine.isSimpleGame('分析股票市场')).toBe(false);
    });
  });

  describe('execute', () => {
    it('writes raw HTML to index.html when AI returns plain HTML', async () => {
      const html = '<!DOCTYPE html><html><head><title>Game</title></head><body><canvas id="game"></canvas><script>const canvas=document.getElementById("game");const ctx=canvas.getContext("2d");let score=0;let level=1;function gameLoop(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillRect(10,10,50,50);requestAnimationFrame(gameLoop);}document.addEventListener("keydown",function(e){score++;});gameLoop();</script></body></html>';
      const engine = new QuickModeEngine(makeMockAdapter(html), TEST_DIR);
      const result = await engine.execute('贪吃蛇');

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(join(TEST_DIR, 'index.html'));
      expect(existsSync(result.filePath)).toBe(true);
      expect(readFileSync(result.filePath, 'utf-8')).toBe(html);
    });

    it('extracts code from markdown html block', async () => {
      const html = '<!DOCTYPE html><html><head><title>Game</title></head><body><canvas id="game"></canvas><script>const canvas=document.getElementById("game");const ctx=canvas.getContext("2d");let score=0;let level=1;function gameLoop(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillRect(10,10,50,50);requestAnimationFrame(gameLoop);}document.addEventListener("keydown",function(e){score++;});gameLoop();</script></body></html>';
      const wrapped = `\`\`\`html\n${html}\n\`\`\``;
      const engine = new QuickModeEngine(makeMockAdapter(wrapped), TEST_DIR);
      const result = await engine.execute('贪吃蛇');

      expect(result.success).toBe(true);
      expect(readFileSync(result.filePath, 'utf-8')).toBe(html);
    });

    it('extracts code from generic markdown block', async () => {
      const html = '<!DOCTYPE html><html><head><title>Game</title></head><body><canvas id="game"></canvas><script>const canvas=document.getElementById("game");const ctx=canvas.getContext("2d");let score=0;let level=1;function gameLoop(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillRect(10,10,50,50);requestAnimationFrame(gameLoop);}document.addEventListener("keydown",function(e){score++;});gameLoop();</script></body></html>';
      const wrapped = `\`\`\`\n${html}\n\`\`\``;
      const engine = new QuickModeEngine(makeMockAdapter(wrapped), TEST_DIR);
      const result = await engine.execute('贪吃蛇');

      expect(result.success).toBe(true);
      expect(readFileSync(result.filePath, 'utf-8')).toBe(html);
    });

    it('extracts code from JSON files array', async () => {
      const html = '<!DOCTYPE html><html><head><title>Game</title></head><body><canvas id="game"></canvas><script>const canvas=document.getElementById("game");const ctx=canvas.getContext("2d");let score=0;let level=1;function gameLoop(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillRect(10,10,50,50);requestAnimationFrame(gameLoop);}document.addEventListener("keydown",function(e){score++;});gameLoop();</script></body></html>';
      const json = JSON.stringify({ files: [{ path: 'index.html', content: html }] });
      const engine = new QuickModeEngine(makeMockAdapter(json), TEST_DIR);
      const result = await engine.execute('贪吃蛇');

      expect(result.success).toBe(true);
      expect(readFileSync(result.filePath, 'utf-8')).toBe(html);
    });

    it('extracts code from JSON content field', async () => {
      const html = '<!DOCTYPE html><html><head><title>Game</title></head><body><canvas id="game"></canvas><script>const canvas=document.getElementById("game");const ctx=canvas.getContext("2d");let score=0;let level=1;function gameLoop(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillRect(10,10,50,50);requestAnimationFrame(gameLoop);}document.addEventListener("keydown",function(e){score++;});gameLoop();</script></body></html>';
      const json = JSON.stringify({ content: html });
      const engine = new QuickModeEngine(makeMockAdapter(json), TEST_DIR);
      const result = await engine.execute('贪吃蛇');

      expect(result.success).toBe(true);
      expect(readFileSync(result.filePath, 'utf-8')).toBe(html);
    });

    it('extracts code from JSON code field', async () => {
      const html = '<!DOCTYPE html><html><head><title>Game</title></head><body><canvas id="game"></canvas><script>const canvas=document.getElementById("game");const ctx=canvas.getContext("2d");let score=0;let level=1;function gameLoop(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillRect(10,10,50,50);requestAnimationFrame(gameLoop);}document.addEventListener("keydown",function(e){score++;});gameLoop();</script></body></html>';
      const json = JSON.stringify({ code: html });
      const engine = new QuickModeEngine(makeMockAdapter(json), TEST_DIR);
      const result = await engine.execute('贪吃蛇');

      expect(result.success).toBe(true);
      expect(readFileSync(result.filePath, 'utf-8')).toBe(html);
    });

    it('returns error for empty AI response', async () => {
      const engine = new QuickModeEngine(makeMockAdapter('   '), TEST_DIR);
      const result = await engine.execute('贪吃蛇');

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty or too short');
    });

    it('returns error when AI adapter throws', async () => {
      const engine = new QuickModeEngine(makeFailingAdapter('network error'), TEST_DIR);
      const result = await engine.execute('贪吃蛇');

      expect(result.success).toBe(false);
      expect(result.error).toContain('network error');
    });
  });

  describe('validate', () => {
    it('returns false for missing index.html', async () => {
      const engine = new QuickModeEngine(makeMockAdapter(''), TEST_DIR);
      const result = await engine.validate();
      expect(result.playable).toBe(false);
      expect(result.score).toBe(0);
    });

    it('returns false for invalid HTML game', async () => {
      const html = '<html><body>Not a game, just some text to make it longer than one hundred characters for the length check</body></html>';
      const engine = new QuickModeEngine(makeMockAdapter(html), TEST_DIR);
      await engine.execute('test');
      const result = await engine.validate();
      // Missing canvas, game loop, input handlers → not playable
      expect(result.playable).toBe(false);
      expect(result.checks.http200).toBe(true);
      expect(result.checks.canvasRendering).toBe(false);
    });

    it('returns true for a valid canvas game HTML', async () => {
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Game</title></head>
<body>
<div id="menu"><button>Start</button></div>
<canvas id="game"></canvas>
<script>
  class Enemy { constructor() { this.hp = 10; } }
  class Tower { constructor() { this.level = 1; } }
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let score = 0;
  let gold = 0;
  let wave = 1;
  function gameLoop() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillRect(10,10,50,50);
    requestAnimationFrame(gameLoop);
  }
  document.addEventListener('keydown', function(e) { score++; });
  gameLoop();
</script>
</body>
</html>`;
      const engine = new QuickModeEngine(makeMockAdapter(html), TEST_DIR);
      await engine.execute('test');
      const result = await engine.validate();
      expect(result.playable).toBe(true);
      expect(result.score).toBe(100);
    });
  });
});
