import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';

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
 */
function extractJson(text: string): string | null {
  // Try markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try raw JSON object (starts with { and ends with })
  const jsonMatch = text.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
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
 */
export function writeFiles(baseDir: string, parsed: ParsedOutput): string[] {
  const written: string[] = [];

  for (const file of parsed.files) {
    const filePath = join(baseDir, file.path);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, file.content, 'utf-8');
    written.push(file.path);
  }

  if (parsed.notes && parsed.notes.trim().length > 0) {
    const notesPath = join(baseDir, 'notes.md');
    writeFileSync(notesPath, parsed.notes, 'utf-8');
    written.push('notes.md');
  }

  return written;
}

/**
 * High-level function: parse AI output and write all files.
 * Returns list of written file paths (relative to baseDir).
 */
export function applyAIOutput(baseDir: string, output: string): string[] {
  const parsed = parseAIOutput(output);
  return writeFiles(baseDir, parsed);
}
