/**
 * Netlify deployment — calls netlify CLI if installed.
 */

import { execSync } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { DeployResult } from '../types.js';

export async function deployNetlify(
  projectRoot: string,
  options: { token?: string; siteId?: string } = {},
): Promise<DeployResult> {
  if (!isNetlifyInstalled()) {
    return {
      success: false,
      message: '未安装 netlify CLI。请运行: npm i -g netlify-cli',
    };
  }

  // Write _redirects for SPA fallback
  await writeFile(
    join(projectRoot, '_redirects'),
    '/* /index.html 200\n',
    'utf-8',
  );

  try {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (options.token) {
      env.NETLIFY_AUTH_TOKEN = options.token;
    }

    const siteArg = options.siteId ? ` --site=${options.siteId}` : '';
    const output = execSync(`netlify deploy --prod --dir=.${siteArg}`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      env,
      stdio: 'pipe',
    });

    // Extract URL from output
    const urlMatch = output.match(/https:\/\/[^\s]+\.netlify\.app/);
    const url = urlMatch ? urlMatch[0] : undefined;

    return {
      success: true,
      url,
      message: url ? `Netlify 部署成功: ${url}` : 'Netlify 部署成功',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Netlify 部署失败: ${msg}`,
    };
  }
}

export function isNetlifyInstalled(): boolean {
  try {
    execSync('netlify --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
