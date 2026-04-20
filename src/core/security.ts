/**
 * Security utilities for kele.
 *
 * Protects against:
 * - Prompt injection (escaping user input before interpolation)
 * - Path traversal (sanitizing AI-generated file paths)
 */

/**
 * Escape user input to prevent prompt injection.
 * Removes control characters and limits length.
 */
export function escapePromptInput(input: string, maxLength = 500): string {
  if (!input || typeof input !== 'string') return '';
  // Remove control characters except common whitespace
  let cleaned = input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .trim();
  // Limit length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength) + '...';
  }
  return cleaned;
}

/**
 * Sanitize a file path to prevent path traversal.
 * Rejects paths containing '..' or absolute paths.
 * Returns null if path is unsafe.
 */
export function sanitizeFilePath(filePath: string): string | null {
  if (!filePath || typeof filePath !== 'string') return null;

  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');

  // Reject path traversal
  if (normalized.includes('..')) return null;

  // Reject absolute paths (Unix and Windows)
  if (normalized.startsWith('/')) return null;
  if (/^[a-zA-Z]:/.test(normalized)) return null;

  // Reject paths starting with ~ (home directory)
  if (normalized.startsWith('~')) return null;

  // Reject empty or dot-only paths
  const trimmed = normalized.trim();
  if (trimmed === '' || trimmed === '.') return null;

  return trimmed;
}

/**
 * Check if a path is safe to write to.
 */
export function isSafePath(filePath: string): boolean {
  return sanitizeFilePath(filePath) !== null;
}
