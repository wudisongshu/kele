import { writeFileSync, mkdirSync, existsSync, renameSync, rmSync, readdirSync, statSync, readFileSync } from 'fs';
import { dirname, join, basename } from 'path';
import { sanitizeFilePath } from './security.js';
import { extractJson as extractJsonFromUtils } from './json-utils.js';
import { debugLog } from '../debug.js';
import { getGlobalDebugLogger } from '../utils/debug-logger.js';

/**
 * FileWriter — parses AI output and writes files to disk.
 *
 * AI output formats supported:
 * 1. JSON with { files: [{ path, content }] }
 * 2. Markdown code blocks containing JSON
 * 3. Plain text (saved as notes.md)
 */

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface ParsedOutput {
  files: GeneratedFile[];
  notes: string;
}

/**
 * SubProjectFileRegistry — tracks which sub-project owns which file.
 * Prevents late-stage sub-projects from overwriting core game files.
 */
/**
 * Sub-project file whitelist: each type can only write specific files.
 * Patterns support simple glob-style wildcards (* matches any chars).
 */
export const SUBPROJECT_FILE_WHITELIST: Record<string, string[]> = {
  setup: ['package.json', 'vite.config.ts', '.gitignore', 'index.html', 'public/manifest.json', 'public/sw.js', 'manifest.json', 'sw.js', 'SETUP.md'],
  development: ['js/*.js', 'css/*.css', 'src/*.js', 'src/*.ts', 'assets/*'],
  production: ['js/*.js', 'css/*.css', 'src/*.js', 'src/*.ts', 'assets/*'],
  creation: ['js/*.js', 'css/*.css', 'src/*.js', 'src/*.ts', 'assets/*'],
  deployment: ['.github/workflows/*.yml', '.github/workflows/*.yaml', 'CNAME', 'SETUP.md', 'MONETIZATION.md', 'MONETIZE.md'],
  monetization: ['ads.txt', 'adsense.html', 'js/ads.js', 'MONETIZATION.md', 'MONETIZE.md', 'index.patch.html'],
  testing: ['tests/*.test.js', 'tests/*.test.ts', 'test-utils.js', 'test-utils.ts'],
  'ui-polish': ['css/*.css', 'assets/*', 'index.patch.html'],
};

export function matchWhitelist(path: string, whitelist: string[]): boolean {
  for (const pattern of whitelist) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*\*/g, '(.+)').replace(/\*/g, '([^/]+)') + '$');
    if (regex.test(path)) return true;
  }
  return false;
}

export class SubProjectFileRegistry {
  private ownership = new Map<string, { subProjectId: string; subProjectType: string }>();

  constructor(public readonly projectDir: string) {}

  register(filePath: string, subProjectId: string, subProjectType: string): void {
    this.ownership.set(filePath, { subProjectId, subProjectType });
  }

  getOwner(filePath: string): { subProjectId: string; subProjectType: string } | undefined {
    return this.ownership.get(filePath);
  }

  /** Check if a write operation is allowed, returning the decision and optional warning. */
  checkWrite(
    filePath: string,
    subProjectId: string,
    subProjectType: string,
  ): { allowed: boolean; warning?: string } {
    const owner = this.getOwner(filePath);
    if (!owner || owner.subProjectId === subProjectId) {
      // No owner yet, or same sub-project overwriting its own file
      return { allowed: true };
    }

    const isSetupOwner = owner.subProjectType === 'setup';
    const isSameType = owner.subProjectType === subProjectType;
    const isUiPolishOverride =
      subProjectType === 'ui-polish' &&
      (filePath.endsWith('.css') || filePath.includes('/assets/') || filePath.startsWith('assets/'));

    if (isSetupOwner) {
      return { allowed: true, warning: `Note: ${subProjectType} is overwriting setup scaffolding ${filePath}` };
    }
    if (isSameType) {
      return { allowed: true, warning: `Note: ${subProjectType} is overwriting file from same-type sub-project ${owner.subProjectId}` };
    }
    if (isUiPolishOverride) {
      return { allowed: true, warning: `Note: ui-polish is enhancing ${filePath}` };
    }

    return {
      allowed: false,
      warning: `BLOCKED: ${subProjectType}(${subProjectId}) tried to overwrite ${filePath} owned by ${owner.subProjectType}(${owner.subProjectId})`,
    };
  }
}

/**
 * Extract file definitions from notes.md markdown content.
 * Looks for ```json code blocks containing { files: [...] }.
 */
