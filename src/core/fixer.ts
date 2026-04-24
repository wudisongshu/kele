/**
 * WholeFileFixer — syntax error recovery by regenerating the entire file.
 *
 * When the generator produces code with syntax errors, this fixer
 * triggers a full rewrite rather than attempting per-function patches.
 * This avoids the infinite-loop bugs caused by false positives in
 * FunctionLevelFixer.
 */

import type { AIAdapter } from '../ai/provider.js';
import { GameGenerator } from './generator.js';
import { validateSyntax } from './generator.js';
import { debugLog } from '../utils/logger.js';

export interface FixResult {
  fixed: boolean;
  filePath?: string;
  error?: string;
  attempts: number;
}

export class WholeFileFixer {
  private provider: AIAdapter;
  private projectRoot: string;

  constructor(provider: AIAdapter, projectRoot: string) {
    this.provider = provider;
    this.projectRoot = projectRoot;
  }

  /**
   * Fix syntax errors in the generated file by regenerating from scratch.
   * Uses the same generator with an enhanced error-context prompt.
   */
  async fix(userInput: string, maxRetries: number = 2): Promise<FixResult> {
    const generator = new GameGenerator(this.provider, this.projectRoot, {
      maxAttempts: maxRetries + 1,
    });

    debugLog('fixer', `Starting whole-file rewrite (max ${maxRetries} retries)`);
    const result = await generator.generate(userInput);

    return {
      fixed: result.success,
      filePath: result.filePath,
      error: result.error,
      attempts: result.attempts,
    };
  }

  /**
   * Quick syntax check on existing HTML content.
   */
  checkSyntax(html: string): { valid: boolean; error?: string } {
    return validateSyntax(html);
  }
}
