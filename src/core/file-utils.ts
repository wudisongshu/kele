/**
 * Shared file system utilities.
 *
 * Extracted from task-validator.ts, game-validator.ts, acceptance-runner.ts
 * to eliminate code duplication.
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { debugLog } from '../debug.js';

/**
 * Recursively find files with a given extension under a directory.
 * Skips node_modules, dist, .git directories.
 */
export function findFilesByExt(dir: string, ext: string, skipDirs: string[] = ['node_modules', 'dist', '.git']): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !skipDirs.includes(entry.name)) {
          results.push(...findFilesByExt(fullPath, ext, skipDirs));
        }
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`File utils readdir failed: ${dir}`, msg);
  }
  return results;
}

/**
 * Find all HTML files under a directory.
 */
export function findHtmlFiles(dir: string): string[] {
  return findFilesByExt(dir, '.html');
}

/**
 * Find all JS files under a directory.
 */
export function findJsFiles(dir: string): string[] {
  return findFilesByExt(dir, '.js');
}

/**
 * Find all TypeScript files under a directory.
 */
export function findTsFiles(dir: string): string[] {
  return findFilesByExt(dir, '.ts');
}

/**
 * Find source code files (JS/TS/JSX/TSX) under a directory.
 */
export function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
        results.push(...findSourceFiles(fullPath));
      } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`File utils readdir failed: ${dir}`, msg);
  }
  return results;
}

/**
 * Find all JSON files under a directory.
 */
export function findJsonFiles(dir: string): string[] {
  return findFilesByExt(dir, '.json');
}

/**
 * Find all CSS files under a directory.
 */
export function findCssFiles(dir: string): string[] {
  return findFilesByExt(dir, '.css');
}

/**
 * Check if a path is a file (not a directory).
 */
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`File utils stat failed: ${path}`, msg);
    return false;
  }
}
