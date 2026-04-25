/**
 * GitHub Pages deployment — pure git + execa, no gh-pages npm package.
 *
 * Key design:
 * - Subdirectory deploy: each game gets its own folder (game-xxxx/)
 * - Fetch-existing-first: preserves already-deployed games on gh-pages
 * - Temp dir: created, used, then deleted (contains token in remote URL)
 * - No --force on push (except init edge case handled by fetch/reset)
 */

import { execa } from 'execa';
import { mkdtempSync, rmSync, copyFileSync, mkdirSync, readdirSync } from 'fs';
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
  const gameSubdir = projectId; // e.g. proj-abc123

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

    // 5. Commit and push
    await execa('git', ['add', '.'], { cwd: deployDir });
    const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd: deployDir });
    if (status.trim()) {
      await execa('git', ['commit', '-m', `deploy: ${projectId}`], { cwd: deployDir });
      await execa('git', ['push', 'origin', branch], { cwd: deployDir });
    }

    // 6. Build URL (trailing slash ensures subdirectory resource paths work)
    const url = `https://${owner}.github.io/${repoName}/${gameSubdir}/`;
    return {
      success: true,
      url,
      message: `GitHub Pages 部署成功: ${url}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Sanitize token from error message
    const safeMsg = msg.replace(options.token, '***');
    return {
      success: false,
      message: `GitHub Pages 部署失败: ${safeMsg}`,
    };
  } finally {
    // 7. Always clean up temp dir (contains token in .git/config)
    rmSync(deployDir, { recursive: true, force: true });
  }
}

/** Recursively copy directory contents (sync for simplicity). */
function copyDirContents(src: string, dest: string): void {
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
