import type { Project, Task, SubProject, ExecuteResult } from '../types/index.js';
import type { ProviderRegistry } from '../adapters/index.js';
import type { KeleDatabase } from '../db/index.js';
import { applyAIOutput, parseAIOutput } from './file-writer.js';
import { validateTaskOutput } from './task-validator.js';
import { copyTemplate, getTemplateType } from './template-loader.js';
import { debugLog } from '../debug.js';
import { reviewTaskOutput } from './task-reviewer.js';

import { runProject } from './run-validator.js';
import { runAcceptanceCriteria } from './acceptance-runner.js';
import { validateGameInBrowser, quickGameCheck } from './game-validator-browser.js';
import { buildTaskPrompt, buildFixPrompt } from './prompt-builder.js';
import { executeWithFallback, executeFixWithFallback } from './adapter-utils.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { trackTaskComplete, trackTaskFail } from './telemetry.js';

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
  const startTime = Date.now();
  const onToken = (_token: string) => {
    if (!firstTokenReceived) {
      firstTokenReceived = true;
      onProgress?.(`   ✍️  AI 开始生成代码...（请耐心等待，完整代码通常需要 1-5 分钟）`);
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
  prompt: string,
  provider: string
): Promise<string[]> {
  const { subProject, onProgress } = ctx;
  const targetDir = subProject.targetDir;

  let writtenFiles = applyAIOutput(targetDir, output, onProgress);

  if (writtenFiles.length > 0 && !(writtenFiles.length === 1 && writtenFiles[0] === 'notes.md')) {
    onProgress?.(`   📝 Written: ${writtenFiles.join(', ')}`);
  } else if (writtenFiles.length === 1 && writtenFiles[0] === 'notes.md') {
    onProgress?.(`   ⚠️  AI 输出只解析到 notes.md，尝试从中二次提取代码文件...`);
    const notesPath = join(targetDir, 'notes.md');
    if (existsSync(notesPath)) {
      const notesContent = readFileSync(notesPath, 'utf-8');
      const parsedFromNotes = parseAIOutput(notesContent);
      if (parsedFromNotes.files.length > 0) {
        const extractedFiles = applyAIOutput(targetDir, notesContent);
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
        const reformatFiles = applyAIOutput(targetDir, reformatOutput);
        if (reformatFiles.length > 1 || (reformatFiles.length === 1 && reformatFiles[0] !== 'notes.md')) {
          onProgress?.(`   📝 重新格式化后写入: ${reformatFiles.filter(f => f !== 'notes.md').join(', ')}`);
          writtenFiles = reformatFiles;
          ctx.task.result = reformatOutput;
          ctx.db.saveTask(ctx.task, ctx.project.id);
        }
      } catch {
        // Reformat failed — continue with what we have
      }
    }
  } else {
    // AI returned empty or unparseable content
    onProgress?.(`   ⚠️  AI 返回空内容，可能是服务端超时`);
    const mock = ctx.registry.get('mock');
    if (mock && provider !== 'mock') {
      onProgress?.(`   🔄 使用 Mock 模式补全内容`);
      const mockOutput = await mock.execute(prompt);
      const mockFiles = applyAIOutput(targetDir, mockOutput);
      if (mockFiles.length > 0) {
        onProgress?.(`   📝 Mock 补全: ${mockFiles.join(', ')}`);
      }
      ctx.task.result = mockOutput;
      ctx.task.aiProvider = 'mock';
      ctx.db.saveTask(ctx.task, ctx.project.id);
      writtenFiles = mockFiles;
    }
  }

  return writtenFiles;
}

/**
 * Phase 3: Static validation + runtime validation with auto-fix loop.
 * Returns { validation, runtimePassed }. Throws on fatal error.
 */
async function validateAndFixRuntime(ctx: ExecutionContext, prompt: string): Promise<{ validation: { valid: boolean; score: number }; runtimePassed: boolean }> {
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
    while (true) {
      onProgress?.(`   🔄 第 ${fixAttempt} 次修复代码质量问题...`);
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
        const fixWritten = applyAIOutput(subProject.targetDir, fixOutput);
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
      task.error = `Code validation failed after ${fixAttempt} fix attempts: ${validation.issues.join('; ')}`;
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
    const runResult = await runProject(subProject.targetDir);
    if (!runResult.success) {
      onProgress?.(`   ❌ 运行失败: ${runResult.stderr.slice(0, 200)}`);
      runtimePassed = false;
      let fixed = false;
      let fixAttempt = 1;
      while (true) {
        onProgress?.(`   🔄 第 ${fixAttempt} 次自动修复...`);
        const fixPrompt = buildFixPrompt(prompt, runResult);
        try {
          const route = ctx.registry.route(task.complexity);
          const fixOutput = await executeFixWithFallback(ctx.registry, fixPrompt, route.provider, route.adapter);
          const fixWritten = applyAIOutput(subProject.targetDir, fixOutput);
          if (fixWritten.length > 0) {
            onProgress?.(`   📝 修复后写入: ${fixWritten.join(', ')}`);
          }
          task.result = fixOutput;
          db.saveTask(task, project.id);

          const reRun = await runProject(subProject.targetDir);
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
        task.error = `Runtime validation failed after ${fixAttempt} fix attempts. ${runResult.stderr.slice(0, 200)}`;
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

    const browser = validateGameInBrowser(subProject.targetDir);
    if (!browser.playable) {
      onProgress?.(`   ❌ 游戏不可玩 (评分: ${browser.score}/100)`);
      for (const err of browser.errors.slice(0, 3)) {
        onProgress?.(`      • ${err}`);
      }
      runtimePassed = false;

      // Auto-fix: feed browser validation errors to AI
      let fixed = false;
      let fixAttempt = 1;
      while (true) {
        onProgress?.(`   🔄 第 ${fixAttempt} 次游戏修复...`);
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
          const fixWritten = applyAIOutput(subProject.targetDir, fixOutput);
          if (fixWritten.length > 0) {
            onProgress?.(`   📝 修复后写入: ${fixWritten.join(', ')}`);
          }
          task.result = fixOutput;
          db.saveTask(task, project.id);

          // Re-validate after fix
          const reBrowser = validateGameInBrowser(subProject.targetDir);
          if (reBrowser.playable) {
            onProgress?.(`   ✅ 修复后游戏可玩 (评分: ${reBrowser.score}/100)`);
            runtimePassed = true;
            fixed = true;
            break;
          }
          onProgress?.(`   ❌ 修复后仍不可玩 (评分: ${reBrowser.score}/100)`);
        } catch (fixErr) {
          const fixErrMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
          onProgress?.(`   ⚠️  修复请求失败: ${fixErrMsg.slice(0, 120)}`);
        }
      }

      if (!fixed) {
        // No mock fallback — user's idea must be honored. Report failure clearly.
        task.status = 'failed';
        task.error = `Game generation failed after 2 fix attempts. Issues: ${browser.errors.join('; ')}. ` +
          `The AI was unable to produce a playable game matching your idea "${project.idea.rawText}". ` +
          `This may be due to API limitations, timeout, or the idea being too complex. ` +
          `Suggestions: (1) try a simpler version of your idea, (2) use --mock for a quick test, or (3) check your API provider status.`;
        db.saveTask(task, project.id);
        throw new ValidationError(task.error);
      }
    } else {
      onProgress?.(`   ✅ 游戏可玩性验证通过 (评分: ${browser.score}/100)`);
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
  _runtimePassed: boolean
): Promise<void> {
  const { subProject, onProgress, task, project, db } = ctx;
  const criteria = subProject.acceptanceCriteria || [];
  if (criteria.length === 0) return;

  onProgress?.(`   🧪 执行孵化器验收标准 (${criteria.length} 项)...`);
  const acceptance = runAcceptanceCriteria(subProject);

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
  while (true) {
    onProgress?.(`   🔄 第 ${attempt} 次修复...`);

    const fixPrompt = prompt + `\n\n` +
      `⚠️ ACCEPTANCE TEST FAILED. The incubator defined these criteria that your output did not meet:\n\n` +
      failed.map((r) => `- ${r.criterion.description}\n  Expected: ${r.criterion.expected}\n  Actual: ${r.actual}`).join('\n\n') + `\n\n` +
      `Please fix ALL failures and return the COMPLETE corrected output.`;

    try {
      const route = ctx.registry.route(task.complexity);
      const retryOutput = await executeFixWithFallback(ctx.registry, fixPrompt, route.provider, route.adapter);
      const retryWritten = applyAIOutput(subProject.targetDir, retryOutput);
      if (retryWritten.length > 0) {
        onProgress?.(`   📝 修复后写入: ${retryWritten.join(', ')}`);
      }
      task.result = retryOutput;
      db.saveTask(task, project.id);

      const reAcceptance = runAcceptanceCriteria(subProject);
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
  while (true) {
    onProgress?.(`   🔄 第 ${attempt} 次修复...`);

    const fixPrompt = prompt + `\n\n` +
      `⚠️ PREVIOUS ATTEMPT FAILED QUALITY REVIEW (FAIL).\n\n` +
      `Issues found:\n${review.issues.map((i) => `- ${i}`).join('\n')}\n\n` +
      `Fix instructions:\n${review.fixInstructions}\n\n` +
      `Please fix ALL issues and return the COMPLETE corrected output. Do NOT return partial fixes.`;

    try {
      const retryOutput = await executeFixWithFallback(ctx.registry, fixPrompt, route.provider, route.adapter);
      const retryWritten = applyAIOutput(subProject.targetDir, retryOutput);
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
}

/** Custom error type for validation failures that should not be double-logged. */
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
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

    // Route to AI provider
    const route = registry.route(task.complexity);
    task.aiProvider = route.provider;
    onProgress?.(`   🤖 Using ${route.provider}`);

    // For setup tasks, copy the appropriate template based on monetization channel
    if (subProject.type === 'setup') {
      const templateType = getTemplateType(project.idea.monetization);
      const copied = copyTemplate(templateType, subProject.targetDir);
      if (copied.length > 0) {
        onProgress?.(`   📁 Template copied (${templateType}): ${copied.join(', ')}`);
      }
    }

    const prompt = buildTaskPrompt(task, subProject, project);
    debugLog(`Executor Prompt [${subProject.name} / ${task.title}]`, prompt);

    // Phase 1: AI generation
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
    await processOutput(ctx, output, prompt, provider);

    // Phase 3: Validation + runtime
    const { validation, runtimePassed } = await validateAndFixRuntime(ctx, prompt);

    // Phase 4: Acceptance criteria
    const hasAcceptanceCriteria = (subProject.acceptanceCriteria?.length || 0) > 0;
    if (hasAcceptanceCriteria) {
      await runAcceptanceValidation(ctx, prompt, validation.valid, runtimePassed);
    } else {
      // Phase 5: Legacy AI review
      await runAIQualityReview(ctx, prompt, validation.valid, runtimePassed);
    }

    const duration = Date.now() - taskStartTime;
    trackTaskComplete(project.id, task.id, task.aiProvider || 'unknown', duration);
    onProgress?.(`   ✅ Completed`);
    return { success: true, output };
  } catch (err) {
    if (err instanceof ValidationError) {
      // Already logged and saved inside the phase function
      return { success: false, error: err.message };
    }

    const error = err instanceof Error ? err.message : String(err);
    const duration = Date.now() - taskStartTime;
    task.status = 'failed';
    task.error = error;
    db.saveTask(task, project.id);
    trackTaskFail(project.id, task.id, task.aiProvider || 'unknown', error, duration);
    onProgress?.(`   ❌ Failed: ${error.slice(0, 200)}`);
    return { success: false, error };
  }
}


