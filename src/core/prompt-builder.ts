/**
 * Prompt Builder — constructs AI prompts for task execution.
 *
 * Extracted from executor.ts to reduce file size and improve testability.
 */

import type { Task, SubProject, Project } from '../types/index.js';
import { getTemplateType, getTemplateDescription } from './template-loader.js';
import { getPlatformCredentials } from '../platform-credentials.js';
import { formatPlatformGuideForPrompt, getDeployableConfigTemplate } from '../platform-knowledge.js';
import { escapePromptInput } from './security.js';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { buildProjectContext, shouldCompress } from './context-compressor.js';

const CODE_QUALITY_RULES = `CODE QUALITY REQUIREMENTS (all generated code MUST follow these rules):
1. COMPLETE IMPLEMENTATION: You MUST generate FULLY WORKING code. NO stubs, NO TODOs, NO placeholder functions. Every function must do something real.
2. PLAYABLE FIRST: For games, the core gameplay loop MUST be fully implemented and playable. Do NOT leave rendering, scoring, or game logic as stubs.
3. Modularity: Each file has ONE clear responsibility. No god files.
4. Naming: Use descriptive names (isValidEmail, not check). No abbreviations.
5. Types: Use strict typing (TypeScript/JSDoc). No 'any' types.
6. Error handling: Validate inputs, handle edge cases, fail gracefully.
7. Comments: Explain WHY, not WHAT. Complex logic gets inline comments.
8. No bloat: No speculative abstractions. If 200 lines could be 50, rewrite.
9. Consistency: Match existing code style in the project.
10. No hardcoded secrets: Use config/env for API keys, URLs, etc.
11. PWA SUPPORT (Web projects) — MANDATORY: For ALL web games and tools, generate manifest.json AND sw.js (Service Worker). Failure to include these will cause rejection. PWA enables users to install the app on their home screen and play offline, which directly increases retention and ad revenue.
12. RESPONSIVE DESIGN: All web games and tools MUST work correctly on both desktop and mobile devices. Use viewport meta tag, CSS media queries, and touch-friendly controls.
13. NPM DEPENDENCY VALIDATION: When adding npm dependencies, ONLY use well-known, verified package names (e.g., 'phaser' not 'phaser-game-engine'). If unsure, omit the dependency and inline the functionality.
14. NO EXTERNAL RESOURCE HALLUCINATION: Do NOT reference files you haven't generated (e.g., './assets/player.png' unless you also generated that file). All game assets should be generated as code (SVG, Canvas drawing, or CSS) or omitted.

DEATH LINE: If you output code with empty functions, TODO comments, or stub implementations, the task will be REJECTED and you will be asked to rewrite it completely.`;

/**
 * Build the execution prompt for a task.
 */
function getProjectFileTree(targetDir: string, maxDepth = 2): string {
  if (!existsSync(targetDir)) return '';
  const lines: string[] = [];
  function walk(dir: string, prefix: string, depth: number) {
    if (depth > maxDepth) return;
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry.startsWith('.')) continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        lines.push(`${prefix}${entry}/`);
        walk(fullPath, prefix + '  ', depth + 1);
      } else {
        const size = stat.size;
        const sizeStr = size < 1024 ? `${size}B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)}KB` : `${(size / 1024 / 1024).toFixed(1)}MB`;
        lines.push(`${prefix}${entry} (${sizeStr})`);
      }
    }
  }
  walk(targetDir, '', 0);
  return lines.length > 0 ? lines.join('\n') : '';
}

