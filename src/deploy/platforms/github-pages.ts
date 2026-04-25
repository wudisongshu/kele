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
  statSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DeployResult } from '../types.js';

interface GitHubOptions {
  token?: string;
  repo?: string;
  branch?: string;
}

const DEFAULT_REPO = 'wudisongshu/kele-games';
const DEFAULT_BRANCH = 'gh-pages';

function normalizeOptions(options: GitHubOptions): Required<GitHubOptions> {
  return {
    token: options.token ?? '',
    repo: options.repo ?? DEFAULT_REPO,
    branch: options.branch ?? DEFAULT_BRANCH,
  };
}

function checkGit(): Promise<boolean> {
  return execa('git', ['--version']).then(() => true).catch(() => false);
}

/**
 * Open a fresh temp clone of the gh-pages branch.
 * Returns { deployDir, branch } and caller must rmSync(deployDir) when done.
 */
async function openGhPagesBranch(options: GitHubOptions): Promise<
  | { ok: true; deployDir: string; config: Required<GitHubOptions> }
  | { ok: false; error: string }
> {
  if (!options.token) {
    return { ok: false, error: 'GitHub token 未配置。运行：kele config --github-token <token>' };
  }

  const gitOk = await checkGit();
  if (!gitOk) {
    return { ok: false, error: 'git 未安装，请先安装 git' };
  }

  const cfg = normalizeOptions(options);
  const remoteUrl = `https://${cfg.token}@github.com/${cfg.repo}.git`;
  const deployDir = mkdtempSync(join(tmpdir(), `kele-ghp-${Date.now()}-`));

  try {
    await execa('git', ['init'], { cwd: deployDir });
    await execa('git', ['config', 'user.name', 'kele'], { cwd: deployDir });
    await execa('git', ['config', 'user.email', 'kele@localhost'], { cwd: deployDir });
    await execa('git', ['remote', 'add', 'origin', remoteUrl], { cwd: deployDir });

    try {
      await execa('git', ['fetch', '--depth=1', 'origin', cfg.branch], { cwd: deployDir });
      await execa('git', ['reset', '--hard', `origin/${cfg.branch}`], { cwd: deployDir });
    } catch {
      await execa('git', ['checkout', '--orphan', cfg.branch], { cwd: deployDir });
      await execa('git', ['rm', '-rf', '.'], { cwd: deployDir }).catch(() => {});
    }

    return { ok: true, deployDir, config: cfg };
  } catch (err) {
    rmSync(deployDir, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `GitHub Pages 操作失败: ${msg.replace(cfg.token, '***')}` };
  }
}

/**
 * Commit changes in deployDir and push to gh-pages.
 */
async function commitAndPush(deployDir: string, message: string, branch: string): Promise<void> {
  await execa('git', ['add', '.'], { cwd: deployDir });
  const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd: deployDir });
  if (status.trim()) {
    await execa('git', ['commit', '-m', message], { cwd: deployDir });
    await execa('git', ['push', 'origin', `HEAD:${branch}`, '--force'], { cwd: deployDir });
  }
}

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------

