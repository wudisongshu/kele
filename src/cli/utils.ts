/**
 * CLI utility functions.
 */

import { randomBytes } from 'crypto';

/**
 * Generate a URL-safe project slug from user input.
 */
export function generateProjectSlug(input: string, type: string): string {
  const latin = input
    .toLowerCase()
    .replace(/[\u4e00-\u9fa5]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  if (latin.length > 0) {
    return `${latin.slice(0, 30)}-${randomBytes(3).toString('hex')}`;
  }

  return `${type}-${randomBytes(3).toString('hex')}`;
}