export function buildTaskPrompt(task: Task, subProject: SubProject, project: Project): string {
  const isSetup = subProject.type === 'setup';
  const templateType = getTemplateType(project.idea.monetization);
  const templateDesc = getTemplateDescription(templateType);
  const isCodingTask = ['setup', 'development', 'production', 'creation', 'build', 'testing', 'deployment', 'monetization'].includes(subProject.type);

  // Platform knowledge injection for deployment tasks
  let platformSection = '';
  if (['deployment', 'monetization', 'store-submit', 'platform-config'].includes(subProject.type)) {
    platformSection = buildPlatformSection(project.idea.monetization);
  }

  const effectiveTemplateDesc = isSetup
    ? 'Standard Web Project (package.json + Vite + index.html)'
    : templateDesc;

  // Build project context — compress if project is large
  let contextSection: string;
  if (shouldCompress(project)) {
    const compressed = buildProjectContext(project, subProject, task);
    const savedInfo = compressed.savedPercent ? ` (saved ~${compressed.savedPercent}% tokens)` : '';
    contextSection = `\n--- PROJECT CONTEXT (compressed${savedInfo}) ---\n${compressed.context}\n--- END PROJECT CONTEXT ---\n`;
  } else {
    const fileTree = getProjectFileTree(subProject.targetDir);
    const fileTreeSection = fileTree
      ? `\n--- EXISTING PROJECT FILES ---\n${fileTree}\n--- END FILE TREE ---\n`
      : '';
    const allSubProjects = project.subProjects
      .map((sp) => `  - ${sp.name} (${sp.type}) [${sp.status}] — ${sp.description}`)
      .join('\n');
    contextSection = `\nAll sub-projects:\n${allSubProjects}\n${fileTreeSection}`;
  }

  const baseContext = `You are a senior software engineer working on the project "${escapePromptInput(project.name)}".

Sub-project: ${escapePromptInput(subProject.name)}
Description: ${escapePromptInput(subProject.description)}
Target directory: ${subProject.targetDir}
Platform template: ${effectiveTemplateDesc}
User's original idea: "${escapePromptInput(project.idea.rawText)}"${contextSection}${platformSection}`;

  if (isCodingTask) {
    const gameConstraint = !isSetup && project.idea.type === 'game'
      ? `\n4. GAME DEVELOPMENT — CORE RULES:
   a) The core gameplay loop (rendering + input + game logic) MUST be fully implemented and playable.
   b) Do NOT split core mechanics across multiple tasks — this task must produce a runnable game.
   c) Choose the BEST technology for the game described by the user. If the user wants a simple browser game, HTML5 Canvas or DOM is fine. If they want a more complex game, use appropriate frameworks (Phaser, Three.js, React, Vue, etc.). If the target platform is WeChat/Douyin mini-game, follow their SDK requirements.
   d) The game MUST be runnable immediately after this task completes. If it's a web game, the user should be able to open the HTML file in a browser. If it requires a build step, include the build config and instructions.
   e) The game MUST have: (1) a visible score/lives/progress display, (2) clear start/restart/game-over states, (3) immediate feedback on player input (visual/audio).
   f) For simple web games: prefer inlining JS/CSS in a single HTML file for easy testing. For complex games or framework-based games: generate proper project structure with all files.
   g) PWA SUPPORT (MANDATORY): For web games, generate manifest.json AND sw.js. Add <link rel="manifest" href="manifest.json"> and navigator.serviceWorker.register('sw.js') to index.html.
   h) MONETIZATION INTEGRATION (MANDATORY): The game MUST include monetization code appropriate for the target platform:
      - Web/H5 games: Embed Google AdSense or ad container code directly in index.html. Include at least one ad placement (banner at bottom or interstitial between game states).
      - WeChat Mini Games: Include wx.createRewardedVideoAd() or similar ad SDK calls.
      - Douyin Mini Games: Include tt.createRewardedVideoAd() or similar ad SDK calls.
      - If no ad credentials are available, use placeholder IDs and clearly mark them with comments like /* REPLACE_WITH_YOUR_AD_UNIT_ID */.
      - The game MUST remain fully playable even with placeholder ads — do NOT block gameplay on ad loading.
   i) AD REVENUE OPTIMIZATION (MANDATORY):
      - Insert ad container DOM elements with EXACT IDs so kele can verify them:
        * Web/PWA: <div id="ad-banner-bottom"></div> and <div id="ad-interstitial"></div>
        * WeChat Mini Games: banner ad via wx.createBannerAd({ adUnitId: '...' })
        * Douyin Mini Games: banner ad via tt.createBannerAd({ adUnitId: '...' })
      - Implement ad trigger functions with these exact names:
        * showBannerAd() — show/hide banner
        * showInterstitialAd() — show full-screen ad
        * showRewardedAd(onReward) — show rewarded video, call onReward() when user completes watching
      - Trigger ads at these game events:
        * Game over → showInterstitialAd()
        * Level complete → showRewardedAd(() => { /* give bonus */ })
        * Player death → showRewardedAd(() => { /* revive */ })
        * Pause menu → showBannerAd()
      - Ad frequency cap: minimum 30 seconds between interstitial ads. Implement a lastAdTime check.
      - Ad code MUST be "runnable placeholder": use test mode or fake unit IDs, never crash if ad fails to load.
   j) PLAYABILITY REQUIREMENTS (MANDATORY — kele will score your game 0-100 after generation):
      - Your code MUST include inline comments marking playability features so kele can detect them.
      - Tower defense games MUST have: at least 2 tower types, at least 2 enemy types, wave/round system, currency/upgrades.
      - Platformer games MUST have: multiple platform types, jump physics, at least 1 enemy/obstacle, collectibles, death/respawn.
      - Racing games MUST have: steering + acceleration + brake, obstacles, speed display, power-ups, high-score save.
      - ALL games MUST have: start screen, game-over/restart, visible score, and immediate visual feedback on player action.
      - Example comments (place these near the relevant code):
        // 波次系统：每 5 关增加一种敌人
        // 防御塔类型：箭塔（单体）、炮塔（范围）
        // 收集品：金币、宝石
        // 升级商店：消耗金币提升塔等级`
      : '';
    const setupConstraint = isSetup
      ? '\n4. This is a SETUP task — generate ONLY project configuration files (package.json, build config, .gitignore, basic HTML). NO game logic, NO application code, NO src/ directory with implementation files.'
      : '';

    return `${baseContext}\n\nTask: ${escapePromptInput(task.title)}\n${task.description}\n\n${CODE_QUALITY_RULES}\n\nCRITICAL: Return your response as a JSON object in this exact format (no markdown, no explanations outside the JSON):\n{\n  "files": [\n    { "path": "relative/path/to/file", "content": "file content here" }\n  ],\n  "notes": "optional notes about the implementation"\n}\n\nMANDATORY CONSTRAINTS:\n1. Every acceptance criterion listed in the task description MUST be fully implemented. If any criterion is missing, the task will be REJECTED.\n2. Each file MUST be complete and functional. NO stubs, NO TODOs, NO placeholder code.\n3. If the project already has existing files, preserve them and only modify what this specific task requires.
4. The files array MUST contain at least one actual code file. Returning ONLY notes.md is NOT acceptable.${gameConstraint}${setupConstraint}`;
  }

  return `${baseContext}\n\nTask: ${escapePromptInput(task.title)}\n${task.description}\n\nPlease provide clear step-by-step instructions. Return as JSON:\n{\n  "files": [],\n  "notes": "your detailed instructions here"\n}`;
}

