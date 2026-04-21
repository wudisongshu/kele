/**
 * Task Validator — detects incomplete/placeholder code after AI generation.
 *
 * Core philosophy: AI MUST generate working code, not skeletons.
 * If we detect stubs, the task fails and AI must rewrite.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { findSourceFiles } from './file-utils.js';
import { validateGamePlayability } from './game-validator.js';

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  score: number; // 0-100
}

const STUB_PATTERNS = [
  /\/\/\s*TODO[:\s]/i,
  /\/\/\s*FIXME[:\s]/i,
  /\/\/\s*STUB[:\s]/i,
  /\/\/\s*HACK[:\s]/i,
  /\/\/\s*XXX[:\s]/i,
  /\/\*\s*TODO/i,
  /\/\*\s*FIXME/i,
  /function\s+\w+\s*\([^)]*\)\s*\{\s*\/\/\s*TODO/i,
  /function\s+\w+\s*\([^)]*\)\s*\{\s*\/\*\s*TODO/i,
  /function\s+\w+\s*\([^)]*\)\s*\{\s*return;?\s*\}/,
  /function\s+\w+\s*\([^)]*\)\s*\{\s*\/\/\s*placeholder/i,
  /function\s+\w+\s*\([^)]*\)\s*\{\s*throw\s+new\s+Error\s*\(\s*['"]not implemented['"]\s*\)/i,
  /function\s+\w+\s*\([^)]*\)\s*\{\s*console\.log\s*\(\s*['"]TODO['"]\s*\)/i,
  /const\s+\w+\s*=\s*\{\};?\s*\/\/\s*TODO/i,
  /class\s+\w+\s*\{[^}]*\}\s*\/\/\s*TODO/i,
  /will\s+be\s+implemented/i,
  /to\s+be\s+implemented/i,
  /placeholder\s+implementation/i,
  /not\s+yet\s+implemented/i,
  /coming\s+soon/i,
  /under\s+construction/i,
  /work\s+in\s+progress/i,
  /wip/i,
  /unfinished/i,
  /incomplete/i,
  /needs?\s+implementation/i,
  /implement\s+later/i,
  /implement\s+me/i,
  /fill\s+in\s+later/i,
  /fill\s+this\s+in/i,
  // Arrow function empty body — common stub pattern like () => {}
  /\([^)]*\)\s*=>\s*\{\s*\}/,
  // Constructor call with empty callback — e.g. new InputHandler(canvas, () => {})
  /new\s+\w+\([^)]*,\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/,
  // Common AI placeholder comments and phrases
  /\/\*\s*your\s+code\s+here\s*\*\//i,
  /\/\*\s*implement\s+this\s*\*\//i,
  /\/\/\s*Add\s+your\s+logic\s+here/i,
  /\/\/\s*Write\s+your\s+implementation/i,
  /\/\/\s*Fill\s+in\s+the\s+blanks/i,
  /\{\s*\/\*\s*\.\.\.\s*\*\/\s*\}/,
  /\{\s*\/\/\s*\.\.\.\s*\}/,
  /\/\/\s*\.\.\.\s*\n/,
];

/**

 * Validate all source files in a directory for completeness.
 */
export function validateTaskOutput(targetDir: string, taskTitle: string): ValidationResult {
  const issues: string[] = [];
  let totalFiles = 0;
  let stubFiles = 0;
  let emptyFiles = 0;

  function scanDir(dir: string) {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
        scanDir(fullPath);
      } else if (isSourceFile(entry)) {
        totalFiles++;
        const content = readFileSync(fullPath, 'utf-8');
        const fileIssues = validateFile(content, entry);
        if (fileIssues.length > 0) {
          stubFiles++;
          issues.push(`[${entry}] ${fileIssues.join(', ')}`);
        }
        // Skip empty-file check for config/meta files
        const isMetaFile = /package\.json|README|\.config\.|tsconfig|vite\.config|eslint|prettier/.test(entry);
        if (!isMetaFile && content.trim().length < 50) {
          emptyFiles++;
          if (!issues.some(i => i.includes(entry))) {
            issues.push(`[${entry}] File is nearly empty (${content.trim().length} chars)`);
          }
        }
      }
    }
  }

  scanDir(targetDir);

  // Game-specific checks
  if (taskTitle.toLowerCase().includes('game') || taskTitle.toLowerCase().includes('游戏')) {
    const gameIssues = validateGameOutput(targetDir, taskTitle);
    issues.push(...gameIssues);
  }

  // HTML-specific checks
  const htmlPath = findHtmlFile(targetDir);
  if (htmlPath) {
    const htmlIssues = validateHtmlFile(htmlPath);
    issues.push(...htmlIssues);
  }

  // Game playability check — critical for game tasks
  if (taskTitle.toLowerCase().includes('game') || taskTitle.toLowerCase().includes('游戏')) {
    const playability = validateGamePlayability(targetDir);
    if (!playability.playable) {
      issues.push(`CRITICAL: Game is not playable (score: ${playability.score}/100). Missing core mechanics.`);
    }
    for (const issue of playability.issues) {
      if (!issues.some(i => i.includes(issue.replace('CRITICAL: ', '').slice(0, 30)))) {
        issues.push(issue);
      }
    }
  }

  const score = calculateScore(totalFiles, stubFiles, emptyFiles, issues.length);
  const valid = score >= 80 && !issues.some(i => i.includes('CRITICAL'));

  return { valid, issues, score };
}

