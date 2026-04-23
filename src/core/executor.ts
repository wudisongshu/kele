import type { Project, Task, SubProject, ExecuteResult } from '../types/index.js';
import type { ProviderRegistry } from '../adapters/index.js';
import type { KeleDatabase } from '../db/index.js';
import { applyAIOutput, parseAIOutput, SubProjectFileRegistry, SUBPROJECT_FILE_WHITELIST } from './file-writer.js';
import { validateTaskOutput } from './task-validator.js';
import { copyTemplate, getTemplateType } from './template-loader.js';
import { debugLog } from '../debug.js';
import { reviewTaskOutput } from './task-reviewer.js';

import { runProject } from './run-validator.js';
import { runAcceptanceCriteria } from './acceptance-runner.js';
import { validateCriteriaAgainstWhitelist } from './incubator-validator.js';
import { isDescriptiveExpectation } from './acceptance-runner.js';
import { loadIncubatorConfig } from './incubator-config.js';
import { validateGameInBrowser, quickGameCheck } from './game-validator-browser.js';
import { matchContract } from './contract-engine.js';
import { assembleProject } from './project-assembler.js';
import { buildTaskPrompt, buildFixPrompt } from './prompt-builder.js';
import { executeWithFallback, executeFixWithFallback } from './adapter-utils.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { trackTaskComplete, trackTaskFail, trackFixAttempt } from './telemetry.js';
import { analyzeFailure, runRecoveryWizard, buildSimplifiedDescription, type RecoveryMode } from './recovery-wizard.js';

/**
 * Executor — schedules and runs tasks in dependency order.
 *
 * Features:
 * - Topological sorting of sub-projects by dependencies
 * - Per-task AI provider routing via ProviderRegistry
 * - Automatic retry with fallback to mock adapter
 * - Real-time status updates via KeleDatabase
 * - Sequential execution within a sub-project
 */

export interface ExecutorOptions {
  registry: ProviderRegistry;
  db: KeleDatabase;
  /** If true, skip confirmation prompts and run all tasks */
  autoRun?: boolean;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
  /** Global timeout override in seconds (per-task) */
  timeout?: number;
  /** AbortSignal to gracefully interrupt execution */
  signal?: AbortSignal;
  /** Failure recovery mode: auto = auto-fix, skip = ignore failures, interactive = ask user */
  recoveryMode?: RecoveryMode;
}

const CODING_TYPES = ['setup', 'development', 'production', 'creation', 'build', 'testing', 'deployment', 'monetization'];

/**
 * Topologically sort sub-projects by their dependency graph.
 */
