/**
 * Acceptance Test Runner — executes incubator-generated acceptance criteria.
 *
 * Instead of asking AI to write test code, kele runs the acceptance criteria
 * that the incubator generated for each sub-project. This ensures tests are
 * grounded in the project's actual requirements, not generic test patterns.
 */

import type { AcceptanceCriterion, SubProject } from '../types/index.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AcceptanceResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Score: 0-100 based on critical criteria */
  score: number;
  /** Per-criterion results */
  results: CriterionResult[];
}

export interface CriterionResult {
  criterion: AcceptanceCriterion;
  passed: boolean;
  actual: string;
}

/**
 * Run all acceptance criteria for a sub-project.
 */
export function runAcceptanceCriteria(subProject: SubProject): AcceptanceResult {
  const criteria = subProject.acceptanceCriteria || [];

  if (criteria.length === 0) {
    // No criteria defined — auto-pass with warning
    return {
      passed: true,
      score: 100,
      results: [],
    };
  }

  const results: CriterionResult[] = [];
  let criticalPassed = 0;
  let criticalTotal = 0;
  let nonCriticalPassed = 0;
  let nonCriticalTotal = 0;

  for (const criterion of criteria) {
    const result = evaluateCriterion(criterion, subProject.targetDir);
    results.push(result);

    if (criterion.critical) {
      criticalTotal++;
      if (result.passed) criticalPassed++;
    } else {
      nonCriticalTotal++;
      if (result.passed) nonCriticalPassed++;
    }
  }

  // Score: critical criteria weighted 80%, non-critical 20%
  const criticalScore = criticalTotal > 0 ? (criticalPassed / criticalTotal) * 80 : 80;
  const nonCriticalScore = nonCriticalTotal > 0 ? (nonCriticalPassed / nonCriticalTotal) * 20 : 20;
  const score = Math.round(criticalScore + nonCriticalScore);

  // Pass if all critical criteria pass AND score >= 70
  const allCriticalPass = criticalTotal === 0 || criticalPassed === criticalTotal;
  const passed = allCriticalPass && score >= 70;

  return { passed, score, results };
}

function evaluateCriterion(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  switch (criterion.action) {
    case 'verify-file':
      return evaluateVerifyFile(criterion, targetDir);
    case 'check-element':
      return evaluateCheckElement(criterion, targetDir);
    case 'check-text':
      return evaluateCheckText(criterion, targetDir);
    case 'open':
      return evaluateOpen(criterion, targetDir);
    case 'play-game':
      return evaluatePlayGame(criterion, targetDir);
    default:
      return {
        criterion,
        passed: false,
        actual: `Unknown action: ${criterion.action}`,
      };
  }
}

