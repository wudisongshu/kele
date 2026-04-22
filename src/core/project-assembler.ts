/**
 * Project Assembler — final assembly phase after all sub-projects complete.
 *
 * Merges index.patch.html snippets from monetization/ui-polish sub-projects
 * into the main index.html. Deletes patch files after assembly.
 *
 * Design principle: no DOM parsing, no style conflict resolution.
 * Simply appends patch content before </body>.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

/**
 * Assemble the final project by merging all index.patch.html files into index.html.
 */
export function assembleProject(rootDir: string): { patched: boolean; patches: string[] } {
  const indexPath = join(rootDir, 'index.html');
  if (!existsSync(indexPath)) {
    return { patched: false, patches: [] };
  }

  let indexContent = readFileSync(indexPath, 'utf-8');
  const patches: string[] = [];

  // Find all index.patch.html files in the project root (shallow search)
  if (existsSync(rootDir)) {
    const entries = readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.patch.html')) {
        const patchPath = join(rootDir, entry.name);
        const patchContent = readFileSync(patchPath, 'utf-8').trim();
        if (patchContent) {
          patches.push(entry.name);
          // Insert patch content before </body>
          indexContent = indexContent.replace(/<\/body>/i, (match) => patchContent + '\n' + match);
        }
        // Delete patch file after assembly
        try { rmSync(patchPath); } catch { /* ignore */ }
      }
    }
  }

  if (patches.length > 0) {
    writeFileSync(indexPath, indexContent, 'utf-8');
  }

  return { patched: patches.length > 0, patches };
}