function isSourceFile(name: string): boolean {
  const exts = ['.ts', '.js', '.tsx', '.jsx', '.html', '.css', '.py', '.go', '.rs', '.java', '.json', '.md'];
  return exts.some(ext => name.endsWith(ext));
}

function validateFile(content: string, _filename: string): string[] {
  const issues: string[] = [];

  for (const pattern of STUB_PATTERNS) {
    if (pattern.test(content)) {
      const match = content.match(pattern)?.[0]?.slice(0, 40) ?? '';
      // Arrow-function empty bodies and no-op callbacks are CRITICAL — they break gameplay
      const isCritical = /=>\s*\{\s*\}/.test(match) || /new\s+\w+\([^)]*,\s*\(\s*\)\s*=>/.test(match);
      const prefix = isCritical ? 'CRITICAL: ' : '';
      issues.push(`${prefix}Contains TODO/stub: "${match}"`);
    }
  }

  // Check for empty function bodies (but allow getters/setters with returns)
  const lines = content.split('\n');
  let emptyFuncCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/function\s+\w+|\w+\([^)]*\)\s*\{|constructor\s*\(/.test(line)) {
      // Count non-empty lines until closing brace
      let j = i + 1;
      let nonEmpty = 0;
      let depth = 1;
      while (j < lines.length && depth > 0) {
        const l = lines[j].trim();
        if (l.includes('{')) depth++;
        if (l.includes('}')) depth--;
        if (depth > 0 && l.length > 0 && !l.startsWith('//') && !l.startsWith('*')) {
          nonEmpty++;
        }
        j++;
      }
      if (nonEmpty <= 1) emptyFuncCount++;
    }
  }
  if (emptyFuncCount > 2) {
    issues.push(`${emptyFuncCount} functions have empty/minimal bodies`);
  }

  return issues;
}

function validateGameOutput(targetDir: string, _taskTitle: string): string[] {
  const issues: string[] = [];

  // Check if there's any actual game rendering logic
  const htmlPath = findHtmlFile(targetDir);
  if (htmlPath) {
    const html = readFileSync(htmlPath, 'utf-8');
    if (html.includes('<canvas')) {
      // Drawing ops may be in JS files, not HTML. Scan all JS in the directory.
      const drawOps = ['fillRect', 'drawImage', 'arc', 'fillStyle', 'strokeRect', 'beginPath'];
      let foundDraw = drawOps.some((op) => html.includes(op));
      if (!foundDraw) {
        // Scan JS files for drawing operations
        const jsFiles = findSourceFiles(targetDir);
        for (const jsPath of jsFiles) {
          try {
            const jsContent = readFileSync(jsPath, 'utf-8');
            if (drawOps.some((op) => jsContent.includes(op))) {
              foundDraw = true;
              break;
            }
          } catch {
            // ignore
          }
        }
      }
      if (!foundDraw) {
        issues.push('CRITICAL: HTML has <canvas> but no drawing operations found in HTML or JS files');
      }
    }
  }

  return issues;
}

function validateHtmlFile(htmlPath: string): string[] {
  const issues: string[] = [];
  const content = readFileSync(htmlPath, 'utf-8');

  // Check for crossorigin on file:// (breaks local opening)
  if (content.includes('crossorigin') && content.includes('file:')) {
    issues.push('HTML has crossorigin attribute which breaks local file opening');
  }

  // Check script position: if in <head> and no defer/async, might fail
  const headMatch = content.match(/<head>[\s\S]*?<\/head>/i);
  const bodyMatch = content.match(/<body>[\s\S]*?<\/body>/i);
  if (headMatch && bodyMatch) {
    const hasScriptInHead = /<script[^>]*src=/.test(headMatch[0]);
    const hasCanvasInBody = /<canvas/.test(bodyMatch[0]);
    if (hasScriptInHead && hasCanvasInBody && !headMatch[0].includes('defer') && !headMatch[0].includes('async')) {
      issues.push('CRITICAL: <script> in <head> before <canvas> in <body> — will fail because DOM not ready');
    }
  }

  // Check for PWA manifest link (only for web projects, skip mini-programs)
  const isMiniProgram = existsSync(join(dirname(htmlPath), 'game.json')) || existsSync(join(dirname(htmlPath), 'project.config.json'));
  if (!isMiniProgram) {
    const hasManifestLink = content.includes('rel="manifest"') || content.includes("rel='manifest'");
    if (!hasManifestLink) {
      issues.push('No PWA manifest link found — add <link rel="manifest" href="manifest.json">');
    }
  }

  return issues;
}

function findHtmlFile(dir: string): string | undefined {
  if (!existsSync(dir)) return undefined;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const found = findHtmlFile(fullPath);
      if (found) return found;
    } else if (entry.endsWith('.html') && entry !== 'index.html') {
      return fullPath;
    } else if (entry === 'index.html') {
      return fullPath;
    }
  }
  return undefined;
}

function calculateScore(total: number, stubs: number, empty: number, issueCount: number): number {
  if (total === 0) return 100; // No source files to validate = pass
  let score = 100;
  score -= stubs * 15;
  score -= empty * 20;
  score -= issueCount * 5;
  return Math.max(0, Math.min(100, score));
}
