import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join, basename } from 'path';
import { sanitizeFilePath } from './security.js';
import { extractJson as extractJsonFromUtils } from './json-utils.js';

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
    } catch {
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
  } catch {
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
    } catch {
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
export function writeFiles(baseDir: string, parsed: ParsedOutput, onProgress?: (msg: string) => void): string[] {
  const written: string[] = [];
  const baseName = basename(baseDir);

  for (const file of parsed.files) {
    // Strip duplicate sub-project prefix from path
    let relativePath = file.path;
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

    writeFileSync(filePath, content, 'utf-8');
    const sizeKb = (content.length / 1024).toFixed(1);
    const lines = content.split('\n').length;
    onProgress?.(`      📄 ${relativePath} — ${sizeKb}KB, ${lines} lines`);
    written.push(relativePath);
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
function fixHtmlForLocal(html: string): string {
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

  // Move scripts from <head> to end of <body>
  const headMatch = fixed.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    const headContent = headMatch[1];
    const scripts: string[] = [];
    const newHead = headContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
      scripts.push(match);
      return '';
    }).replace(/<script[^>]*\/>/gi, (match) => {
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
export function applyAIOutput(baseDir: string, output: string, onProgress?: (msg: string) => void): string[] {
  const parsed = parseAIOutput(output);
  return writeFiles(baseDir, parsed, onProgress);
}
