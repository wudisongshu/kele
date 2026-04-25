/**
 * Static deployment — copy project files to a local directory.
 * Zero dependencies, always available.
 */

import { copyFile, mkdir, readdir } from 'fs/promises';
import { join, relative } from 'path';
import type { DeployResult } from '../types.js';

export async function deployStatic(
  projectRoot: string,
  outDir: string,
): Promise<DeployResult> {
  await mkdir(outDir, { recursive: true });

  const files = await listFilesRecursively(projectRoot);
  for (const file of files) {
    const rel = relative(projectRoot, file);
    const dest = join(outDir, rel);
    await mkdir(join(dest, '..'), { recursive: true });
    await copyFile(file, dest);
  }

  return {
    success: true,
    message: `静态导出完成: ${outDir}`,
  };
}

async function listFilesRecursively(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await listFilesRecursively(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }

  return files;
}
