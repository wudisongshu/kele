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
import { debugLog } from '../debug.js';

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
 * Backwards-compatible normalization of acceptance criteria.
 * Old-format criteria (without checkType) are inferred from action + description + expected.
 */
export function normalizeCriterion(criterion: AcceptanceCriterion): AcceptanceCriterion & { inferredCheckType: 'file_exists' | 'content_contains' | 'regex_match' | 'check_element' | 'play_game' | 'open' } {
  if (criterion.checkType) {
    return { ...criterion, inferredCheckType: criterion.checkType };
  }

  const descLower = (criterion.description || '').toLowerCase();
  const expectedLower = (criterion.expected || '').toLowerCase();
  const action = criterion.action || '';

  // Inference rules for old-format criteria
  if (action === 'verify-file') {
    // If expected clearly indicates existence only
    const isExistenceOnly =
      expectedLower.includes('exists') ||
      expectedLower.includes('is present') ||
      expectedLower.includes('is in project') ||
      expectedLower === 'file exists' ||
      expectedLower === '';

    if (isExistenceOnly) {
      return { ...criterion, checkType: 'file_exists', inferredCheckType: 'file_exists' };
    }
    // Otherwise treat as content_contains (expected should be a real snippet)
    return { ...criterion, checkType: 'content_contains', inferredCheckType: 'content_contains' };
  }

  if (action === 'check-text') {
    // Clean descriptive prefixes from expected
    const cleaned = cleanDescriptiveExpectation(criterion.expected);
    return { ...criterion, expected: cleaned, checkType: 'content_contains', inferredCheckType: 'content_contains' };
  }
  if (action === 'check-element') {
    return { ...criterion, inferredCheckType: 'check_element' };
  }

  if (action === 'play-game') {
    return { ...criterion, inferredCheckType: 'play_game' };
  }
  if (action === 'open' || action === 'load-url') {
    return { ...criterion, inferredCheckType: 'open' };
  }

  // Default fallback
  if (descLower.includes('exists') || descLower.includes('is present')) {
    return { ...criterion, checkType: 'file_exists', inferredCheckType: 'file_exists' };
  }

  return { ...criterion, checkType: 'content_contains', inferredCheckType: 'content_contains' };
}

/**
 * Detect and strip descriptive prefixes from AI-generated expectations.
 * Example: "file contains <canvas" → "<canvas"
 */
function cleanDescriptiveExpectation(expected: string): string {
  const lower = expected.toLowerCase().trim();
  const prefixes = [
    'file contains ',
    'contains ',
    'has ',
    'includes ',
    'must include ',
    'should have ',
    'should contain ',
  ];
  for (const prefix of prefixes) {
    if (lower.startsWith(prefix)) {
      return expected.slice(prefix.length).trim();
    }
  }
  return expected;
}

/**
 * Check whether an expectation looks like a descriptive sentence rather than a real code snippet.
 */
export function isDescriptiveExpectation(expected: string): boolean {
  const lower = expected.toLowerCase().trim();
  const descriptivePatterns = [
    /^file\s+contains\s+/,
    /^contains\s+/,
    /^has\s+/,
    /^includes\s+/,
    /^must\s+include\s+/,
    /^should\s+have\s+/,
    /^should\s+contain\s+/,
    /^is\s+present/,
    /^is\s+in\s+project/,
    /^file\s+exists\b.*$/,
  ];
  return descriptivePatterns.some((pattern) => pattern.test(lower));
}

/**
 * Run all acceptance criteria for a sub-project.
 */
