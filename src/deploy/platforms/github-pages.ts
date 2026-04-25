/**
 * GitHub Pages deployment — pure git + execa, no gh-pages npm package.
 *
 * Key design:
 * - Subdirectory deploy: each game gets its own folder (proj-xxxx/)
 * - Fetch-existing-first: preserves already-deployed games on gh-pages
 * - Auto-migrates root-level legacy games into game-legacy/
 * - Generates root index.html navigation page + games.json
 * - Temp dir: created, used, then deleted (contains token in remote URL)
 */

import { execa } from 'execa';
import {
  mkdtempSync,
  rmSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DeployResult } from '../types.js';

export async function deployGitHubPages(
  projectRoot: string,
  projectId: string,
  options: { token?: string; repo?: string; branch?: string } = {},
): Promise<DeployResult> {
  // 1. Pre-flight checks
  if (!options.token) {
    return {
      success: false,
      message: 'GitHub token 未配置。运行：kele config --github-token <token>',
    };
  }

  let gitOk = false;
  try {
    await execa('git', ['--version']);
    gitOk = true;
  } catch {
    gitOk = false;
  }
  if (!gitOk) {
    return {
      success: false,
      message: 'git 未安装，请先安装 git',
    };
  }

  const repo = options.repo ?? 'wudisongshu/kele-games';
  const branch = options.branch ?? 'gh-pages';
  const [owner, repoName] = repo.split('/');
  const remoteUrl = `https://${options.token}@github.com/${repo}.git`;
  const gameSubdir = projectId;

  const deployDir = mkdtempSync(join(tmpdir(), `kele-deploy-${Date.now()}-`));

  try {
    // 2. Init temp git repo
    await execa('git', ['init'], { cwd: deployDir });
    await execa('git', ['config', 'user.name', 'kele'], { cwd: deployDir });
    await execa('git', ['config', 'user.email', 'kele@localhost'], { cwd: deployDir });

    // 3. Fetch existing gh-pages (preserve other games)
    await execa('git', ['remote', 'add', 'origin', remoteUrl], { cwd: deployDir });
    try {
      await execa('git', ['fetch', '--depth=1', 'origin', branch], { cwd: deployDir });
      await execa('git', ['reset', '--hard', `origin/${branch}`], { cwd: deployDir });
    } catch {
      // Branch doesn't exist yet — create empty orphan branch
      await execa('git', ['checkout', '--orphan', branch], { cwd: deployDir });
      await execa('git', ['rm', '-rf', '.'], { cwd: deployDir }).catch(() => {});
    }

    // 4. Copy current game into subdir (overwrite if same game, keep others)
    const targetDir = join(deployDir, gameSubdir);
    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    copyDirContents(projectRoot, targetDir);

    // 5. Migrate root-level legacy game (if any) into game-legacy/
    try {
      migrateRootGame(deployDir);
    } catch {
      // Non-fatal: continue without migration
    }

    // 6. Generate root navigation page + games.json
    try {
      generateRootIndex(deployDir);
    } catch {
      // Non-fatal: at least the subdir game is still accessible
    }

    // 7. Commit and push
    await execa('git', ['add', '.'], { cwd: deployDir });
    const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd: deployDir });
    if (status.trim()) {
      await execa('git', ['commit', '-m', `deploy: ${projectId}`], { cwd: deployDir });
      await execa('git', ['push', 'origin', `HEAD:${branch}`], { cwd: deployDir });
    }

    // 8. Build URL
    const url = `https://${owner}.github.io/${repoName}/${gameSubdir}/`;
    return {
      success: true,
      url,
      message: `GitHub Pages 部署成功: ${url}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const safeMsg = msg.replace(options.token, '***');
    return {
      success: false,
      message: `GitHub Pages 部署失败: ${safeMsg}`,
    };
  } finally {
    // Always clean up temp dir (contains token in .git/config)
    rmSync(deployDir, { recursive: true, force: true });
  }
}

/**
 * If a legacy game lives at the root of deployDir (manifest.json + index.html),
 * move it into game-legacy/ so the root can be used for the navigation page.
 */
export function migrateRootGame(deployDir: string): void {
  const rootManifest = join(deployDir, 'manifest.json');
  if (!existsSync(rootManifest)) return;

  const legacyDir = join(deployDir, 'game-legacy');
  if (existsSync(join(legacyDir, 'index.html'))) return; // Already migrated

  mkdirSync(legacyDir, { recursive: true });

  const filesToMove = ['index.html', 'manifest.json', 'sw.js'];
  for (const file of filesToMove) {
    const src = join(deployDir, file);
    if (existsSync(src)) {
      copyFileSync(src, join(legacyDir, file));
      rmSync(src, { force: true });
    }
  }

  const iconsSrc = join(deployDir, 'icons');
  const iconsDst = join(legacyDir, 'icons');
  if (existsSync(iconsSrc)) {
    copyDirContents(iconsSrc, iconsDst);
    rmSync(iconsSrc, { recursive: true, force: true });
  }
}

/**
 * Scan all subdirectories in deployDir and generate:
 * - games.json: array of { id, name, url }
 * - index.html: root navigation page
 */
export function generateRootIndex(deployDir: string): void {
  const games: Array<{ id: string; name: string; url: string }> = [];

  for (const entry of readdirSync(deployDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.git') continue;

    let name = entry.name;
    const manifestPath = join(deployDir, entry.name, 'manifest.json');
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
        if (manifest.name && typeof manifest.name === 'string') {
          name = manifest.name;
        }
      } catch {
        // ignore malformed manifest
      }
    }

    games.push({ id: entry.name, name, url: `./${entry.name}/` });
  }

  // Write games.json
  writeFileSync(join(deployDir, 'games.json'), JSON.stringify(games, null, 2), 'utf-8');

  // Write root navigation page
  const html = buildNavPage(games);
  writeFileSync(join(deployDir, 'index.html'), html, 'utf-8');
}

export function buildNavPage(
  games: Array<{ id: string; name: string; url: string }>,
): string {
  const gamesJson = JSON.stringify(games).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🥤 kele 游戏合集</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: white; text-align: center; margin-bottom: 10px; font-size: 2.5em; }
    .subtitle { color: rgba(255,255,255,0.8); text-align: center; margin-bottom: 40px; }
    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
    }
    .game-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      text-decoration: none;
      color: #333;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .game-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.15);
    }
    .game-icon { font-size: 3em; margin-bottom: 12px; }
    .game-name { font-size: 1.2em; font-weight: 600; margin-bottom: 8px; }
    .game-id { color: #888; font-size: 0.85em; }
    .empty { text-align: center; color: rgba(255,255,255,0.7); padding: 60px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🥤 kele 游戏合集</h1>
    <p class="subtitle">一句话生成的游戏，直接部署上线</p>
    <div class="games-grid" id="games"></div>
  </div>
  <script>
    const games = ${gamesJson};
    (function() {
      const container = document.getElementById('games');
      if (!games.length) {
        container.innerHTML = '<div class="empty">还没有部署任何游戏</div>';
        return;
      }
      container.innerHTML = games.map(function(g) {
        return '<a href="' + g.url + '" class="game-card">' +
          '<div class="game-icon">🎮</div>' +
          '<div class="game-name">' + g.name + '</div>' +
          '<div class="game-id">' + g.id + '</div>' +
        '</a>';
      }).join('');
    })();
  </script>
</body>
</html>
`;
}

/** Recursively copy directory contents (sync for simplicity). */
function copyDirContents(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDirContents(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