export async function deployGitHubPages(
  projectRoot: string,
  projectId: string,
  options: GitHubOptions = {},
): Promise<DeployResult> {
  const open = await openGhPagesBranch(options);
  if (!open.ok) return { success: false, message: open.error };

  const { deployDir, config } = open;
  const [owner, repoName] = config.repo.split('/');

  try {
    const targetDir = join(deployDir, projectId);
    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });
    copyDirContents(projectRoot, targetDir);

    try { migrateRootGame(deployDir); } catch { /* non-fatal */ }
    try { generateRootIndex(deployDir); } catch { /* non-fatal */ }

    await commitAndPush(deployDir, `deploy: ${projectId}`, config.branch);

    const url = `https://${owner}.github.io/${repoName}/${projectId}/`;
    return { success: true, url, message: `GitHub Pages 部署成功: ${url}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `GitHub Pages 部署失败: ${msg.replace(config.token, '***')}` };
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Undeploy
// ---------------------------------------------------------------------------

export async function undeployGitHubPages(
  projectId: string,
  options: GitHubOptions = {},
): Promise<{ removed: boolean; message: string }> {
  const open = await openGhPagesBranch(options);
  if (!open.ok) return { removed: false, message: open.error };

  const { deployDir, config } = open;

  try {
    const targetDir = join(deployDir, projectId);
    if (!existsSync(targetDir)) {
      return { removed: false, message: `项目 ${projectId} 在 GitHub Pages 上不存在` };
    }

    rmSync(targetDir, { recursive: true, force: true });
    try { generateRootIndex(deployDir); } catch { /* non-fatal */ }
    await commitAndPush(deployDir, `undeploy: ${projectId}`, config.branch);

    return { removed: true, message: `已下线: ${projectId}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { removed: false, message: `下线失败: ${msg.replace(config.token, '***')}` };
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Prune — keep only N most recent deployments
// ---------------------------------------------------------------------------

export async function pruneGitHubPages(
  keepCount: number,
  options: GitHubOptions = {},
): Promise<{ removed: string[]; message: string }> {
  const open = await openGhPagesBranch(options);
  if (!open.ok) return { removed: [], message: open.error };

  const { deployDir, config } = open;

  try {
    const dirs: Array<{ name: string; mtime: number }> = [];
    for (const entry of readdirSync(deployDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.git') continue;

      const dirPath = join(deployDir, entry.name);
      try {
        const s = statSync(dirPath);
        dirs.push({ name: entry.name, mtime: s.mtimeMs });
      } catch {
        // ignore unreadable dirs
      }
    }

    dirs.sort((a, b) => b.mtime - a.mtime); // newest first

    const toRemove = dirs.slice(keepCount);
    const removed: string[] = [];
    for (const dir of toRemove) {
      const dirPath = join(deployDir, dir.name);
      try {
        rmSync(dirPath, { recursive: true, force: true });
        removed.push(dir.name);
      } catch {
        // skip failures
      }
    }

    try { generateRootIndex(deployDir); } catch { /* non-fatal */ }
    await commitAndPush(deployDir, `prune: keep ${keepCount}`, config.branch);

    return {
      removed,
      message: removed.length
        ? `已清理 ${removed.length} 个旧部署，保留最近 ${Math.min(keepCount, dirs.length)} 个`
        : `没有需要清理的旧部署（共 ${dirs.length} 个）`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { removed: [], message: `清理失败: ${msg.replace(config.token, '***')}` };
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Clean all — remove every game directory
// ---------------------------------------------------------------------------

export async function cleanAllGitHubPages(
  options: GitHubOptions = {},
): Promise<{ message: string }> {
  const open = await openGhPagesBranch(options);
  if (!open.ok) return { message: open.error };

  const { deployDir, config } = open;

  try {
    for (const entry of readdirSync(deployDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.git') continue;

      const dirPath = join(deployDir, entry.name);
      try {
        rmSync(dirPath, { recursive: true, force: true });
      } catch {
        // skip failures
      }
    }

    generateRootIndex(deployDir); // will produce empty-state page
    await commitAndPush(deployDir, 'clean: remove all deployments', config.branch);

    return { message: '已清空所有 GitHub Pages 部署' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { message: `清空失败: ${msg.replace(config.token, '***')}` };
  } finally {
    rmSync(deployDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
/**
 * Detect game type from name for icon/color/tag assignment.
 */
export function detectGameType(name: string): { icon: string; color: string; tag: string } {
  const n = name.toLowerCase();
  if (n.includes('蛇') || n.includes('snake')) return { icon: '🐍', color: '#4ade80', tag: '经典' };
  if (n.includes('方块') || n.includes('tetris') || n.includes('2048')) return { icon: '🧱', color: '#60a5fa', tag: '益智' };
  if (n.includes('鸟') || n.includes('flappy')) return { icon: '🐦', color: '#fbbf24', tag: '街机' };
  if (n.includes('射击') || n.includes('飞机') || n.includes('space') || n.includes('飞行')) return { icon: '✈️', color: '#f87171', tag: '射击' };
  if (n.includes('球') || n.includes('ball') || n.includes('砖块') || n.includes('breakout') || n.includes('pong')) return { icon: '⚽', color: '#a78bfa', tag: '动作' };
  if (n.includes('塔防') || n.includes('defense')) return { icon: '🏰', color: '#34d399', tag: '策略' };
  if (n.includes('赛车') || n.includes('racing') || n.includes('car')) return { icon: '🏎️', color: '#fb923c', tag: '竞速' };
  if (n.includes('猜') || n.includes('quiz') || n.includes('puzzle')) return { icon: '🧩', color: '#e879f9', tag: '解谜' };
  if (n.includes('工具') || n.includes('计算器') || n.includes('时钟') || n.includes('todo') || n.includes('清单')) return { icon: '🛠️', color: '#94a3b8', tag: '工具' };
  return { icon: '🎮', color: '#667eea', tag: '游戏' };
}

export function generateRootIndex(deployDir: string): void {
  const games: Array<{ id: string; name: string; url: string; icon: string; color: string; tag: string }> = [];

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

    const typeInfo = detectGameType(name);
    games.push({ id: entry.name, name, url: `./${entry.name}/`, ...typeInfo });
  }

  writeFileSync(join(deployDir, 'games.json'), JSON.stringify(games, null, 2), 'utf-8');
  const html = buildNavPage(games);
  writeFileSync(join(deployDir, 'index.html'), html, 'utf-8');
}

export function buildNavPage(
  games: Array<{ id: string; name: string; url: string; icon: string; color: string; tag: string }>,
): string {
  var gamesJsonStr = JSON.stringify(games).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return '<!DOCTYPE html>\n' +
'<html lang="zh-CN">\n' +
'<head>\n' +
'  <meta charset="UTF-8">\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'  <title>kele 游戏合集</title>\n' +
'  <style>\n' +
'    * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
'    body {\n' +
'      font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n' +
'      background: #f0f2f5;\n' +
'      min-height: 100vh;\n' +
'      padding: 40px 20px;\n' +
'    }\n' +
'    .container { max-width: 960px; margin: 0 auto; }\n' +
'    .header { text-align: center; margin-bottom: 32px; }\n' +
'    .header h1 { font-size: 2em; color: #1f2937; margin-bottom: 8px; }\n' +
'    .header .subtitle { color: #6b7280; font-size: 1.05em; }\n' +
'    .stats-bar {\n' +
'      display: flex; justify-content: center; gap: 40px;\n' +
'      margin-bottom: 32px; padding: 20px;\n' +
'      background: white; border-radius: 16px;\n' +
'      box-shadow: 0 1px 3px rgba(0,0,0,0.08);\n' +
'    }\n' +
'    .stat { text-align: center; }\n' +
'    .stat-number { font-size: 1.8em; font-weight: 700; color: #667eea; }\n' +
'    .stat-label { font-size: 0.85em; color: #9ca3af; margin-top: 4px; }\n' +
'    .games-grid {\n' +
'      display: grid;\n' +
'      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));\n' +
'      gap: 20px;\n' +
'    }\n' +
'    .game-card {\n' +
'      background: white;\n' +
'      border-radius: 16px;\n' +
'      padding: 24px;\n' +
'      transition: all 0.2s ease;\n' +
'      box-shadow: 0 1px 3px rgba(0,0,0,0.08);\n' +
'      border: 1px solid rgba(0,0,0,0.04);\n' +
'      position: relative;\n' +
'      overflow: hidden;\n' +
'    }\n' +
'    .game-card:hover {\n' +
'      transform: translateY(-3px);\n' +
'      box-shadow: 0 8px 24px rgba(0,0,0,0.12);\n' +
'    }\n' +
'    .game-card .accent-bar {\n' +
'      position: absolute; top: 0; left: 0; right: 0; height: 4px;\n' +
'      background: #667eea;\n' +
'    }\n' +
'    .card-top {\n' +
'      display: flex; justify-content: space-between; align-items: flex-start;\n' +
'      margin-bottom: 16px;\n' +
'    }\n' +
'    .game-icon { font-size: 2.8em; line-height: 1; }\n' +
'    .game-tag {\n' +
'      font-size: 0.75em; padding: 4px 10px;\n' +
'      border-radius: 20px; font-weight: 500;\n' +
'      background: #667eea; color: white;\n' +
'    }\n' +
'    .game-name {\n' +
'      font-size: 1.15em; font-weight: 600;\n' +
'      margin-bottom: 16px; line-height: 1.4;\n' +
'      overflow: hidden;\n' +
'    }\n' +
'    .card-actions { display: flex; gap: 8px; }\n' +
'    .btn {\n' +
'      flex: 1; padding: 8px 12px;\n' +
'      border-radius: 8px; border: none;\n' +
'      font-size: 0.85em; font-weight: 500;\n' +
'      cursor: pointer; text-align: center;\n' +
'      text-decoration: none; display: inline-block;\n' +
'    }\n' +
'    .btn-primary { background: #667eea; color: white; }\n' +
'    .btn-primary:hover { background: #5a67d8; }\n' +
'    footer {\n' +
'      text-align: center; margin-top: 48px;\n' +
'      color: #9ca3af; font-size: 0.9em;\n' +
'    }\n' +
'    footer a { color: #667eea; text-decoration: none; }\n' +
'    .empty { text-align: center; padding: 60px 20px; color: #9ca3af; }\n' +
'    .empty-icon { font-size: 4em; margin-bottom: 16px; }\n' +
'    .error-box {\n' +
'      background: #fef2f2; border: 1px solid #fecaca;\n' +
'      color: #dc2626; padding: 16px 20px;\n' +
'      border-radius: 12px; margin: 20px 0;\n' +
'      font-family: monospace; font-size: 0.9em;\n' +
'    }\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <div class="container">\n' +
'    <div class="header">\n' +
'      <h1>kele 游戏合集</h1>\n' +
'      <p class="subtitle">一句话生成的游戏，直接部署上线</p>\n' +
'    </div>\n' +
'    <div id="error-container"></div>\n' +
'    <div class="stats-bar" id="stats"></div>\n' +
'    <div class="games-grid" id="games"></div>\n' +
'    <footer>\n' +
'      <p>由 kele 自动生成</p>\n' +
'      <p>访问 <a href="https://github.com/wudisongshu/kele">GitHub</a> 了解更多</p>\n' +
'    </footer>\n' +
'  </div>\n' +
'  <script>\n' +
'    var games = ' + gamesJsonStr + ';\n' +
'    function showError(msg) {\n' +
'      var el = document.getElementById(\'error-container\');\n' +
'      if (el) el.innerHTML = \'<div class="error-box">JS 错误: \' + msg + \'</div>\';\n' +
'    }\n' +
'    try {\n' +
'      var typeSet = {};\n' +
'      for (var i = 0; i < games.length; i++) {\n' +
'        typeSet[games[i].tag] = true;\n' +
'      }\n' +
'      var typeCount = 0;\n' +
'      for (var k in typeSet) { if (typeSet.hasOwnProperty(k)) typeCount++; }\n' +
'      var statsHtml = \'\';\n' +
'      statsHtml += \'<div class="stat"><div class="stat-number">\' + games.length + \'</div><div class="stat-label">游戏</div></div>\';\n' +
'      statsHtml += \'<div class="stat"><div class="stat-number">\' + typeCount + \'</div><div class="stat-label">类型</div></div>\';\n' +
'      statsHtml += \'<div class="stat"><div class="stat-number">🚀</div><div class="stat-label">已上线</div></div>\';\n' +
'      document.getElementById(\'stats\').innerHTML = statsHtml;\n' +
'      var container = document.getElementById(\'games\');\n' +
'      if (!games.length) {\n' +
'        container.innerHTML = \'<div class="empty"><div class="empty-icon">🎮</div><div>还没有部署任何游戏</div></div>\';\n' +
'      } else {\n' +
'        var gridHtml = \'\';\n' +
'        for (var j = 0; j < games.length; j++) {\n' +
'          var g = games[j];\n' +
'          gridHtml += \'<div class="game-card">\';\n' +
'          gridHtml += \'<div class="accent-bar" style="background:\' + g.color + \'"></div>\';\n' +
'          gridHtml += \'<div class="card-top">\';\n' +
'          gridHtml += \'<div class="game-icon">\' + g.icon + \'</div>\';\n' +
'          gridHtml += \'<span class="game-tag" style="background:\' + g.color + \'">\' + g.tag + \'</span>\';\n' +
'          gridHtml += \'</div>\';\n' +
'          gridHtml += \'<div class="game-name">\' + g.name + \'</div>\';\n' +
'          gridHtml += \'<div class="card-actions">\';\n' +
'          gridHtml += \'<a href="\' + g.url + \'" class="btn btn-primary">打开游戏</a>\';\n' +
'          gridHtml += \'</div>\';\n' +
'          gridHtml += \'</div>\';\n' +
'        }\n' +
'        container.innerHTML = gridHtml;\n' +
'      }\n' +
'    } catch (e) {\n' +
'      showError(e.message || String(e));\n' +
'    }\n' +
'  </script>\n' +
'</body>\n' +
'</html>\n';
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