function extractFilesFromNotes(notes: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  // Match json code blocks
  const jsonBlocks = notes.match(/```json\n?([\s\S]*?)\n?```/g);
  if (!jsonBlocks) return files;
  for (const block of jsonBlocks) {
    const jsonText = block.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.files && Array.isArray(parsed.files)) {
        for (const f of parsed.files) {
          if (f.path && typeof f.content === 'string') {
            files.push({ path: f.path, content: f.content });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('File writer markdown JSON parse failed', msg);
      // Not valid JSON, skip
    }
  }
  return files;
}

/**
 * Extract JSON from text, handling markdown code blocks.
 * Uses shared json-utils for consistency, with validation.
 */
function extractJson(text: string): string | null {
  const candidate = extractJsonFromUtils(text);
  if (!candidate) return null;

  // Validate it's actually parseable JSON
  try {
    JSON.parse(candidate);
    return candidate;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog('File writer extractJson validation failed', msg);
    return null;
  }
}

/**
 * Parse AI output into structured files.
 */
export function parseAIOutput(output: string): ParsedOutput {
  const jsonStr = extractJson(output);

  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

      if (parsed.files && Array.isArray(parsed.files)) {
        const files = (parsed.files as Array<{ path?: string; content?: string }>)
          .filter((f) => f.path && f.content)
          .map((f) => ({
            path: f.path!,
            content: f.content!,
          }));

        const notes = typeof parsed.notes === 'string' ? parsed.notes : '';
        return { files, notes };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('File writer parseAIOutput JSON parse failed', msg);
      // JSON parse failed, fall through to plain text
    }
  }

  // Plain text: save as notes
  return {
    files: [],
    notes: output,
  };
}

/**
 * Write parsed files to disk under baseDir.
 * 
 * Path deduplication: if AI returns paths that include the sub-project name
 * as a prefix (e.g. "game-dev/index.html" when baseDir already ends with
 * "game-dev"), strip the duplicate prefix to avoid nested directories.
 */
export function writeFiles(
  baseDir: string,
  parsed: ParsedOutput,
  onProgress?: (msg: string) => void,
  registry?: SubProjectFileRegistry,
  subProjectId?: string,
  subProjectType?: string,
  whitelist?: string[],
): string[] {
  const written: string[] = [];
  const baseName = basename(baseDir);

  for (const file of parsed.files) {
    // Whitelist filter
    let relativePath = file.path;
    if (whitelist && whitelist.length > 0) {
      if (!matchWhitelist(relativePath, whitelist)) {
        console.warn(`[WHITELIST] Skipped non-whitelist file: ${relativePath}`);
        continue;
      }
    }

    // Strip duplicate sub-project prefix from path
    const prefixPattern = new RegExp(`^${baseName}[/\\\\]`);
    if (prefixPattern.test(relativePath)) {
      relativePath = relativePath.replace(prefixPattern, '');
    }

    // Security: reject path traversal
    const safePath = sanitizeFilePath(relativePath);
    if (!safePath) {
      console.warn(`[SECURITY] Rejected unsafe path: "${file.path}"`);
      continue;
    }
    
    const filePath = join(baseDir, safePath);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let content = file.content;

    // Reject unreasonably large files (likely AI hallucination or copy-paste error)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (content.length > MAX_FILE_SIZE) {
      console.warn(`[WARNING] File "${relativePath}" is ${(content.length / 1024 / 1024).toFixed(1)}MB — truncating to 5MB`);
      content = content.slice(0, MAX_FILE_SIZE) + '\n\n<!-- Truncated by kele: file exceeded 5MB -->';
    }

    // Auto-fix HTML files for local file opening
    if (relativePath.endsWith('.html')) {
      content = fixHtmlForLocal(content);
    }

    // Validate JSON files
    if (relativePath.endsWith('.json') || relativePath.endsWith('.webmanifest')) {
      try {
        JSON.parse(content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog(`File writer JSON validation failed: ${relativePath}`, msg);
        console.warn(`[WARNING] JSON file "${relativePath}" has syntax errors — writing anyway`);
      }
    }

    // Validate SVG files
    if (relativePath.endsWith('.svg')) {
      if (!content.includes('<svg') || !content.includes('</svg>')) {
        console.warn(`[WARNING] SVG file "${relativePath}" missing <svg> tags — writing anyway`);
      }
    }

    // Basic CSS validation
    if (relativePath.endsWith('.css')) {
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        console.warn(`[WARNING] CSS file "${relativePath}" has mismatched braces — writing anyway`);
      }
    }

    // Basic HTML validation
    if (relativePath.endsWith('.html')) {
      const hasHtml = content.includes('<html') && content.includes('</html>');
      const hasBody = content.includes('<body') && content.includes('</body>');
      if (!hasHtml || !hasBody) {
        console.warn(`[WARNING] HTML file "${relativePath}" missing essential tags (<html>, <body>) — writing anyway`);
      }
    }

    // Whitelist check: non-setup sub-projects cannot write index.html (use index.patch.html instead)
    if (relativePath === 'index.html' && subProjectType && subProjectType !== 'setup') {
      console.warn(`[WHITELIST] Skipped index.html from ${subProjectType} sub-project — use index.patch.html for HTML modifications`);
      continue;
    }

    // File ownership check (skip if no registry provided — e.g. mock mode)
    if (registry && subProjectId && subProjectType) {
      const check = registry.checkWrite(filePath, subProjectId, subProjectType);
      if (!check.allowed) {
        console.warn(`[FILE-CONFLICT] ${check.warning}`);
        continue;
      }
      if (check.warning) {
        onProgress?.(`      ⚠️  ${check.warning}`);
      }
      registry.register(filePath, subProjectId, subProjectType);
    }

    // Atomic write: write to temp file then rename
    const tmpPath = `${filePath}.tmp.${Date.now()}`;
    try {
      writeFileSync(tmpPath, content, 'utf-8');
      renameSync(tmpPath, filePath);
    } catch (err) {
      // Clean up temp file on failure
      try { rmSync(tmpPath); } catch (err) { debugLog(`File writer temp cleanup failed: ${tmpPath}`, err instanceof Error ? err.message : String(err)); }
      throw err;
    }
    const sizeKb = (content.length / 1024).toFixed(1);
    const lines = content.split('\n').length;
    onProgress?.(`      📄 ${relativePath} — ${sizeKb}KB, ${lines} lines`);
    written.push(relativePath);

    const logger = getGlobalDebugLogger();
    logger?.logIntermediate('file-writer', 'file.write', {
      path: relativePath,
      sizeBytes: content.length,
      lines,
      subProjectType,
    }).catch(() => { /* ignore */ });
  }

  if (parsed.notes && parsed.notes.trim().length > 0) {
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    // If only notes.md was written, try to extract code files from it
    if (written.length === 0 || (written.length === 1 && written[0] === 'notes.md')) {
      const extracted = extractFilesFromNotes(parsed.notes);
      if (extracted.length > 0) {
        onProgress?.(`      📝 Extracted ${extracted.length} files from notes.md`);
        for (const file of extracted) {
          const filePath = join(baseDir, file.path);
          const dir = dirname(filePath);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(filePath, file.content, 'utf-8');
          written.push(file.path);
        }
      }
    }

    const notesPath = join(baseDir, 'notes.md');
    writeFileSync(notesPath, parsed.notes, 'utf-8');
    if (!written.includes('notes.md')) {
      written.push('notes.md');
    }
  }

  // Auto-generate .gitignore if missing
  const gitignorePath = join(baseDir, '.gitignore');
  if (!existsSync(gitignorePath) && written.length > 0) {
    const gitignoreContent = 'node_modules/\ndist/\nbuild/\n.env\n*.log\n.DS_Store\n.kele/\n';
    writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
    written.push('.gitignore');
  }

  return written;
}

