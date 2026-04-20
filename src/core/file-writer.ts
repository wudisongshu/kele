import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join, basename } from 'path';
import { sanitizeFilePath } from './security.js';

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
 * Extract JSON from text, handling markdown code blocks.
 *
 * Strategy:
 * 1. Try direct JSON parse first (fast path for well-formed output)
 * 2. Try extracting from ```json code blocks
 * 3. Try extracting from the first { to the matching } (last resort)
 */
function extractJson(text: string): string | null {
  const trimmed = text.trim();

  // Fast path: entire output is valid JSON
  if (trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      // Not valid JSON as-is, continue to extraction
    }
  }

  // Try markdown code blocks — find the one that parses as valid JSON
  // Use global match to find ALL code blocks, then try each
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // This code block isn't valid JSON, try next
      }
    }
  }

  // Last resort: find the outermost JSON object
  // Match from first '{' to the last '}'
  const jsonMatch = trimmed.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    try {
      JSON.parse(jsonMatch[1]);
      return jsonMatch[1];
    } catch {
      // Not valid JSON
    }
  }

  return null;
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
export function writeFiles(baseDir: string, parsed: ParsedOutput): string[] {
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

    // Auto-fix HTML files for local file opening
    if (relativePath.endsWith('.html')) {
      content = fixHtmlForLocal(content);
    }

    writeFileSync(filePath, content, 'utf-8');
    written.push(relativePath);
  }

  if (parsed.notes && parsed.notes.trim().length > 0) {
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }
    const notesPath = join(baseDir, 'notes.md');
    writeFileSync(notesPath, parsed.notes, 'utf-8');
    written.push('notes.md');
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
export function applyAIOutput(baseDir: string, output: string): string[] {
  const parsed = parseAIOutput(output);
  return writeFiles(baseDir, parsed);
}