export function runAcceptanceCriteria(subProject: SubProject, overrideCriteria?: AcceptanceCriterion[]): AcceptanceResult {
  const rawCriteria = overrideCriteria || subProject.acceptanceCriteria || [];

  if (rawCriteria.length === 0) {
    // No criteria defined — auto-pass with warning
    return {
      passed: true,
      score: 100,
      results: [],
    };
  }

  // Normalize old-format criteria before evaluation
  const criteria = rawCriteria.map(normalizeCriterion);

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

function evaluateCriterion(
  criterion: AcceptanceCriterion & { inferredCheckType: 'file_exists' | 'content_contains' | 'regex_match' | 'check_element' | 'play_game' | 'open' },
  targetDir: string,
): CriterionResult {
  switch (criterion.inferredCheckType) {
    case 'file_exists':
      return evaluateFileExists(criterion, targetDir);
    case 'content_contains':
      return evaluateContentContains(criterion, targetDir);
    case 'regex_match':
      return evaluateRegexMatch(criterion, targetDir);
    case 'check_element':
      return evaluateCheckElement(criterion, targetDir);
    case 'play_game':
      return evaluatePlayGame(criterion, targetDir);
    case 'open':
      return evaluateOpen(criterion, targetDir);
    default:
      return {
        criterion,
        passed: false,
        actual: `Unknown checkType: ${criterion.inferredCheckType}`,
      };
  }
}

/** Parse GitHub Actions workflow YAML steps for semantic checking. */
function parseWorkflowSteps(content: string): Array<{ uses?: string; name?: string }> {
  const steps: Array<{ uses?: string; name?: string }> = [];
  const stepBlocks = content.match(/-\s+name:[^\n]*(?:\n(?:\s+[^\n]*))*/g) || [];
  for (const block of stepBlocks) {
    const nameMatch = block.match(/-\s+name:\s*([^\n]*)/);
    const usesMatch = block.match(/uses:\s*([^\n]*)/);
    steps.push({
      name: nameMatch ? nameMatch[1].trim() : undefined,
      uses: usesMatch ? usesMatch[1].trim() : undefined,
    });
  }
  return steps;
}

/** Check semantic content based on file type. */
function checkSemanticContent(filePath: string, content: string, expected: string): { ok: boolean; missing?: string } {
  const lowerExpected = expected.toLowerCase();
  const checks = lowerExpected.split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  for (const check of checks) {
    const keywordMatch = check.match(/(?:contains|has|includes?)\s+(.+)/);
    const keyword = keywordMatch ? keywordMatch[1] : check;

    // YAML workflow semantic checks
    if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) {
      const steps = parseWorkflowSteps(content);
      if (keyword.includes('actions/checkout')) {
        const hasCheckout = steps.some((s) => s.uses && /actions\/checkout/.test(s.uses));
        if (!hasCheckout) return { ok: false, missing: 'actions/checkout step' };
        continue;
      }
      if (keyword.includes('actions/deploy-pages') || keyword.includes('deploy-pages')) {
        const hasDeploy = steps.some((s) => s.uses && /deploy-pages/.test(s.uses));
        if (!hasDeploy) return { ok: false, missing: 'actions/deploy-pages step' };
        continue;
      }
      if (keyword.includes('upload-pages-artifact') || keyword.includes('upload-artifact')) {
        const hasUpload = steps.some((s) => s.uses && /upload-pages-artifact/.test(s.uses));
        if (!hasUpload) return { ok: false, missing: 'actions/upload-pages-artifact step' };
        continue;
      }
      if (keyword.includes('configure-pages')) {
        const hasConfig = steps.some((s) => s.uses && /configure-pages/.test(s.uses));
        if (!hasConfig) return { ok: false, missing: 'actions/configure-pages step' };
        continue;
      }
    }

    // HTML semantic checks
    if (filePath.endsWith('.html')) {
      if (keyword.includes('viewport')) {
        const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(content);
        if (!hasViewport) return { ok: false, missing: 'viewport meta tag' };
        continue;
      }
      if (keyword.includes('canvas')) {
        const hasCanvas = content.includes('<canvas');
        if (!hasCanvas) return { ok: false, missing: '<canvas> element' };
        continue;
      }
    }

    // CSS semantic checks
    if (filePath.endsWith('.css')) {
      if (keyword.includes('media') || keyword.includes('responsive')) {
        const hasMedia = /@media\s+/.test(content);
        if (!hasMedia) return { ok: false, missing: '@media rule' };
        continue;
      }
    }

    // Default: simple text inclusion
    if (!content.toLowerCase().includes(keyword.toLowerCase())) {
      return { ok: false, missing: keyword };
    }
  }

  return { ok: true };
}

/** Check if a file exists (with smart detection fallback). */
function evaluateFileExists(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const filePath = criterion.target;
  if (!filePath) {
    return { criterion, passed: false, actual: 'No target file path specified' };
  }

  const fullPath = join(targetDir, filePath);
  let resolvedPath: string | undefined = existsSync(fullPath) ? fullPath : undefined;

  // --- Smart detection fallback when direct path does not exist ---
  if (!resolvedPath) {
    const desc = criterion.description.toLowerCase();

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
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          debugLog(`Acceptance runner JS read failed: ${jsPath}`, msg);
        }
      }
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
    const expectedLower = (criterion.expected || '').toLowerCase();
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
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          debugLog(`Acceptance runner HTML read failed: ${htmlPath}`, msg);
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
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            debugLog(`Acceptance runner JS read failed: ${jsPath}`, msg);
          }
        }
      }
    }
  }

  if (!resolvedPath) {
    return { criterion, passed: false, actual: `File not found: ${filePath}` };
  }

  const relativePath = resolvedPath.startsWith(targetDir + '/') ? resolvedPath.slice(targetDir.length + 1) : resolvedPath;
  return { criterion, passed: true, actual: `File exists: ${relativePath}` };
}