function buildPlatformSection(monetization: string): string {
  let section = '';
  const guideText = formatPlatformGuideForPrompt(monetization);
  if (guideText) {
    section = `\n${guideText}\n`;
  }

  const creds = getPlatformCredentials(monetization);
  if (creds && Object.keys(creds).length > 0) {
    const masked = Object.entries(creds).map(([k, v]) => {
      const display = v.length > 8 ? v.slice(0, 4) + '****' + v.slice(-4) : '****';
      return `${k}: ${display}`;
    });
    section += `\nPlatform credentials available:\n${masked.map((m) => `  - ${m}`).join('\n')}\n`;
    section += `\nINSTRUCTION: Use these credentials to generate deployable configuration files. `;
    section += `The user should be able to deploy with minimal manual steps. `;
    section += `Generate actual files like: CI/CD workflows, config JSONs, shell scripts, privacy policies. `;
    section += `Do NOT just output a manual guide — output the actual deployable configs.\n`;
  } else {
    section += `\nCRITICAL: No platform credentials configured. Generate deployable configs with placeholders `;
    section += `AND output a SETUP.md explaining:\n`;
    section += `  1. What platform accounts the user needs to create\n`;
    section += `  2. What credentials/materials are required\n`;
    section += `  3. How to configure them with: kele secrets --platform <name> --set key=value\n`;
    section += `  4. Step-by-step deployment commands (one command ideally)\n`;
    section += `\nGenerate BOTH the deployable config files AND the setup guide.\n`;
  }

  const deployTemplate = getDeployableConfigTemplate(monetization);
  if (deployTemplate) {
    section += `\n\nDEPLOYABLE CONFIG TEMPLATE for ${monetization}:\n${deployTemplate}\n`;
  }

  section += `\nNOTE: The platform guide above is based on kele's built-in knowledge (may be outdated). `;
  section += `Please use your latest training data to verify, correct, and supplement any outdated information `;
  section += `(especially estimated days, required materials, and policy changes).\n`;

  return section;
}

/**
 * Build a fix prompt from runtime validation errors.
 */
export function buildFixPrompt(originalPrompt: string, runResult: { stdout: string; stderr: string; exitCode: number | null }): string {
  return `${originalPrompt}\n\n` +
    `⚠️ PREVIOUS ATTEMPT FAILED AT RUNTIME.\n\n` +
    `Error output:\n${runResult.stderr.slice(0, 800)}\n\n` +
    `Standard output:\n${runResult.stdout.slice(0, 400)}\n\n` +
    `Exit code: ${runResult.exitCode}\n\n` +
    `Please fix ALL runtime errors and return the COMPLETE corrected output. ` +
    `Do NOT return partial fixes. The code MUST run successfully when executed.`;
}
