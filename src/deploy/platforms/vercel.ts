/**
 * Vercel deployment — calls vercel CLI if installed.
 */

import { execSync } from 'child_process';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { DeployResult } from '../types.js';

export async function deployVercel(
  projectRoot: string,
  options: { token?: string } = {},
): Promise<DeployResult> {
  if (!isVercelInstalled()) {
    return {
      success: false,
      message: '未安装 vercel CLI。请运行: npm i -g vercel',
    };
  }

  // Write vercel.json for static deployment
  const vercelConfig = {
    version: 2,
    public: true,
    github: { enabled: false },
  };
  await writeFile(
    join(projectRoot, 'vercel.json'),
    JSON.stringify(vercelConfig, null, 2),
    'utf-8',
  );

  try {
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (options.token) {
      env.VERCEL_TOKEN = options.token;
    }

    const output = execSync('vercel deploy --yes --prod', {
      cwd: projectRoot,
      encoding: 'utf-8',
      env,
      stdio: 'pipe',
    });

    // Extract URL from output
    const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
    const url = urlMatch ? urlMatch[0] : undefined;

    return {
      success: true,
      url,
      message: url ? `Vercel 部署成功: ${url}` : 'Vercel 部署成功',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Vercel 部署失败: ${msg}`,
    };
  }
}

export function isVercelInstalled(): boolean {
  try {
    execSync('vercel --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
