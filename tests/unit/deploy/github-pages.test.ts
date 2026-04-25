import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  migrateRootGame,
  generateRootIndex,
  buildNavPage,
  detectGameType,
} from '../../../src/deploy/platforms/github-pages.js';

describe('Unit: migrateRootGame', () => {
  let deployDir: string;

  beforeEach(() => {
    deployDir = mkdtempSync(join(tmpdir(), 'kele-migrate-'));
  });

  afterEach(() => {
    rmSync(deployDir, { recursive: true, force: true });
  });

  it('does nothing when no root manifest exists', () => {
    migrateRootGame(deployDir);
    expect(existsSync(join(deployDir, 'game-legacy'))).toBe(false);
  });

  it('migrates root game files into game-legacy/', () => {
    writeFileSync(join(deployDir, 'index.html'), '<html>game</html>');
    writeFileSync(join(deployDir, 'manifest.json'), '{"name":"Old Game"}');
    writeFileSync(join(deployDir, 'sw.js'), 'self.addEventListener');
    mkdirSync(join(deployDir, 'icons'));
    writeFileSync(join(deployDir, 'icons', 'icon.svg'), '<svg></svg>');

    migrateRootGame(deployDir);

    // Files moved to legacy dir
    expect(existsSync(join(deployDir, 'game-legacy', 'index.html'))).toBe(true);
    expect(existsSync(join(deployDir, 'game-legacy', 'manifest.json'))).toBe(true);
    expect(existsSync(join(deployDir, 'game-legacy', 'sw.js'))).toBe(true);
    expect(existsSync(join(deployDir, 'game-legacy', 'icons', 'icon.svg'))).toBe(true);

    // Root files removed
    expect(existsSync(join(deployDir, 'index.html'))).toBe(false);
    expect(existsSync(join(deployDir, 'manifest.json'))).toBe(false);
    expect(existsSync(join(deployDir, 'icons'))).toBe(false);
  });

  it('skips if already migrated', () => {
    writeFileSync(join(deployDir, 'manifest.json'), '{}');
    mkdirSync(join(deployDir, 'game-legacy'));
    writeFileSync(join(deployDir, 'game-legacy', 'index.html'), 'legacy');

    // Should not throw and should not modify existing legacy dir
    migrateRootGame(deployDir);
    expect(readFileSync(join(deployDir, 'game-legacy', 'index.html'), 'utf-8')).toBe('legacy');
  });
});

describe('Unit: detectGameType', () => {
  it('detects snake game', () => {
    expect(detectGameType('做个贪吃蛇游戏')).toEqual({ icon: '🐍', color: '#4ade80', tag: '经典' });
    expect(detectGameType('Snake Game')).toEqual({ icon: '🐍', color: '#4ade80', tag: '经典' });
  });

  it('detects tetris game', () => {
    expect(detectGameType('做个俄罗斯方块游戏')).toEqual({ icon: '🧱', color: '#60a5fa', tag: '益智' });
    expect(detectGameType('Tetris')).toEqual({ icon: '🧱', color: '#60a5fa', tag: '益智' });
  });

  it('detects shooter game', () => {
    expect(detectGameType('做个飞行射击游戏')).toEqual({ icon: '✈️', color: '#f87171', tag: '射击' });
    expect(detectGameType('Space Shooter')).toEqual({ icon: '✈️', color: '#f87171', tag: '射击' });
  });

  it('detects tool', () => {
    expect(detectGameType('做个计算器工具')).toEqual({ icon: '🛠️', color: '#94a3b8', tag: '工具' });
    expect(detectGameType('Todo List')).toEqual({ icon: '🛠️', color: '#94a3b8', tag: '工具' });
  });

  it('defaults to generic game', () => {
    expect(detectGameType('Unknown')).toEqual({ icon: '🎮', color: '#667eea', tag: '游戏' });
  });
});