/**
 * Fix common HTML issues that break local file opening:
 * 1. Remove crossorigin attributes (breaks file:// protocol)
 * 2. Move scripts from <head> to end of <body> (DOM ready)
 * 3. Convert absolute /assets/ paths to relative ./assets/
 */
export function fixHtmlForLocal(html: string): string {
  let fixed = html;

  // Remove crossorigin attributes
  fixed = fixed.replace(/\scrossorigin(?:="[^"]*")?/gi, '');

  // Convert absolute /assets/ to relative ./assets/
  fixed = fixed.replace(/src="\/assets\//g, 'src="./assets/');
  fixed = fixed.replace(/href="\/assets\//g, 'href="./assets/');

  // Add base href if missing (helps relative paths work when opening file directly)
  if (!fixed.includes('<base')) {
    fixed = fixed.replace(/<head([^>]*)>/i, '<head$1>\n  <base href=".">');
  }

  // Ensure charset meta tag exists
  if (!fixed.includes('charset')) {
    fixed = fixed.replace(/<head([^>]*)>/i, '<head$1>\n  <meta charset="UTF-8">');
  }

  // Move scripts from <head> to end of <body> — but preserve defer/async/module scripts
  const headMatch = fixed.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    const headContent = headMatch[1];
    const scripts: string[] = [];
    const newHead = headContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
      // Don't move scripts that already have defer/async/type=module
      if (/\sdefer\b|\sasync\b|\stype\s*=\s*["']module["']/i.test(match)) {
        return match;
      }
      scripts.push(match);
      return '';
    }).replace(/<script[^>]*\/>/gi, (match) => {
      if (/\sdefer\b|\sasync\b|\stype\s*=\s*["']module["']/i.test(match)) {
        return match;
      }
      scripts.push(match);
      return '';
    });

    if (scripts.length > 0) {
      fixed = fixed.replace(headMatch[0], `<head>${newHead}</head>`);
      fixed = fixed.replace(/<\/body>/i, `${scripts.join('\n')}\n</body>`);
    }
  }

  return fixed;
}

/**
 * High-level function: parse AI output and write all files.
 * Returns list of written file paths (relative to baseDir).
 */
export function applyAIOutput(
  baseDir: string,
  output: string,
  onProgress?: (msg: string) => void,
  registry?: SubProjectFileRegistry,
  subProjectId?: string,
  subProjectType?: string,
  whitelist?: string[],
): string[] {
  const parsed = parseAIOutput(output);
  return writeFiles(baseDir, parsed, onProgress, registry, subProjectId, subProjectType, whitelist);
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Summary Generator
// ─────────────────────────────────────────────────────────────────────────────

const SUMMARY_IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.kele', '.vite', '.vscode']);

function walkForSummary(dir: string, depth = 0, maxDepth = 3): { path: string; size: number; isDir: boolean }[] {
  if (depth > maxDepth) return [];
  const results: { path: string; size: number; isDir: boolean }[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (SUMMARY_IGNORE.has(entry) || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      const rel = full.slice(dir.length + 1);
      if (stat.isDirectory()) {
        results.push({ path: rel + '/', size: 0, isDir: true });
        results.push(...walkForSummary(full, depth + 1, maxDepth));
      } else {
        results.push({ path: rel, size: stat.size, isDir: false });
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog('File writer walkForSummary error', msg);
  }
  return results;
}

function extractInterfaceSnippet(filePath: string, maxLines = 30): string {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    // Find lines that look like exports, interfaces, or function signatures
    const snippets: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('export') ||
        trimmed.startsWith('interface') ||
        trimmed.startsWith('type ') ||
        trimmed.startsWith('function') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('const ') && trimmed.includes(':')
      ) {
        snippets.push(line);
      }
      if (snippets.length >= maxLines) break;
    }
    return snippets.join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`File writer interface snippet read failed: ${filePath}`, msg);
    return '';
  }
}

/**
 * Generate a PROJECT_SUMMARY.md for a sub-project directory.
 * This summary is used by the ContextCompressor instead of the full file tree.
 */
export function generateProjectSummary(targetDir: string, subProjectName?: string, description?: string): string {
  if (!existsSync(targetDir)) return '';

  const files = walkForSummary(targetDir);
  const sourceFiles = files.filter((f) => !f.isDir && /\.(ts|tsx|js|jsx|html|css|json)$/.test(f.path));
  const totalSize = sourceFiles.reduce((sum, f) => sum + f.size, 0);

  const lines: string[] = [];
  lines.push(`# Project Summary: ${subProjectName || 'Unknown'}`);
  lines.push('');
  if (description) {
    lines.push(`## Description`);
    lines.push(description);
    lines.push('');
  }
  lines.push(`## Key Files (${sourceFiles.length} source files, ${(totalSize / 1024).toFixed(1)}KB total)`);
  lines.push('');

  for (const f of sourceFiles.slice(0, 30)) {
    lines.push(`- ${f.path}`);
  }
  if (sourceFiles.length > 30) {
    lines.push(`- ... and ${sourceFiles.length - 30} more files`);
  }
  lines.push('');

  // Extract interface snippets from type-definition-like files
  const typeFiles = sourceFiles.filter((f) =>
    f.path.endsWith('.d.ts') || f.path.includes('types') || f.path.includes('interface')
  );
  if (typeFiles.length > 0) {
    lines.push('## Public Interfaces');
    lines.push('');
    for (const tf of typeFiles.slice(0, 5)) {
      const snippet = extractInterfaceSnippet(join(targetDir, tf.path), 20);
      if (snippet) {
        lines.push(`### ${tf.path}`);
        lines.push('```typescript');
        lines.push(snippet);
        lines.push('```');
        lines.push('');
      }
    }
  }

  // Extract entry points
  const entryFiles = sourceFiles.filter((f) =>
    f.path === 'index.html' || f.path === 'index.js' || f.path === 'main.ts' || f.path === 'app.ts'
  );
  if (entryFiles.length > 0) {
    lines.push('## Entry Points');
    lines.push('');
    for (const ef of entryFiles) {
      lines.push(`- ${ef.path}`);
    }
    lines.push('');
  }

  const summary = lines.join('\n');

  // Write to disk
  const summaryPath = join(targetDir, 'PROJECT_SUMMARY.md');
  try {
    writeFileSync(summaryPath, summary, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`File writer summary write failed: ${summaryPath}`, msg);
  }

  return summary;
}
