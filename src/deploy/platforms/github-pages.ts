/**
 * GitHub Pages deployment.
 *
 * Uses gh-pages npm package if available, otherwise falls back to raw git commands.
 */

import { execSync } from 'child_process';

import type { DeployResult } from '../types.js';

export async function deployGitHubPages(
  projectRoot: string,
  options: { token?: string; repo?: string; branch?: string } = {},
): Promise<DeployResult> {
  const repo = options.repo;
  const branch = options.branch ?? 'gh-pages';

  if (!repo) {
    // Try to infer from local git remote
    const inferred = inferRepoFromGit(projectRoot);
    if (!inferred) {
      return {
        success: false,
        message: '未配置 GitHub repo。请运行: kele config --github-repo <owner/repo>',
      };
    }
  }

  const targetRepo = repo ?? inferRepoFromGit(projectRoot)!;

  try {
    // Check if gh-pages package is available
    const ghPages = tryLoadGhPages() as { publish: (...args: unknown[]) => void } | undefined;
    if (ghPages) {
      await new Promise<void>((resolve, reject) => {
        ghPages.publish(
          projectRoot,
          {
            branch,
            repo: targetRepo.includes('https://')
              ? targetRepo
              : `https://github.com/${targetRepo}.git`,
            dotfiles: true,
          },
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          },
        );
      });
    } else {
      // Fallback: use git commands
      const remoteUrl = targetRepo.includes('https://')
        ? targetRepo
        : `https://github.com/${targetRepo}.git`;

      execSync('git init', { cwd: projectRoot, stdio: 'ignore' });
      execSync('git add -A', { cwd: projectRoot, stdio: 'ignore' });
      execSync('git commit -m "Deploy to GitHub Pages"', {
        cwd: projectRoot,
        stdio: 'ignore',
      });
      execSync(`git push --force "${remoteUrl}" main:${branch}`, {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    }

    const pagesUrl = targetRepo.includes('https://')
      ? targetRepo.replace(/\.git$/, '').replace('github.com', 'username.github.io')
      : `https://${targetRepo.split('/')[0]}.github.io/${targetRepo.split('/')[1]}`;

    return {
      success: true,
      url: pagesUrl,
      message: `GitHub Pages 部署成功: ${pagesUrl}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `GitHub Pages 部署失败: ${msg}`,
    };
  }
}

function inferRepoFromGit(projectRoot: string): string | undefined {
  try {
    const remote = execSync('git remote get-url origin', {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    // Extract owner/repo from various URL formats
    const match = remote.match(/github\.com[:\/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) return `${match[1]}/${match[2]}`;
  } catch {
    // not a git repo or no remote
  }
  return undefined;
}

function tryLoadGhPages(): unknown {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('gh-pages');
  } catch {
    return undefined;
  }
}