export function sortSubProjects(subProjects: SubProject[]): SubProject[] {
  const visited = new Set<string>();
  const result: SubProject[] = [];

  function visit(sp: SubProject) {
    if (visited.has(sp.id)) return;
    visited.add(sp.id);

    for (const depId of sp.dependencies) {
      const dep = subProjects.find((s) => s.id === depId);
      if (dep) visit(dep);
    }

    result.push(sp);
  }

  for (const sp of subProjects) {
    visit(sp);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase functions — extracted from the monolithic executeTask
// ─────────────────────────────────────────────────────────────────────────────

interface ExecutionContext {
  task: Task;
  subProject: SubProject;
  project: Project;
  registry: ProviderRegistry;
  db: KeleDatabase;
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Phase 1: Call AI with fallback. Returns output and effective provider.
 */
async function callAI(ctx: ExecutionContext, prompt: string): Promise<{ output: string; provider: string }> {
  const { registry, onProgress, signal } = ctx;
  const route = registry.route(ctx.task.complexity);
  ctx.task.aiProvider = route.provider;

  let firstTokenReceived = false;
  let tokenCount = 0;
  const startTime = Date.now();
  const onToken = (_token: string) => {
    tokenCount++;
    if (!firstTokenReceived) {
      firstTokenReceived = true;
      onProgress?.(`   ✍️  AI 开始生成代码...（请耐心等待，完整代码通常需要 1-5 分钟）`);
    }
    // Progress update every 500 tokens so user knows AI is still working
    if (tokenCount % 500 === 0) {
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      onProgress?.(`   ⏳  已生成 ${tokenCount} tokens... (${elapsedSec} 秒)`);
    }
  };

  const result = await executeWithFallback(registry, prompt, route.provider, route.adapter, onToken, onProgress, signal);
  const elapsed = Date.now() - startTime;
  const elapsedSec = Math.round(elapsed / 1000);
  if (elapsedSec > 10) {
    onProgress?.(`   ⏱️  生成耗时 ${elapsedSec} 秒`);
  }
  return result;
}

/**
 * Phase 2: Parse AI output and write files. Handles notes.md extraction and reformatting.
 */
async function processOutput(
  ctx: ExecutionContext,
  output: string,
  _prompt: string,
  provider: string,
  registry?: SubProjectFileRegistry,
): Promise<string[]> {
  const { subProject, onProgress } = ctx;
  const targetDir = subProject.targetDir;

  const whitelist = SUBPROJECT_FILE_WHITELIST[subProject.type];
  let writtenFiles = applyAIOutput(targetDir, output, onProgress, registry, subProject.id, subProject.type, whitelist);

  if (writtenFiles.length > 0 && !(writtenFiles.length === 1 && writtenFiles[0] === 'notes.md')) {
    onProgress?.(`   📝 Written: ${writtenFiles.join(', ')}`);
  } else if (writtenFiles.length === 1 && writtenFiles[0] === 'notes.md') {
    onProgress?.(`   ⚠️  AI 输出只解析到 notes.md，尝试从中二次提取代码文件...`);
    const notesPath = join(targetDir, 'notes.md');
    if (existsSync(notesPath)) {
      const notesContent = readFileSync(notesPath, 'utf-8');
      const parsedFromNotes = parseAIOutput(notesContent);
      if (parsedFromNotes.files.length > 0) {
        const extractedFiles = applyAIOutput(targetDir, notesContent, onProgress, registry, subProject.id, subProject.type, whitelist);
        if (extractedFiles.length > 1 || (extractedFiles.length === 1 && extractedFiles[0] !== 'notes.md')) {
          onProgress?.(`   📝 二次提取成功: ${extractedFiles.filter(f => f !== 'notes.md').join(', ')}`);
          writtenFiles = extractedFiles;
        }
      }
    }
    // If still only notes.md, ask AI to reformat
    if (writtenFiles.length === 1 && writtenFiles[0] === 'notes.md' && provider !== 'mock') {
      onProgress?.(`   🔄 请求 AI 重新格式化输出...`);
      const reformatPrompt = `Your previous response was saved as notes.md but the file structure could not be extracted. Please return ONLY a JSON object in this exact format (no markdown code blocks, no explanations outside JSON):\n{\n  "files": [\n    { "path": "relative/path/to/file", "content": "complete file content here" }\n  ],\n  "notes": "optional implementation notes"\n}`;
      try {
        const route = ctx.registry.route(ctx.task.complexity);
        const reformatOutput = await route.adapter.execute(reformatPrompt);
        const reformatFiles = applyAIOutput(targetDir, reformatOutput, onProgress, registry, subProject.id, subProject.type, whitelist);
        if (reformatFiles.length > 1 || (reformatFiles.length === 1 && reformatFiles[0] !== 'notes.md')) {
          onProgress?.(`   📝 重新格式化后写入: ${reformatFiles.filter(f => f !== 'notes.md').join(', ')}`);
          writtenFiles = reformatFiles;
          ctx.task.result = reformatOutput;
          ctx.db.saveTask(ctx.task, ctx.project.id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog('Reformat failed', msg);
        // Reformat failed — continue with what we have
      }
    }
  } else {
    // AI returned empty or unparseable content — do NOT fallback to mock (AGENTS.md: real API first)
    onProgress?.(`   ⚠️  AI 返回空内容，可能是服务端超时`);
    onProgress?.(`      💡 建议：检查 API provider 状态，或稍后重试此任务`);
  }

  return writtenFiles;
}

/**
 * Phase 3: Static validation + runtime validation with auto-fix loop.
 * Returns { validation, runtimePassed }. Throws on fatal error.
 */
async function validateAndFixRuntime(
  ctx: ExecutionContext,
  prompt: string,
  registry?: SubProjectFileRegistry,
): Promise<{ validation: { valid: boolean; score: number }; runtimePassed: boolean }> {
  const { subProject, onProgress, task, project, db } = ctx;
  const isCodingTask = CODING_TYPES.includes(subProject.type);
  const provider = task.aiProvider;

  onProgress?.(`   🔍 Validating code quality...`);
  let validation = validateTaskOutput(subProject.targetDir, task.title);

  // Auto-fix loop for static validation failures (TODO/stub/empty functions)
  if (!validation.valid && provider !== 'mock') {
    onProgress?.(`   ❌ Validation FAILED (score: ${validation.score}/100)`);
    for (const issue of validation.issues.slice(0, 5)) {
      onProgress?.(`      • ${issue}`);
    }

    let fixed = false;
    let fixAttempt = 1;
    const MAX_STATIC_FIX_ATTEMPTS = 3;
    while (fixAttempt <= MAX_STATIC_FIX_ATTEMPTS) {
      trackFixAttempt(ctx.project.id, task.id, fixAttempt, 'code_quality');
      onProgress?.(`   🔄 第 ${fixAttempt}/${MAX_STATIC_FIX_ATTEMPTS} 次修复代码质量问题...`);
      const fixPrompt = prompt + `\n\n` +
        `⚠️ CODE QUALITY VALIDATION FAILED. The generated code has critical issues:\n\n` +
        `${validation.issues.map((i) => `- ${i}`).join('\n')}\n\n` +
        `CRITICAL REQUIREMENTS:\n` +
        `1. Remove ALL TODO, FIXME, STUB, HACK comments — they are NOT allowed.\n` +
        `2. Remove ALL empty or minimal function bodies (functions that do nothing).\n` +
        `3. ALL functions MUST have complete, working logic.\n` +
        `4. Do NOT use placeholder values or "coming soon" text.\n` +
        `5. Return the COMPLETE corrected output with ALL files.\n`;

      try {
        const route = ctx.registry.route(task.complexity);
        const fixOutput = await executeFixWithFallback(ctx.registry, fixPrompt, route.provider, route.adapter);
        const fixWritten = applyAIOutput(subProject.targetDir, fixOutput, onProgress, registry, subProject.id, subProject.type, SUBPROJECT_FILE_WHITELIST[subProject.type]);
        if (fixWritten.length > 0) {
          onProgress?.(`   📝 修复后写入: ${fixWritten.join(', ')}`);
        }
        task.result = fixOutput;
        db.saveTask(task, project.id);

        validation = validateTaskOutput(subProject.targetDir, task.title);
        if (validation.valid) {
          onProgress?.(`   ✅ 修复后静态检查通过 (${validation.score}/100)`);
          fixed = true;
          break;
        }
        onProgress?.(`   ❌ 修复后仍有问题 (score: ${validation.score}/100)`);
        for (const issue of validation.issues.slice(0, 3)) {
          onProgress?.(`      • ${issue}`);
        }
        fixAttempt++;
      } catch (fixErr) {
        const fixErrMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
        onProgress?.(`   ⚠️  修复请求失败: ${fixErrMsg.slice(0, 120)}`);
        fixAttempt++;
      }
    }

    if (!fixed) {
      task.status = 'failed';
      task.error = `代码质量检查在 ${MAX_STATIC_FIX_ATTEMPTS} 次修复后仍失败：${validation.issues.join('；')}`;
      db.saveTask(task, project.id);
      throw new ValidationError(task.error);
    }
  } else if (!validation.valid && provider === 'mock') {
    // Mock mode: warn but don't fail on validation issues
    onProgress?.(`   ⚠️  Mock 模式静态检查警告 (score: ${validation.score}/100)`);
    for (const issue of validation.issues.slice(0, 3)) {
      onProgress?.(`      • ${issue}`);
    }
  } else {
    onProgress?.(`   ✅ Validation passed (${validation.score}/100)`);
  }

  let runtimePassed = true;
  if (isCodingTask && provider !== 'mock') {
    onProgress?.(`   🚀 正在本地运行验证...`);
    const runResult = await runProject(subProject.targetDir, subProject.type);
    if (!runResult.success) {
      onProgress?.(`   ❌ 运行失败: ${runResult.stderr.slice(0, 200)}`);
      runtimePassed = false;
      let fixed = false;
      let fixAttempt = 1;
      const MAX_RUNTIME_FIX_ATTEMPTS = 3;
      while (fixAttempt <= MAX_RUNTIME_FIX_ATTEMPTS) {
        trackFixAttempt(ctx.project.id, task.id, fixAttempt, 'runtime');
        onProgress?.(`   🔄 第 ${fixAttempt}/${MAX_RUNTIME_FIX_ATTEMPTS} 次自动修复...`);
        const fixPrompt = buildFixPrompt(prompt, runResult);
        try {
          const route = ctx.registry.route(task.complexity);
          const fixOutput = await executeFixWithFallback(ctx.registry, fixPrompt, route.provider, route.adapter);
          const fixWritten = applyAIOutput(subProject.targetDir, fixOutput, onProgress, undefined, subProject.id, subProject.type, SUBPROJECT_FILE_WHITELIST[subProject.type]);
          if (fixWritten.length > 0) {
            onProgress?.(`   📝 修复后写入: ${fixWritten.join(', ')}`);
          }
          task.result = fixOutput;
          db.saveTask(task, project.id);

          const reRun = await runProject(subProject.targetDir, subProject.type);
          if (reRun.success) {
            onProgress?.(`   ✅ 修复后运行通过`);
            runtimePassed = true;
            fixed = true;
            break;
          }
          onProgress?.(`   ❌ 修复后仍运行失败`);
          fixAttempt++;
        } catch (fixErr) {
          const fixErrMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
          onProgress?.(`   ⚠️  修复请求失败: ${fixErrMsg.slice(0, 120)}`);
          fixAttempt++;
        }
      }

      if (!fixed) {
        task.status = 'failed';
        task.error = `运行验证在 ${MAX_RUNTIME_FIX_ATTEMPTS} 次修复后仍失败。${runResult.stderr.slice(0, 200)}`;
        db.saveTask(task, project.id);
        throw new ValidationError(task.error);
      }
    } else {
      onProgress?.(`   ✅ 本地运行验证通过`);
    }
  }

  // Browser-level game validation for game projects
  if (project.idea.type === 'game' && subProject.type === 'development') {
    onProgress?.(`   🎮 浏览器级游戏可玩性验证...`);
    const quick = quickGameCheck(subProject.targetDir);
    if (!quick.ok) {
      onProgress?.(`   ⚠️  游戏结构问题: ${quick.issues.join(', ')}`);
      runtimePassed = false;
    }

    const contract = matchContract(project.idea.rawText);
    const browser = await validateGameInBrowser(subProject.targetDir, contract || undefined, subProject.type);

    // Display playability score breakdown
    if (browser.playability) {
      const { formatPlayabilityScore } = await import('./game-playability.js');
      const playabilityMsg = formatPlayabilityScore(browser.playability);
      for (const line of playabilityMsg.split('\n')) {
        if (line.trim()) onProgress?.(`   ${line}`);
      }
    }

    if (!browser.playable) {
      onProgress?.(`   ❌ 游戏不可玩 (综合评分: ${browser.score}/100)`);
      for (const err of browser.errors.slice(0, 3)) {
        onProgress?.(`      • ${err}`);
      }
      runtimePassed = false;

      // Auto-fix: feed browser validation errors to AI
      let fixed = false;
      let fixAttempt = 1;
      const MAX_GAME_FIX_ATTEMPTS = 3;
      while (fixAttempt <= MAX_GAME_FIX_ATTEMPTS) {
        trackFixAttempt(ctx.project.id, task.id, fixAttempt, 'game');
        onProgress?.(`   🔄 第 ${fixAttempt}/${MAX_GAME_FIX_ATTEMPTS} 次游戏修复...`);
        const fixPrompt = prompt + `\n\n` +
          `⚠️ BROWSER VALIDATION FAILED. The game is NOT PLAYABLE.\n\n` +
          `Issues found:\n${browser.errors.map((e) => `- ${e}`).join('\n')}\n\n` +
          `CRITICAL REQUIREMENTS:\n` +
          `1. Generate ONLY a single index.html file with ALL JavaScript inlined in <script> tags.\n` +
          `2. Do NOT use <script src="..."> or external .js files.\n` +
          `3. The user must open index.html directly in a browser and play immediately.\n` +
          `4. Use HTML5 Canvas for rendering.\n` +
          `5. Include a complete game loop (requestAnimationFrame or setInterval).\n` +
          `6. Include input handlers (click/touch/keyboard).\n` +
          `7. Include visible score display and restart controls.\n\n` +
          `Please fix ALL issues and return the COMPLETE corrected output.`;

        try {
          const route = ctx.registry.route(task.complexity);
          const fixOutput = await executeFixWithFallback(ctx.registry, fixPrompt, route.provider, route.adapter);
          const fixWritten = applyAIOutput(subProject.targetDir, fixOutput, onProgress, undefined, subProject.id, subProject.type, SUBPROJECT_FILE_WHITELIST[subProject.type]);
          if (fixWritten.length > 0) {
            onProgress?.(`   📝 修复后写入: ${fixWritten.join(', ')}`);
          }
          task.result = fixOutput;
          db.saveTask(task, project.id);

          // Re-validate after fix
          const reBrowser = await validateGameInBrowser(subProject.targetDir, contract || undefined, subProject.type);
          if (reBrowser.playability) {
            const { formatPlayabilityScore } = await import('./game-playability.js');
            const reMsg = formatPlayabilityScore(reBrowser.playability);
            for (const line of reMsg.split('\n')) {
              if (line.trim()) onProgress?.(`   ${line}`);
            }
          }
          if (reBrowser.playable) {
            onProgress?.(`   ✅ 修复后游戏可玩 (综合评分: ${reBrowser.score}/100)`);
            runtimePassed = true;
            fixed = true;
            break;
          }
          onProgress?.(`   ❌ 修复后仍不可玩 (综合评分: ${reBrowser.score}/100)`);
        } catch (fixErr) {
          const fixErrMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
          onProgress?.(`   ⚠️  修复请求失败: ${fixErrMsg.slice(0, 120)}`);
        }
      }

      if (!fixed) {
        // No mock fallback — user's idea must be honored. Report failure clearly.
        task.status = 'failed';
        task.error = `游戏生成在 ${MAX_GAME_FIX_ATTEMPTS} 次修复后仍失败。问题：${browser.errors.join('；')}。` +
          `AI 无法生成与你想法 "${project.idea.rawText}" 匹配的可玩游戏。` +
          `可能原因：API 限制、超时、或想法过于复杂。` +
          `建议：(1) 尝试简化你的想法，(2) 使用 --mock 快速测试，(3) 检查 API provider 状态。`;
        db.saveTask(task, project.id);
        throw new ValidationError(task.error);
      }
    } else {
      onProgress?.(`   ✅ 游戏可玩性验证通过 (综合评分: ${browser.score}/100)`);
    }
  }

  return { validation, runtimePassed };
}

/**
 * Phase 4: Acceptance criteria validation with AI fix loop.
 */
async function runAcceptanceValidation(
  ctx: ExecutionContext,
  prompt: string,
  _validationPassed: boolean,
  _runtimePassed: boolean,
  registry?: SubProjectFileRegistry,
): Promise<void> {
  const { subProject, onProgress, task, project, db } = ctx;
  const criteria = subProject.acceptanceCriteria || [];
  if (criteria.length === 0) return;

  // Filter criteria against whitelist before execution to prevent infinite repair loops
  const config = loadIncubatorConfig(subProject.targetDir);
  const {
    filtered: validCriteria,
    warnings: whitelistWarnings,
    violations,
  } = await validateCriteriaAgainstWhitelist(criteria, subProject.type, subProject.targetDir, config.whitelistOverrides || []);
  if (whitelistWarnings.length > 0) {
    for (const w of whitelistWarnings) {
      onProgress?.(`      ⚠️ ${w}`);
    }
  }
  if (violations.length > 0) {
    onProgress?.(`   ❌ 以下验收标准因超出白名单且未豁免而被拦截:`);
    for (const v of violations) {
      onProgress?.(`      ✗ ${v}`);
    }
  }
  // Filter out criteria with descriptive expectations (not real code snippets)
  const qualityFiltered = validCriteria.filter((c) => {
    const checkType = c.checkType || (c.action === 'verify-file' ? 'file_exists' : 'content_contains');
    if (checkType === 'content_contains' || checkType === 'regex_match') {
      const expectation = c.expected || c.regexPattern || '';
      if (!expectation.trim()) {
        onProgress?.(`      ⚠️ 验收标准 "${c.description}" 缺少 expectation/regexPattern，已跳过`);
        return false;
      }
      if (isDescriptiveExpectation(expectation)) {
        onProgress?.(`      ⚠️ 验收标准 "${c.description}" 的 expectation 是描述性语句而非真实代码片段（"${expectation}"），已跳过。请在 prompt 中要求 AI 生成真实代码片段。`);
        return false;
      }
    }
    return true;
  });

  if (qualityFiltered.length === 0) {
    onProgress?.(`   🧪 孵化器验收标准全部被过滤（白名单或质量检查），跳过验收`);
    return;
  }

  onProgress?.(`   🧪 执行孵化器验收标准 (${qualityFiltered.length} 项)...`);
  const acceptance = runAcceptanceCriteria(subProject, qualityFiltered);

  if (acceptance.passed) {
    onProgress?.(`   ✅ 验收通过 (评分: ${acceptance.score}/100)`);
    for (const r of acceptance.results) {
      const icon = r.passed ? '✓' : '○';
      onProgress?.(`      ${icon} ${r.criterion.description}`);
    }
    return;
  }

  onProgress?.(`   ❌ 验收未通过 (评分: ${acceptance.score}/100)`);
  const failed = acceptance.results.filter(r => !r.passed);
  for (const r of failed) {
    onProgress?.(`      ✗ ${r.criterion.description} — ${r.actual}`);
  }

  let attempt = 1;
  const MAX_ACCEPTANCE_FIX_ATTEMPTS = 3;
  while (attempt <= MAX_ACCEPTANCE_FIX_ATTEMPTS) {
    trackFixAttempt(ctx.project.id, ctx.task.id, attempt, 'acceptance');
    onProgress?.(`   🔄 第 ${attempt}/${MAX_ACCEPTANCE_FIX_ATTEMPTS} 次修复...`);

    const fixPrompt = prompt + `\n\n` +
      `⚠️ ACCEPTANCE TEST FAILED. The incubator defined these criteria that your output did not meet:\n\n` +
      failed.map((r) => `- ${r.criterion.description}\n  Expected: ${r.criterion.expected}\n  Actual: ${r.actual}`).join('\n\n') + `\n\n` +
      `Please fix ALL failures and return the COMPLETE corrected output.`;

    try {
      const route = ctx.registry.route(task.complexity);
      const retryOutput = await executeFixWithFallback(ctx.registry, fixPrompt, route.provider, route.adapter);
      const retryWritten = applyAIOutput(subProject.targetDir, retryOutput, onProgress, registry, subProject.id, subProject.type, SUBPROJECT_FILE_WHITELIST[subProject.type]);
      if (retryWritten.length > 0) {
        onProgress?.(`   📝 修复后写入: ${retryWritten.join(', ')}`);
      }
      task.result = retryOutput;
      db.saveTask(task, project.id);

      const reAcceptance = runAcceptanceCriteria(subProject, validCriteria);
      if (reAcceptance.passed) {
        onProgress?.(`   ✅ 修复后验收通过 (评分: ${reAcceptance.score}/100)`);
        return;
      }
      onProgress?.(`   ⚠️  修复后仍未通过 (评分: ${reAcceptance.score}/100)`);
      attempt++;
    } catch (retryErr) {
      const retryError = retryErr instanceof Error ? retryErr.message : String(retryErr);
      onProgress?.(`   ❌ 修复请求失败: ${retryError.slice(0, 120)}`);
      attempt++;
    }
  }
  onProgress?.(`   ❌ 验收修复达到上限 (${MAX_ACCEPTANCE_FIX_ATTEMPTS} 次)，保留当前最佳结果`);
}

/**
 * Phase 5: AI quality review with fix loop (legacy path when no acceptance criteria).
 */
async function runAIQualityReview(
  ctx: ExecutionContext,
  prompt: string,
  _validationPassed: boolean,
  _runtimePassed: boolean
): Promise<void> {
  const { subProject, onProgress, task, project, db } = ctx;
  const isCodingTask = CODING_TYPES.includes(subProject.type);
  const provider = task.aiProvider;

  if (!isCodingTask || provider === 'mock') return;

  onProgress?.(`   🔍 AI 正在验收任务产出...`);
  const route = ctx.registry.route(task.complexity);
  let review = await reviewTaskOutput(task, subProject, project, route.adapter);

  if (review.verdict === 'PASS' || review.score >= 6) {
    onProgress?.(`   ✅ 验收通过 (评分: ${review.score}/10)`);
    return;
  }

  onProgress?.(`   ❌ 验收未通过 (评分: ${review.score}/10)`);
  onProgress?.(`   问题: ${review.issues.join('; ')}`);

  let attempt = 1;
  const MAX_AI_REVIEW_FIX_ATTEMPTS = 2;
  while (attempt <= MAX_AI_REVIEW_FIX_ATTEMPTS) {
    trackFixAttempt(ctx.project.id, ctx.task.id, attempt, 'ai_review');
    onProgress?.(`   🔄 第 ${attempt}/${MAX_AI_REVIEW_FIX_ATTEMPTS} 次修复...`);

    const fixPrompt = prompt + `\n\n` +
      `⚠️ PREVIOUS ATTEMPT FAILED QUALITY REVIEW (FAIL).\n\n` +
      `Issues found:\n${review.issues.map((i) => `- ${i}`).join('\n')}\n\n` +
      `Fix instructions:\n${review.fixInstructions}\n\n` +
      `Please fix ALL issues and return the COMPLETE corrected output. Do NOT return partial fixes.`;

    try {
      const retryOutput = await executeFixWithFallback(ctx.registry, fixPrompt, route.provider, route.adapter);
      const retryWritten = applyAIOutput(subProject.targetDir, retryOutput, onProgress, undefined, subProject.id, subProject.type, SUBPROJECT_FILE_WHITELIST[subProject.type]);
      if (retryWritten.length > 0) {
        onProgress?.(`   📝 修复后写入: ${retryWritten.join(', ')}`);
      }
      task.result = retryOutput;
      db.saveTask(task, project.id);

      const reValidation = validateTaskOutput(subProject.targetDir, task.title);
      if (!reValidation.valid) {
        onProgress?.(`   ❌ 修复后静态检查仍失败 (score: ${reValidation.score})`);
      }

      review = await reviewTaskOutput(task, subProject, project, route.adapter);
      if (review.verdict === 'PASS' || review.score >= 6) {
        onProgress?.(`   ✅ 修复后验收通过 (评分: ${review.score}/10)`);
        return;
      }
      onProgress?.(`   ⚠️  修复后仍未通过 (评分: ${review.score}/10)`);
      attempt++;
    } catch (retryErr) {
      const retryError = retryErr instanceof Error ? retryErr.message : String(retryErr);
      onProgress?.(`   ❌ 修复请求失败: ${retryError.slice(0, 120)}`);
      attempt++;
    }
  }
  onProgress?.(`   ⚠️  AI 质量审查修复达到上限 (${MAX_AI_REVIEW_FIX_ATTEMPTS} 次)，保留当前结果`);
}

/** Custom error type for validation failures that should not be double-logged. */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const RECOVERY_ATTEMPT_KEY = Symbol('recoveryAttempt');

/**
 * Handle task failure via the Recovery Wizard.
 * Limits to 1 recovery attempt per task to avoid infinite loops.
 */
async function handleTaskFailure(
  task: Task,
  subProject: SubProject,
  project: Project,
  options: ExecutorOptions,
  error: string
): Promise<{ recovered: boolean; result?: ExecuteResult; error?: string }> {
  const attempt = ((task as unknown as Record<symbol, number>)[RECOVERY_ATTEMPT_KEY] || 0);
  if (attempt >= 1) {
    return { recovered: false };
  }

  const { onProgress } = options;
  const diagnosis = analyzeFailure(task, error);
  const recovery = await runRecoveryWizard(diagnosis, options.recoveryMode || 'interactive', options.autoRun || false);

  onProgress?.(`   🔄 恢复模式: ${recovery.message}`);

  if (recovery.action === 'retry' || recovery.action === 'auto_fix') {
    (task as unknown as Record<symbol, number>)[RECOVERY_ATTEMPT_KEY] = attempt + 1;
    task.status = 'pending';
    task.error = undefined;
    options.db.saveTask(task, project.id);
    onProgress?.(`   🔄 重试任务...`);
    const result = await executeTask(task, subProject, project, options);
    return { recovered: true, result };
  }

  if (recovery.action === 'simplify') {
    (task as unknown as Record<symbol, number>)[RECOVERY_ATTEMPT_KEY] = attempt + 1;
    task.description = buildSimplifiedDescription(task.description, error);
    task.status = 'pending';
    task.error = undefined;
    options.db.saveTask(task, project.id);
    onProgress?.(`   🔄 以简化版需求重试...`);
    const result = await executeTask(task, subProject, project, options);
    return { recovered: true, result };
  }

  if (recovery.action === 'skip') {
    return { recovered: false, error: recovery.message };
  }

  return { recovered: false, error: recovery.message };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry points
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a single task via the routed AI provider.
 * Supports automatic fallback to mock on failure.
 */
export async function executeTask(
  task: Task,
  subProject: SubProject,
  project: Project,
  options: ExecutorOptions
): Promise<ExecuteResult> {
  const { registry, db, onProgress, signal } = options;
  const taskStartTime = Date.now();

  // Check abort before starting
  if (signal?.aborted) {
    onProgress?.(`   ⏹️  Task cancelled: ${task.title}`);
    return { success: false, error: 'Execution aborted by user' };
  }

  const ctx: ExecutionContext = { task, subProject, project, registry, db, onProgress, signal };

  try {
    task.status = 'running';
    db.saveTask(task, project.id);
    onProgress?.(`🔄 [${subProject.name}] ${task.title}`);

    // Progress step tracker
    let step = 0;
    const totalSteps = subProject.type === 'setup' ? 4 : 6;
    const nextStep = () => { step++; return `[${step}/${totalSteps}]`; };
    debugLog('Task start', JSON.stringify({ task: task.title, subProject: subProject.name, type: subProject.type, totalSteps }));

    // Route to AI provider
    const route = registry.route(task.complexity);
    task.aiProvider = route.provider;
    const modelInfo = route.adapter.getModelInfo?.();
    const modelLabel = modelInfo ? ` (${modelInfo.name})` : '';
    onProgress?.(`   ${nextStep()} 🤖 Using ${route.provider}${modelLabel}`);

    // For setup tasks, AFTER AI generates config, copy template files that are missing.
    // This ensures AI-generated files (like index.html) are not overwritten by templates.
    // Templates provide scaffolding (manifest.json, sw.js, ads.txt) that AI might forget.
    const isSetupTask = subProject.type === 'setup';
    let templateType: string | null = null;
    if (isSetupTask) {
      templateType = getTemplateType(project.idea.monetization);
    }

    // Build existing file tree for shared-root awareness (shallow read for speed)
    let existingFileTree = '';
    try {
      if (existsSync(subProject.targetDir)) {
        const entries = readdirSync(subProject.targetDir, { withFileTypes: true });
        const files = entries
          .filter((e) => e.isFile() && !e.name.startsWith('.') && e.name !== 'node_modules')
          .map((e) => e.name);
        if (files.length > 0) {
          existingFileTree = files.slice(0, 30).join('\n') + (files.length > 30 ? `\n... and ${files.length - 30} more files` : '');
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Dir read error', msg);
      // Ignore read errors (e.g. dir does not exist)
    }

    const prompt = await buildTaskPrompt(task, subProject, project, existingFileTree || undefined);
    debugLog(`Executor Prompt [${subProject.name} / ${task.title}]`, prompt);

    // Phase 1: AI generation
    onProgress?.(`   ${nextStep()} ✍️  Generating code...`);
    debugLog('AI generation start', JSON.stringify({ task: task.title, provider: route.provider }));
    const aiResult = await callAI(ctx, prompt);
    const output = aiResult.output;
    const provider = aiResult.provider;
    task.aiProvider = provider as Task['aiProvider'];

    // Check abort after AI call
    if (signal?.aborted) {
      task.status = 'failed';
      task.error = 'Execution aborted by user';
      db.saveTask(task, project.id);
      onProgress?.(`   ⏹️  Task aborted: ${task.title}`);
      return { success: false, error: 'Execution aborted by user' };
    }

    task.status = 'completed';
    task.result = output;
    db.saveTask(task, project.id);

    // Phase 2: File processing
    debugLog('File processing start', JSON.stringify({ task: task.title, outputLength: output.length }));
    const fileRegistry = new SubProjectFileRegistry(subProject.targetDir);
    const writtenFiles = await processOutput(ctx, output, prompt, provider, fileRegistry);
    if (writtenFiles.length === 0) {
      throw new ValidationError('AI 返回空输出，未生成任何文件。这通常是因为 API 超时或返回了空响应。建议：(1) 检查网络连接和 API provider 状态，(2) 运行 kele retry 重试此任务，(3) 使用 kele --mock 快速测试。');
    }

    // After AI writes files, copy missing template files (e.g., manifest.json, sw.js, ads.txt)
    // This prevents AI from overwriting template scaffolding while ensuring nothing is missing.
    if (isSetupTask && templateType) {
      const copied = copyTemplate(templateType as import('./template-loader.js').TemplateType, subProject.targetDir, true);
      if (copied.length > 0) {
        onProgress?.(`   📁 Template scaffolding copied (missing only): ${copied.join(', ')}`);
      }
    }

    // Phase 3: Validation + runtime
    debugLog('Validation start', JSON.stringify({ task: task.title }));
    const { validation, runtimePassed } = await validateAndFixRuntime(ctx, prompt, fileRegistry);
    debugLog('Validation result', JSON.stringify({ task: task.title, valid: validation.valid, runtimePassed }));

    // Phase 4: Acceptance criteria
    const hasAcceptanceCriteria = (subProject.acceptanceCriteria?.length || 0) > 0;
    if (hasAcceptanceCriteria) {
      await runAcceptanceValidation(ctx, prompt, validation.valid, runtimePassed, fileRegistry);
    } else {
      // Phase 5: Legacy AI review
      await runAIQualityReview(ctx, prompt, validation.valid, runtimePassed);
    }

    // Phase 6: Performance analysis and auto-optimization
    if (CODING_TYPES.includes(subProject.type)) {
      const platform = project.idea.monetization || 'web';
      const { runPerformanceOptimization, formatPerformanceReport, shouldAutoOptimize } = await import('./performance-engine.js');
      const perfReport = runPerformanceOptimization(subProject.targetDir, platform);
      onProgress?.(formatPerformanceReport(perfReport));

      if (shouldAutoOptimize(perfReport)) {
        onProgress?.(`   ⚠️ 性能分 ${perfReport.metrics.score} < 70，已生成优化任务...`);
        // Create a follow-up optimization task in the same sub-project
        const optTask: Task = {
          id: `perf-opt-${Date.now()}`,
          subProjectId: subProject.id,
          title: `自动性能优化（${platform}）`,
          description: `基于性能分析自动优化：${perfReport.optimizations.map((o) => o.action).join('、')}`,
          complexity: 'simple',
          status: 'pending',
          version: 1,
          createdAt: new Date().toISOString(),
        };
        db.saveTask(optTask, project.id);
        project.tasks.push(optTask);
      }
    }

    // Phase 7: Assemble patches (index.patch.html -> index.html)
    const assembly = assembleProject(subProject.targetDir);
    if (assembly.patched) {
      onProgress?.(`   🔧 Assembled ${assembly.patches.length} patch file(s) into index.html`);
    }

    const duration = Date.now() - taskStartTime;
    debugLog('Task complete', JSON.stringify({ task: task.title, duration, provider: task.aiProvider }));
    trackTaskComplete(project.id, task.id, task.aiProvider || 'unknown', duration);
    onProgress?.(`   ✅ Completed`);
    return { success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    // Recovery wizard: diagnose and offer repair options
    const recovery = await handleTaskFailure(task, subProject, project, options, error);
    if (recovery.recovered) {
      return recovery.result!;
    }

    const finalError = recovery.error || error;
    const duration = Date.now() - taskStartTime;
    task.status = 'failed';
    task.error = finalError;
    db.saveTask(task, project.id);
    trackTaskFail(project.id, task.id, task.aiProvider || 'unknown', finalError, duration);
    onProgress?.(`   ❌ Failed: ${finalError.slice(0, 200)}`);
    return { success: false, error: finalError };
  }
}