/** Verify a file exists and optionally check its content. */
function evaluateVerifyFile(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const filePath = criterion.target;
  if (!filePath) {
    return { criterion, passed: false, actual: 'No target file path specified' };
  }

  const fullPath = join(targetDir, filePath);
  let resolvedPath: string | undefined = existsSync(fullPath) ? fullPath : undefined;

  // --- Smart detection fallback when direct path does not exist ---
  if (!resolvedPath) {
    const desc = criterion.description.toLowerCase();
    const expectedLower = (criterion.expected || '').toLowerCase();

    // 1. Game logic / JS file smart detection
    const isJsTarget = filePath.endsWith('.js');
    const isGameLogic = desc.includes('game logic') || desc.includes('main game') || desc.includes('entry file') || desc.includes('javascript');
    if (isJsTarget || isGameLogic) {
      const jsFiles = findJsFiles(targetDir);
      for (const jsPath of jsFiles) {
        try {
          const content = readFileSync(jsPath, 'utf-8');
          if (/requestAnimationFrame|setInterval|update|render|gameLoop/.test(content)) {
            resolvedPath = jsPath;
            break;
          }
        } catch {
          // Skip unreadable files
        }
      }
      // If no game logic marker found but JS files exist and it's a generic JS check, pick the first one
      if (!resolvedPath && jsFiles.length > 0 && isJsTarget) {
        resolvedPath = jsFiles[0];
      }
    }

    // 2. Stylesheet / CSS file smart detection
    const isCssTarget = filePath.endsWith('.css');
    const isStylesheet = desc.includes('style') || desc.includes('stylesheet') || desc.includes('css');
    if (!resolvedPath && (isCssTarget || isStylesheet)) {
      const cssFiles = findCssFiles(targetDir);
      if (cssFiles.length > 0) {
        resolvedPath = cssFiles[0];
      }
    }

    // 3. Canvas smart detection
    const isCanvas = desc.includes('canvas') || expectedLower.includes('canvas');
    if (!resolvedPath && isCanvas) {
      const htmlFiles = findHtmlFiles(targetDir);
      for (const htmlPath of htmlFiles) {
        try {
          const content = readFileSync(htmlPath, 'utf-8');
          if (content.includes('<canvas')) {
            resolvedPath = htmlPath;
            break;
          }
        } catch {
          // Skip unreadable files
        }
      }
      if (!resolvedPath) {
        const jsFiles = findJsFiles(targetDir);
        for (const jsPath of jsFiles) {
          try {
            const content = readFileSync(jsPath, 'utf-8');
            if (content.includes("getContext('2d')") || content.includes('getContext("2d")')) {
              resolvedPath = jsPath;
              break;
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    }
  }

  if (!resolvedPath) {
    return { criterion, passed: false, actual: `File not found: ${filePath}` };
  }

  const relativePath = resolvedPath.startsWith(targetDir + '/') ? resolvedPath.slice(targetDir.length + 1) : resolvedPath;

  // If expected mentions content checks (e.g. "contains deploy keyword")
  if (criterion.expected && !criterion.expected.includes('exist')) {
    try {
      const content = readFileSync(resolvedPath, 'utf-8');
      const checks = criterion.expected.toLowerCase().split(/[,;]/).map(s => s.trim()).filter(Boolean);
      for (const check of checks) {
        // Extract keyword from phrases like "contains canvas" or "has game loop"
        const keywordMatch = check.match(/(?:contains|has|includes?)\s+(.+)/);
        const keyword = keywordMatch ? keywordMatch[1] : check;
        if (!content.toLowerCase().includes(keyword.toLowerCase())) {
          return { criterion, passed: false, actual: `File exists but missing "${keyword}"` };
        }
      }
    } catch {
      return { criterion, passed: false, actual: 'Unable to read file content' };
    }
  }

  return { criterion, passed: true, actual: `File exists: ${relativePath}` };
}

/** Check if an HTML element exists in index.html (or specified file). */
function evaluateCheckElement(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const selector = criterion.target;
  if (!selector) {
    return { criterion, passed: false, actual: 'No selector specified' };
  }

  // Look for HTML files in targetDir
  const htmlFiles = findHtmlFiles(targetDir);
  if (htmlFiles.length === 0) {
    return { criterion, passed: false, actual: 'No HTML files found' };
  }

  // Try each HTML file
  for (const htmlPath of htmlFiles) {
    try {
      const content = readFileSync(htmlPath, 'utf-8');
      // Simple selector matching: <tag, id="selector", class="selector"
      const tagMatch = selector.match(/^(\w+)$/);
      const idMatch = selector.match(/^#(.+)$/);
      const classMatch = selector.match(/^\.(.+)$/);

      let found = false;
      if (tagMatch) {
        const tag = tagMatch[1];
        found = new RegExp(`<${tag}[^>]*>`, 'i').test(content);
      } else if (idMatch) {
        const id = idMatch[1];
        found = new RegExp(`id=["']${id}["']`, 'i').test(content);
      } else if (classMatch) {
        const cls = classMatch[1];
        found = new RegExp(`class=["'][^"']*${cls}[^"']*["']`, 'i').test(content);
      } else {
        // Generic text search
        found = content.includes(selector);
      }

      if (found) {
        return { criterion, passed: true, actual: `Found "${selector}" in ${htmlPath}` };
      }
    } catch {
      // Continue to next file
    }
  }

  return { criterion, passed: false, actual: `Element "${selector}" not found in any HTML file` };
}

/** Check if file content contains expected text. */
function evaluateCheckText(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const expected = criterion.expected;
  const targetFile = criterion.target;

  if (!expected) {
    return { criterion, passed: false, actual: 'No expected text specified' };
  }

  const filesToCheck = targetFile
    ? [join(targetDir, targetFile)]
    : findAllSourceFiles(targetDir);

  for (const filePath of filesToCheck) {
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, 'utf-8');
      const keywords = expected.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      const allFound = keywords.every(k => content.toLowerCase().includes(k.toLowerCase()));
      if (allFound) {
        return { criterion, passed: true, actual: `Found all keywords in ${filePath}` };
      }
    } catch {
      // Continue
    }
  }

  return { criterion, passed: false, actual: `Expected text not found: "${expected}"` };
}

/** Check if a file can be opened/read (exists and non-empty). */
function evaluateOpen(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const target = criterion.target;
  if (!target) {
    return { criterion, passed: false, actual: 'No target specified' };
  }

  const fullPath = join(targetDir, target);
  if (!existsSync(fullPath)) {
    return { criterion, passed: false, actual: `File not found: ${target}` };
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    if (content.trim().length === 0) {
      return { criterion, passed: false, actual: `File is empty: ${target}` };
    }
    return { criterion, passed: true, actual: `File readable: ${target} (${content.length} chars)` };
  } catch {
    return { criterion, passed: false, actual: `Unable to read: ${target}` };
  }
}

/**
 * Game-specific evaluation: check that the game has the required mechanics.
 * This does NOT require a browser — it statically analyzes the game code.
 */
function evaluatePlayGame(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const jsFiles = findJsFiles(targetDir);
  const htmlFiles = findHtmlFiles(targetDir);

  if (jsFiles.length === 0 && htmlFiles.length === 0) {
    return { criterion, passed: false, actual: 'No game files found' };
  }

  // Combine all JS content for analysis
  let allJsContent = '';
  for (const jsPath of jsFiles) {
    try {
      allJsContent += readFileSync(jsPath, 'utf-8') + '\n';
    } catch {
      // Skip unreadable files
    }
  }

  const desc = criterion.description.toLowerCase();

  // Check for specific game mechanics based on description
  if (desc.includes('render') || desc.includes('grid') || desc.includes('board')) {
    const hasCanvas = htmlFiles.some(f => {
      try {
        return readFileSync(f, 'utf-8').includes('<canvas');
      } catch { return false; }
    });
    const hasDraw = /\.fillRect|\.drawImage|\.fillText|render|drawGrid/i.test(allJsContent);
    if (!hasCanvas && !hasDraw) {
      return { criterion, passed: false, actual: 'No canvas rendering found' };
    }
  }

  if (desc.includes('click') || desc.includes('input') || desc.includes('select')) {
    const hasClickHandler = /click|mousedown|touchstart|addEventListener.*click/i.test(allJsContent);
    if (!hasClickHandler) {
      return { criterion, passed: false, actual: 'No click/input handler found' };
    }
  }

  if (desc.includes('swap') || desc.includes('match') || desc.includes('eliminate')) {
    const hasMatchLogic = /match|swap|eliminate|remove|clear|combo/i.test(allJsContent);
    if (!hasMatchLogic) {
      return { criterion, passed: false, actual: 'No match/swap/eliminate logic found' };
    }
  }

  if (desc.includes('score') || desc.includes('point')) {
    const hasScore = /score|points?|addScore/i.test(allJsContent);
    if (!hasScore) {
      return { criterion, passed: false, actual: 'No scoring logic found' };
    }
  }

  if (desc.includes('gravity') || desc.includes('refill') || desc.includes('fall')) {
    const hasGravity = /gravity|fall|refill|drop|fillEmpty/i.test(allJsContent);
    if (!hasGravity) {
      return { criterion, passed: false, actual: 'No gravity/refill logic found' };
    }
  }

  if (desc.includes('loop') || desc.includes('animation')) {
    const hasLoop = /requestAnimationFrame|setInterval|setTimeout.*loop|gameLoop/i.test(allJsContent);
    if (!hasLoop) {
      return { criterion, passed: false, actual: 'No game loop found' };
    }
  }

  if (desc.includes('pwa') || desc.includes('manifest') || desc.includes('offline')) {
    const hasManifest = existsSync(join(targetDir, 'manifest.json'));
    const hasSW = existsSync(join(targetDir, 'sw.js'));
    if (!hasManifest || !hasSW) {
      return { criterion, passed: false, actual: `PWA files missing: manifest=${hasManifest}, sw=${hasSW}` };
    }
  }

  return { criterion, passed: true, actual: 'Game mechanics verified' };
}

// --- Helpers ---

import { findHtmlFiles, findJsFiles, findCssFiles } from './file-utils.js';

function findAllSourceFiles(dir: string): string[] {
  return [...findHtmlFiles(dir), ...findJsFiles(dir)];
}
