/**
 * Deploy entry point — routes to the appropriate platform.
 */

import { join } from 'path';
import type { DeployOptions, DeployResult, PlatformStatus, DeployPlatform } from './types.js';
import { deployStatic } from './platforms/static.js';
import {
  deployGitHubPages,
  undeployGitHubPages,
  pruneGitHubPages,
  cleanAllGitHubPages,
} from './platforms/github-pages.js';
import { deployVercel, isVercelInstalled } from './platforms/vercel.js';
import { deployNetlify, isNetlifyInstalled } from './platforms/netlify.js';
import { loadConfig } from '../config/manager.js';
import type { Project } from '../project/types.js';

/**
 * Deploy a project to the specified platform.
 */
export async function deployProject(
  project: Project,
  options: DeployOptions,
): Promise<DeployResult> {
  const projectRoot = options.projectRoot ?? project.rootDir;

  switch (options.platform) {
    case 'static':
      return deployStatic(projectRoot, options.outDir ?? join(projectRoot, 'dist'));

    case 'github-pages': {
      const config = loadConfig();
      return deployGitHubPages(projectRoot, project.id, {
        token: config.github?.token,
        repo: config.github?.repo,
        branch: config.github?.branch,
      });
    }

    case 'vercel': {
      const config = loadConfig();
      return deployVercel(projectRoot, { token: config.vercel?.token });
    }

    case 'netlify': {
      const config = loadConfig();
      return deployNetlify(projectRoot, {
        token: config.netlify?.token,
        siteId: config.netlify?.siteId,
      });
    }

    default:
      return {
        success: false,
        message: `不支持的部署平台: ${options.platform}`,
      };
  }
}

/**
 * Get status of all deployment platforms.
 */
export function getPlatformStatuses(): PlatformStatus[] {
  const config = loadConfig();

  return [
    {
      name: 'static',
      available: true,
      message: '✅ 可用',
    },
    {
      name: 'github-pages',
      available: !!config.github?.repo || !!tryInferGitRepo(),
      message: config.github?.repo
        ? `✅ 已配置 repo: ${config.github.repo}`
        : '⚠️ 需要配置 GitHub repo: kele config --github-repo <owner/repo>',
    },
    {
      name: 'vercel',
      available: isVercelInstalled(),
      message: isVercelInstalled()
        ? '✅ vercel CLI 已安装'
        : '❌ 未安装 vercel CLI',
    },
    {
      name: 'netlify',
      available: isNetlifyInstalled(),
      message: isNetlifyInstalled()
        ? '✅ netlify CLI 已安装'
        : '❌ 未安装 netlify CLI',
    },
  ];
}

function tryInferGitRepo(): string | undefined {
  try {
    const { execSync } = require('child_process');
    const remote = execSync('git remote get-url origin', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    const match = remote.match(/github\.com[:\/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) return `${match[1]}/${match[2]}`;
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Get the default platform from config, falling back to 'static'.
 */
export {
  undeployGitHubPages,
  pruneGitHubPages,
  cleanAllGitHubPages,
};

export function getDefaultPlatform(): DeployPlatform {
  const config = loadConfig();
  const platform = config.defaultPlatform;
  if (platform && ['static', 'github-pages', 'vercel', 'netlify'].includes(platform)) {
    return platform as DeployPlatform;
  }
  return 'static';
}
