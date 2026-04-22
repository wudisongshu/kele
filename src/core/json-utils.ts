/**
 * Safe JSON extraction from AI responses.
 *
 * AI models often wrap JSON in markdown code blocks or add extra text.
 * This utility robustly extracts the JSON object/array from such responses.
 */

/**
 * Extract a JSON object or array from a string that may contain markdown,
 * extra text, or nested braces.
 *
 * Strategy:
 * 1. Try to find JSON inside markdown code blocks (```json ... ```)
 * 2. Try to find the outermost { ... } or [ ... ] structure
 * 3. Return null if no valid JSON found
 */
export function extractJson(text: string): string | null {
  if (!text || text.trim().length === 0) return null;

  // Strategy 1: Look for markdown code blocks with json
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim();
    if (looksLikeJson(inner)) return inner;
  }

  // Strategy 2: Find the outermost JSON structure by brace balancing
  const objectMatch = findBalancedJson(text, '{', '}');
  if (objectMatch) return objectMatch;

  const arrayMatch = findBalancedJson(text, '[', ']');
  if (arrayMatch) return arrayMatch;

  // Strategy 3: Fallback — just grab the first { ... } or [ ... ]
  const simpleMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (simpleMatch) {
    const candidate = simpleMatch[0];
    if (looksLikeJson(candidate)) return candidate;
  }

  return null;
}

/**
 * Pretty-print JSON for debug output.
 * Returns formatted string or the original if parsing fails.
 */
export function prettyJson(text: string): string {
  const raw = extractJson(text);
  if (!raw) return text;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // JSON pretty-print failed, return raw extracted JSON
    return raw;
  }
}

/**
 * Parse JSON from AI response with multiple fallback strategies.
 * Returns the parsed object/array or null if parsing fails.
 */
export function safeJsonParse<T = unknown>(text: string): { data: T | null; raw: string | null; error: string | null } {
  const raw = extractJson(text);
  if (!raw) {
    return { data: null, raw: null, error: 'Invalid JSON in AI response: no JSON structure found' };
  }

  try {
    const data = JSON.parse(raw) as T;
    return { data, raw, error: null };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { data: null, raw, error: `Invalid JSON in AI response: ${errorMsg}` };
  }
}

/**
 * Check if a string looks like it could be JSON.
 */
function looksLikeJson(str: string): boolean {
  const trimmed = str.trim();
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

/**
 * Find a balanced JSON structure by counting open/close braces.
 * This handles nested objects correctly.
 */
function findBalancedJson(text: string, openChar: string, closeChar: string): string | null {
  let startIndex = -1;
  let depth = 0;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === openChar) {
      if (depth === 0) {
        startIndex = i;
      }
      depth++;
    } else if (text[i] === closeChar) {
      depth--;
      if (depth === 0 && startIndex !== -1) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}
