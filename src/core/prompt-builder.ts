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
import { matchContract, buildContractPrompt } from './contract-engine.js';

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

export function buildTaskPrompt(task: Task, subProject: SubProject, project: Project, existingFileTree?: string): string {
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

  // Existing files in the shared project root (so AI knows what's already there)
  const existingFilesSection = existingFileTree
    ? `\n--- EXISTING FILES IN PROJECT (DO NOT overwrite unless your scope allows) ---\n${existingFileTree}\n--- END EXISTING FILES ---\n`
    : '';

  // Sub-project scope isolation — prevents each sub-project from generating a full project
  let isolationWarning = '';
  switch (subProject.type) {
    case 'setup':
      isolationWarning = `\n⚠️ SUB-PROJECT SCOPE (SETUP):\n` +
        `1. Generate ONLY project scaffolding files: package.json, index.html (basic skeleton with <canvas id="game">), public/manifest.json, public/sw.js, .gitignore.\n` +
        `2. index.html MUST reference external JS files (e.g., <script src="js/game.js"></script>) — do NOT inline game logic.\n` +
        `3. Do NOT write any game logic, game loop, or application code.\n` +
        `4. All files will be written to the SHARED project root. Other sub-projects will add their files here.\n`;
      break;
    case 'development':
    case 'production':
    case 'creation':
      isolationWarning = `\n⚠️ SUB-PROJECT SCOPE (CORE DEV):\n` +
        `1. Generate ONLY core game/application code files (e.g., js/game.js, js/*.js, css/style.css).\n` +
        `2. Do NOT regenerate package.json, manifest.json, sw.js, or .gitignore — these were already created by setup.\n` +
        `3. If index.html already exists, do NOT overwrite it. Instead, ensure your JS files are referenced by the existing index.html.\n` +
        `4. All files will be written to the SHARED project root alongside files from other sub-projects.\n`;
      break;
    case 'testing':
      isolationWarning = `\n⚠️ SUB-PROJECT SCOPE (TESTING):\n` +
        `1. Generate ONLY test files (e.g., tests/*.test.js, test-utils.js).\n` +
        `2. Do NOT write application code, game logic, or configuration files.\n` +
        `3. All files will be written to the SHARED project root.\n`;
      break;
    case 'deployment':
      isolationWarning = `\n⚠️ SUB-PROJECT SCOPE (DEPLOYMENT):\n` +
        `1. Generate ONLY deployment configuration files: .github/workflows/*.yml, CNAME, SETUP.md.\n` +
        `2. You MUST NOT write any game logic, HTML game structure, or JavaScript game code.\n` +
        `3. You MUST NOT overwrite index.html, js/*.js, css/style.css, or any existing game files.\n` +
        `4. The game code already exists in the project. Your job is ONLY to add deployment infrastructure.\n`;
      break;
    case 'monetization':
      isolationWarning = `\n⚠️ SUB-PROJECT SCOPE (MONETIZATION):\n` +
        `1. Generate ONLY monetization files: ads.txt, adsense.html, js/ads.js, MONETIZATION.md.\n` +
        `2. You MUST NOT write game core logic or overwrite existing game files.\n` +
        `3. If you need to modify index.html, ONLY add ad container divs and script references — do NOT remove or change existing elements.\n` +
        `4. The game already exists. Your job is ONLY to add monetization infrastructure.\n`;
      break;
  }

  const baseContext = `You are a senior software engineer working on the project "${escapePromptInput(project.name)}".

Sub-project: ${escapePromptInput(subProject.name)}
Description: ${escapePromptInput(subProject.description)}
Target directory: ${subProject.targetDir}
Platform template: ${effectiveTemplateDesc}
User's original idea: "${escapePromptInput(project.idea.rawText)}"${contextSection}${platformSection}${existingFilesSection}${isolationWarning}`;

  if (isCodingTask) {
    // Inject gameplay contract if matched
    const contract = !isSetup && project.idea.type === 'game' ? matchContract(project.idea.rawText) : null;
    const contractSection = contract
      ? `\n## 玩法契约 (Gameplay Contract)\n${buildContractPrompt(contract, project.idea.rawText)}\n\n---\n`
      : '';

    const gameConstraint = !isSetup && project.idea.type === 'game'
      ? `${contractSection}\n4. GAME DEVELOPMENT — CORE RULES:
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
        // 升级商店：消耗金币提升塔等级
   k) BUSINESS ANALYSIS INTEGRATION (MANDATORY — kele Product Partner requirements):
      - The game MUST include share/viral mechanics appropriate for the target platform:
        * WeChat: wx.shareAppMessage() with title/imageUrl for score/achievement sharing
        * Douyin: tt.shareAppMessage() with video recording capability for gameplay clips
        * Web: Web Share API navigator.share() fallback + copy-to-clipboard for scores
      - Include a "share trigger" function with this exact signature: triggerShare(shareType, data)
      - Design at least ONE social proof mechanic: leaderboard, friend progress comparison, or achievement showcase
      - Monetization hooks MUST be naturally integrated into gameplay loops, never intrusive:
        * Ad triggers at natural breakpoints (level complete, game over, pause)
        * IAP offerings at moments of player desire (new unlock, customization, convenience)
        * Never show ads during active gameplay — only at state transitions
      - Add inline comments marking business/viral features:
        // 分享触发：通关后弹出分享按钮
        // 社交证明：好友排行榜对比
        // 变现钩子：死亡后展示复活激励视频
        // 病毒循环：分享后双方获得金币奖励
   l) PERFORMANCE REQUIREMENTS (MANDATORY — kele will analyze bundle size and performance after generation):
      - ALL image assets MUST be under 100KB. If larger, use canvas procedural generation (e.g., draw shapes, gradients, patterns) instead of image files.
      - ALL audio MUST use Web Audio API synthesis (oscillator, noise buffers) instead of loading MP3/WAV files. Exception: background music may be a single compressed file <200KB.
      - First Contentful Paint (FCP) MUST be under 2 seconds. Achieve this by:
        * Inlining critical CSS in <head>
        * Deferring non-critical JS with defer/async or dynamic import()
        * Using loading="lazy" for all below-fold images
      - Total bundle size MUST stay under platform limits:
        * WeChat Mini Program: main package ≤ 2MB, total ≤ 20MB
        * PWA/Web: total ≤ 5MB, main JS ≤ 500KB
        * Use code splitting (dynamic import) for level data, large configs, and non-core features
      - For WeChat/Douyin mini-games: use subpackages (分包) for non-critical pages and resources
      - Include inline comments marking performance optimizations:
        // 性能优化：图片使用 canvas 程序化生成，避免加载外部文件
        // 性能优化：音频使用 Web Audio API 合成
        // 性能优化：非关键资源使用懒加载
        // 性能优化：关卡数据使用动态导入分割
      ` : '';
    const setupConstraint = isSetup
      ? '\n4. This is a SETUP task — generate ONLY project configuration files (package.json, build config, .gitignore, basic HTML). NO game logic, NO application code, NO src/ directory with implementation files.'
      : '';

    const constraints = `MANDATORY CONSTRAINTS:\n1. Every acceptance criterion listed in the task description MUST be fully implemented. If any criterion is missing, the task will be REJECTED.\n2. Each file MUST be complete and functional. NO stubs, NO TODOs, NO placeholder code.\n3. If the project already has existing files, preserve them and only modify what this specific task requires.\n4. The files array MUST contain at least one actual code file. Returning ONLY notes.md is NOT acceptable.`;
    const jsonFormat = `CRITICAL: Return your response as a JSON object in this exact format (no markdown, no explanations outside the JSON):\n{\n  "files": [\n    { "path": "relative/path/to/file", "content": "file content here" }\n  ],\n  "notes": "optional notes about the implementation"\n}\n\n`;
    return `${baseContext}\n\nTask: ${escapePromptInput(task.title)}\n${task.description}\n\n${CODE_QUALITY_RULES}\n\n${jsonFormat}${constraints}${gameConstraint}${setupConstraint}`;
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
