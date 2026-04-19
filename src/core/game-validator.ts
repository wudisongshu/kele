import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Game Validator — checks if a generated game is actually playable.
 *
 * Static analysis can find TODOs, but only semantic checks can verify
 * that the game logic is real. This module scans JS/HTML for evidence
 * of a working match-3 (or similar) game loop.
 */

export interface GameValidationResult {
  playable: boolean;
  issues: string[];
  score: number; // 0-100
}

const CRITICAL_PATTERNS = [
  // Must have a game board / grid representation
  { regex: /ROWS?\s*=\s*\d+|COLS?\s*=\s*\d+|grid\s*\[|board\s*\[|matrix\s*\[/i, name: 'game board/grid data structure' },
  // Must have click/touch handlers
  { regex: /addEventListener\s*\(\s*['"]click['"]|addEventListener\s*\(\s*['"]touchstart['"]|onclick|ontouchstart|mousedown|touchstart/i, name: 'click/touch event handler' },
  // Must have match detection logic
  { regex: /match|消除|三连|3\+|[≥>]\s*3|horizontal|vertical|checkMatch|findMatch/i, name: 'match detection logic' },
  // Must have a score or state tracker
  { regex: /score|points|分数|level|关卡|steps|步数|timer|计时/i, name: 'score or game state tracking' },
  // Must render something (canvas 2d context or DOM manipulation)
  { regex: /getContext\s*\(\s*['"]2d['"]\s*\)|fillRect|fillStyle|drawImage|appendChild|innerHTML|textContent/i, name: 'rendering code (canvas or DOM)' },
];

const NICE_TO_HAVE = [
  { regex: /requestAnimationFrame|setInterval|setTimeout.*game|gameLoop|update/i, name: 'game loop (animation frame or timer)' },
  { regex: /eliminate|remove|splice|delete|pop.*tile|clearRect/i, name: 'tile elimination/removal' },
  { regex: /gravity|fall|下落|drop|moveDown|shiftDown/i, name: 'gravity/falling mechanism' },
  { regex: /spawn|generate|create|random|new.*tile|fillEmpty/i, name: 'new tile generation' },
  { regex: /swap|交换|exchange|toggle|selected/i, name: 'tile swap/selection logic' },
  { regex: /animation|transition|animate|scale|opacity|transform/i, name: 'animation effects' },
  { regex: /game\s*over|gameover|win|lose|victory|失败|胜利|通关/i, name: 'game over/win condition' },
];

function findJsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...findJsFiles(full));
    } else if (/\.(js|ts|jsx|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function findHtmlFile(dir: string): string | null {
  const candidates = ['index.html', 'game.html', 'app.html'];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) return p;
  }
  return null;
}

export function validateGamePlayability(targetDir: string): GameValidationResult {
  const issues: string[] = [];
  const jsFiles = findJsFiles(targetDir);
  const htmlPath = findHtmlFile(targetDir);

  // Combine all JS code into one string for analysis
  let allCode = '';
  for (const f of jsFiles) {
    try {
      allCode += readFileSync(f, 'utf-8') + '\n';
    } catch {
      // ignore
    }
  }

  // Also read inline scripts from HTML
  if (htmlPath) {
    try {
      const html = readFileSync(htmlPath, 'utf-8');
      // Extract inline <script> tags
      const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of scriptMatches) {
        allCode += m[1] + '\n';
      }
    } catch {
      // ignore
    }
  }

  if (allCode.trim().length < 200) {
    issues.push('CRITICAL: Total JS code is less than 200 characters — likely empty or placeholder');
  }

  let criticalFound = 0;
  for (const p of CRITICAL_PATTERNS) {
    if (p.regex.test(allCode)) {
      criticalFound++;
    } else {
      issues.push(`CRITICAL: Missing ${p.name} — game cannot function without this`);
    }
  }

  let niceFound = 0;
  for (const p of NICE_TO_HAVE) {
    if (p.regex.test(allCode)) {
      niceFound++;
    } else {
      issues.push(`Missing ${p.name} — game will feel incomplete`);
    }
  }

  // Calculate score: criticals are worth more
  const criticalScore = (criticalFound / CRITICAL_PATTERNS.length) * 70;
  const niceScore = (niceFound / NICE_TO_HAVE.length) * 30;
  const score = Math.round(criticalScore + niceScore);

  // A game is "playable" only if ALL critical patterns are present AND score >= 60
  const playable = criticalFound === CRITICAL_PATTERNS.length && score >= 60;

  return { playable, issues, score };
}