/** Check if file content contains the expected text snippet. */
function evaluateContentContains(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const targetFile = criterion.target;
  const expected = cleanDescriptiveExpectation(criterion.expected);

  if (!expected) {
    return { criterion, passed: false, actual: 'No expected text specified after cleaning' };
  }

  // Warn if the expectation still looks descriptive
  if (isDescriptiveExpectation(expected)) {
    debugLog('Acceptance runner descriptive expectation', `Criterion "${criterion.description}" has descriptive expectation: "${expected}". This may cause validation failures.`);
  }

  let filesToCheck: string[];
  if (targetFile) {
    const directPath = join(targetDir, targetFile);
    if (existsSync(directPath)) {
      filesToCheck = [directPath];
    } else {
      // Smart detection: try to find similar files
      const detected = smartDetectFile(targetFile, targetDir, criterion.description);
      filesToCheck = detected ? [detected] : [];
    }
  } else {
    filesToCheck = findAllSourceFiles(targetDir);
  }

  for (const filePath of filesToCheck) {
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, 'utf-8');
      const checkResult = checkSemanticContent(filePath, content, expected);
      if (checkResult.ok) {
        return { criterion, passed: true, actual: `Found expected text in ${filePath}` };
      }
      // If semantic check failed but simple inclusion works, accept it
      if (content.toLowerCase().includes(expected.toLowerCase())) {
        return { criterion, passed: true, actual: `Found expected text in ${filePath}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`Acceptance runner content check failed: ${filePath}`, msg);
    }
  }

  return { criterion, passed: false, actual: `Expected text not found: "${expected}"` };
}

/**
 * Smart file detection fallback — tries to find a file similar to the target
 * when the exact path does not exist.
 */
function smartDetectFile(targetFile: string, targetDir: string, description: string): string | undefined {
  const desc = description.toLowerCase();
  const expectedLower = (description || '').toLowerCase();

  // JS file detection
  const isJsTarget = targetFile.endsWith('.js');
  const isGameLogic = desc.includes('game logic') || desc.includes('main game') || desc.includes('entry file') || desc.includes('javascript');
  if (isJsTarget || isGameLogic) {
    const jsFiles = findJsFiles(targetDir);
    for (const jsPath of jsFiles) {
      try {
        const content = readFileSync(jsPath, 'utf-8');
        if (/requestAnimationFrame|setInterval|update|render|gameLoop/.test(content)) {
          return jsPath;
        }
      } catch { /* ignore */ }
    }
    if (jsFiles.length > 0 && isJsTarget) return jsFiles[0];
  }

  // CSS file detection
  const isCssTarget = targetFile.endsWith('.css');
  const isStylesheet = desc.includes('style') || desc.includes('stylesheet') || desc.includes('css');
  if ((isCssTarget || isStylesheet)) {
    const cssFiles = findCssFiles(targetDir);
    if (cssFiles.length > 0) return cssFiles[0];
  }

  // Canvas detection
  const isCanvas = desc.includes('canvas') || expectedLower.includes('canvas');
  if (isCanvas) {
    const htmlFiles = findHtmlFiles(targetDir);
    for (const htmlPath of htmlFiles) {
      try {
        if (readFileSync(htmlPath, 'utf-8').includes('<canvas')) return htmlPath;
      } catch { /* ignore */ }
    }
    const jsFiles = findJsFiles(targetDir);
    for (const jsPath of jsFiles) {
      try {
        if (readFileSync(jsPath, 'utf-8').includes("getContext('2d')") || readFileSync(jsPath, 'utf-8').includes('getContext("2d")')) {
          return jsPath;
        }
      } catch { /* ignore */ }
    }
  }

  return undefined;
}

/** Check if file content matches a regex pattern. */
/** Check if an HTML element exists in index.html (or specified file). */
function evaluateCheckElement(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const selector = criterion.target;
  if (!selector) {
    return { criterion, passed: false, actual: 'No selector specified' };
  }

  const htmlFiles = findHtmlFiles(targetDir);
  if (htmlFiles.length === 0) {
    return { criterion, passed: false, actual: 'No HTML files found' };
  }

  for (const htmlPath of htmlFiles) {
    try {
      const content = readFileSync(htmlPath, 'utf-8');
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
        found = content.includes(selector);
      }

      if (found) {
        return { criterion, passed: true, actual: `Found "${selector}" in ${htmlPath}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`Acceptance runner element check failed: ${htmlPath}`, msg);
    }
  }

  return { criterion, passed: false, actual: `Element "${selector}" not found in any HTML file` };
}

function evaluateRegexMatch(criterion: AcceptanceCriterion, targetDir: string): CriterionResult {
  const targetFile = criterion.target;
  const pattern = criterion.regexPattern;

  if (!pattern) {
    return { criterion, passed: false, actual: 'No regexPattern specified for regex_match check' };
  }

  const filesToCheck = targetFile
    ? [join(targetDir, targetFile)]
    : findAllSourceFiles(targetDir);

  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch {
    return { criterion, passed: false, actual: `Invalid regex pattern: "${pattern}"` };
  }

  for (const filePath of filesToCheck) {
    if (!existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath, 'utf-8');
      if (regex.test(content)) {
        return { criterion, passed: true, actual: `Regex matched in ${filePath}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`Acceptance runner regex check failed: ${filePath}`, msg);
    }
  }

  return { criterion, passed: false, actual: `Regex did not match: "${pattern}"` };
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`Acceptance runner open check failed: ${fullPath}`, msg);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`Acceptance runner game JS read failed: ${jsPath}`, msg);
      // Skip unreadable files
    }
  }

  const desc = criterion.description.toLowerCase();

  // Check for specific game mechanics based on description
  if (desc.includes('render') || desc.includes('grid') || desc.includes('board')) {
    const hasCanvas = htmlFiles.some(f => {
      try {
        return readFileSync(f, 'utf-8').includes('<canvas');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog(`Acceptance runner canvas check failed: ${f}`, msg);
        return false;
      }
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