describe('Unit: generateRootIndex', () => {
  let deployDir: string;

  beforeEach(() => {
    deployDir = mkdtempSync(join(tmpdir(), 'kele-index-'));
  });

  afterEach(() => {
    rmSync(deployDir, { recursive: true, force: true });
  });

  it('creates games.json and index.html with game list', () => {
    // Simulate two game subdirectories
    mkdirSync(join(deployDir, 'proj-abc123'));
    writeFileSync(
      join(deployDir, 'proj-abc123', 'manifest.json'),
      JSON.stringify({ name: '做个贪吃蛇游戏' }),
    );

    mkdirSync(join(deployDir, 'proj-xyz789'));
    writeFileSync(
      join(deployDir, 'proj-xyz789', 'manifest.json'),
      JSON.stringify({ name: '做个俄罗斯方块游戏' }),
    );

    generateRootIndex(deployDir);

    // Verify games.json
    const gamesPath = join(deployDir, 'games.json');
    expect(existsSync(gamesPath)).toBe(true);
    const games = JSON.parse(readFileSync(gamesPath, 'utf-8')) as Array<{
      id: string;
      name: string;
      url: string;
      icon: string;
      color: string;
      tag: string;
    }>;
    expect(games).toHaveLength(2);
    expect(games.map((g) => g.name).sort()).toEqual(['做个俄罗斯方块游戏', '做个贪吃蛇游戏']);

    // Verify type detection was applied
    const snake = games.find((g) => g.name.includes('蛇'));
    expect(snake?.icon).toBe('🐍');
    expect(snake?.tag).toBe('经典');

    const tetris = games.find((g) => g.name.includes('方块'));
    expect(tetris?.icon).toBe('🧱');
    expect(tetris?.tag).toBe('益智');

    // Verify index.html
    const htmlPath = join(deployDir, 'index.html');
    expect(existsSync(htmlPath)).toBe(true);
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('kele 游戏合集');
    expect(html).toContain('打开游戏');
    expect(html).toContain('stats-bar');
    expect(html).toContain('var games =');
    expect(html).toContain('try {');
    expect(html).not.toContain('const games =');
  });

  it('uses directory name when manifest is missing', () => {
    mkdirSync(join(deployDir, 'proj-no-manifest'));

    generateRootIndex(deployDir);

    const games = JSON.parse(readFileSync(join(deployDir, 'games.json'), 'utf-8'));
    expect(games[0].name).toBe('proj-no-manifest');
  });

  it('ignores .git directory', () => {
    mkdirSync(join(deployDir, '.git'));
    mkdirSync(join(deployDir, 'proj-real'));

    generateRootIndex(deployDir);

    const games = JSON.parse(readFileSync(join(deployDir, 'games.json'), 'utf-8'));
    expect(games).toHaveLength(1);
    expect(games[0].id).toBe('proj-real');
  });

  it('falls back to index.html title when manifest name is a prompt', () => {
    mkdirSync(join(deployDir, 'proj-legacy'));
    writeFileSync(
      join(deployDir, 'proj-legacy', 'manifest.json'),
      JSON.stringify({ name: '做个飞行射击游戏' }),
    );
    writeFileSync(
      join(deployDir, 'proj-legacy', 'index.html'),
      '<html><head><title>星际战机</title></head><body></body></html>',
    );

    generateRootIndex(deployDir);

    const games = JSON.parse(readFileSync(join(deployDir, 'games.json'), 'utf-8'));
    expect(games).toHaveLength(1);
    expect(games[0].name).toBe('星际战机');

    // manifest should be updated
    const updatedManifest = JSON.parse(readFileSync(join(deployDir, 'proj-legacy', 'manifest.json'), 'utf-8'));
    expect(updatedManifest.name).toBe('星际战机');
    expect(updatedManifest.short_name).toBe('星际战机'.slice(0, 12));
  });
});

describe('Unit: buildNavPage', () => {
  it('renders empty state', () => {
    const html = buildNavPage([]);
    expect(html).toContain('还没有部署任何游戏');
    expect(html).toContain('kele 游戏合集');
    expect(html).toContain('stats-bar');
  });

  it('renders game cards with actions', () => {
    const html = buildNavPage([
      { id: 'proj-a', name: 'Snake', url: './proj-a/', icon: '🐍', color: '#4ade80', tag: '经典' },
      { id: 'proj-b', name: 'Tetris', url: './proj-b/', icon: '🧱', color: '#60a5fa', tag: '益智' },
    ]);
    expect(html).toContain('Snake');
    expect(html).toContain('Tetris');
    expect(html).toContain('🐍');
    expect(html).toContain('🧱');
    expect(html).toContain('经典');
    expect(html).toContain('益智');
    expect(html).toContain('打开游戏');
    expect(html).toContain('var games =');
    expect(html).toContain('for (var j = 0;');
    expect(html).toContain('try {');
    expect(html).not.toContain('const games =');
    expect(html).not.toContain('=>');
  });

  it('escapes HTML in game names', () => {
    const html = buildNavPage([{ id: 'x', name: '<script>alert(1)</script>', url: './x/', icon: '🎮', color: '#667eea', tag: '游戏' }]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('\\u003c');
  });
});
