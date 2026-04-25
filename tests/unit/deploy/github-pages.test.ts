import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  migrateRootGame,
  generateRootIndex,
  buildNavPage,
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
      JSON.stringify({ name: 'Snake Game' }),
    );

    mkdirSync(join(deployDir, 'proj-xyz789'));
    writeFileSync(
      join(deployDir, 'proj-xyz789', 'manifest.json'),
      JSON.stringify({ name: 'Tetris' }),
    );

    generateRootIndex(deployDir);

    // Verify games.json
    const gamesPath = join(deployDir, 'games.json');
    expect(existsSync(gamesPath)).toBe(true);
    const games = JSON.parse(readFileSync(gamesPath, 'utf-8')) as Array<{
      id: string;
      name: string;
      url: string;
    }>;
    expect(games).toHaveLength(2);
    expect(games.map((g) => g.name).sort()).toEqual(['Snake Game', 'Tetris']);

    // Verify index.html
    const htmlPath = join(deployDir, 'index.html');
    expect(existsSync(htmlPath)).toBe(true);
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('kele 游戏合集');
    expect(html).toContain('proj-abc123');
    expect(html).toContain('proj-xyz789');
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
});

describe('Unit: buildNavPage', () => {
  it('renders empty state', () => {
    const html = buildNavPage([]);
    expect(html).toContain('还没有部署任何游戏');
    expect(html).toContain('kele 游戏合集');
  });

  it('renders game cards', () => {
    const html = buildNavPage([
      { id: 'proj-a', name: 'Snake', url: './proj-a/' },
      { id: 'proj-b', name: 'Tetris', url: './proj-b/' },
    ]);
    expect(html).toContain('Snake');
    expect(html).toContain('Tetris');
    expect(html).toContain('./proj-a/');
    expect(html).toContain('./proj-b/');
    expect(html).toContain('kele 游戏合集');
  });

  it('escapes HTML in game names', () => {
    const html = buildNavPage([{ id: 'x', name: '<script>alert(1)</script>', url: './x/' }]);
    expect(html).not.toContain('<script>alert(1)</script>');
    // The name is JSON-stringified with unicode escapes in the inline script
    expect(html).toContain('\\u003c');
  });
});
