import type { Project, Task, SubProject, ExecuteResult } from '../types/index.js';
import type { ProviderRegistry } from '../adapters/index.js';
import type { KeleDatabase } from '../db/index.js';
import { applyAIOutput, parseAIOutput } from './file-writer.js';
import { validateTaskOutput } from './task-validator.js';
import { copyTemplate, getTemplateType, getTemplateDescription } from './template-loader.js';
import { getPlatformCredentials } from '../platform-credentials.js';
import { formatPlatformGuideForPrompt, getDeployableConfigTemplate } from '../platform-knowledge.js';
import { debugLog } from '../debug.js';
import { reviewTaskOutput } from './task-reviewer.js';
import { reviewProjectHealth } from './project-reviewer.js';
import { runProject, buildFixPrompt } from './run-validator.js';
import { runAcceptanceCriteria } from './acceptance-runner.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

/**
 * Code quality rules injected into every coding task prompt.
 * Ensures AI-generated code is maintainable and follows best practices.
 */
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

DEATH LINE: If you output code with empty functions, TODO comments, or stub implementations, the task will be REJECTED and you will be asked to rewrite it completely.`;

/**
 * Build a prompt for a specific task.
 */
function buildPrompt(task: Task, subProject: SubProject, project: Project): string {
  // Setup tasks always use generic web scaffold template (not platform-specific)
  const templateType = subProject.type === 'setup' ? 'web-scaffold' : getTemplateType(project.idea.monetization);
  const templateDesc = getTemplateDescription(templateType);
  const isCodingTask = ['setup', 'development', 'production', 'creation', 'build', 'testing', 'deployment', 'monetization'].includes(subProject.type);

  // Inject platform knowledge + credentials for deployment tasks
  let platformSection = '';
  if (['deployment', 'monetization', 'store-submit', 'platform-config'].includes(subProject.type)) {
    const guideText = formatPlatformGuideForPrompt(project.idea.monetization);
    if (guideText) {
      platformSection = `\n${guideText}\n`;
    }

    const creds = getPlatformCredentials(project.idea.monetization);
    if (creds && Object.keys(creds).length > 0) {
      const masked = Object.entries(creds).map(([k, v]) => {
        const display = v.length > 8 ? v.slice(0, 4) + '****' + v.slice(-4) : '****';
        return `${k}: ${display}`;
      });
      platformSection += `\nPlatform credentials available:\n${masked.map((m) => `  - ${m}`).join('\n')}\n`;
      platformSection += `\nINSTRUCTION: Use these credentials to generate deployable configuration files. `;
      platformSection += `The user should be able to deploy with minimal manual steps. `;
      platformSection += `Generate actual files like: CI/CD workflows, config JSONs, shell scripts, privacy policies. `;
      platformSection += `Do NOT just output a manual guide — output the actual deployable configs.\n`;
    } else {
      platformSection += `\nCRITICAL: No platform credentials configured. Generate deployable configs with placeholders `;
      platformSection += `AND output a SETUP.md explaining:\n`;
      platformSection += `  1. What platform accounts the user needs to create\n`;
      platformSection += `  2. What credentials/materials are required\n`;
      platformSection += `  3. How to configure them with: kele secrets --platform <name> --set key=value\n`;
      platformSection += `  4. Step-by-step deployment commands (one command ideally)\n`;
      platformSection += `\nGenerate BOTH the deployable config files AND the setup guide.\n`;
    }

    // Inject deployable config template for the selected platform
    const deployTemplate = getDeployableConfigTemplate(project.idea.monetization);
    if (deployTemplate) {
      platformSection += `\n\nDEPLOYABLE CONFIG TEMPLATE for ${project.idea.monetization}:\n${deployTemplate}\n`;
    }

    // Ask AI to use its latest knowledge to supplement hardcoded platform data
    platformSection += `\nNOTE: The platform guide above is based on kele's built-in knowledge (may be outdated). `;
    platformSection += `Please use your latest training data to verify, correct, and supplement any outdated information `;
    platformSection += `(especially estimated days, required materials, and policy changes).\n`;
  }

  // For setup sub-projects, use a generic web template to avoid misleading the AI
  // into generating platform-specific entry files (e.g. game.json for Douyin)
  // instead of standard project scaffolding (package.json, vite.config.ts, index.html)
  const effectiveTemplateDesc = subProject.type === 'setup'
    ? 'Standard Web Project (package.json + Vite + index.html)'
    : templateDesc;

  const baseContext = `You are a senior software engineer working on the project "${project.name}".

Sub-project: ${subProject.name}
Description: ${subProject.description}
Target directory: ${subProject.targetDir}
Platform template: ${effectiveTemplateDesc}
User's original idea: "${project.idea.rawText}"${platformSection}`;

  if (isCodingTask) {
    const isSetup = subProject.type === 'setup';
    const gameConstraint = !isSetup && project.idea.type === 'game'
      ? '\n4. For game development: the core gameplay loop (rendering + input + game logic) MUST be fully implemented and playable. Do NOT split core mechanics across multiple tasks — one task must produce a runnable game.'
      : '';
    const setupConstraint = isSetup
      ? '\n4. This is a SETUP task — generate ONLY project configuration files (package.json, build config, .gitignore, basic HTML). NO game logic, NO application code, NO src/ directory with implementation files.'
      : '';

    return `${baseContext}\n\nTask: ${task.title}\n${task.description}\n\n${CODE_QUALITY_RULES}\n\nCRITICAL: Return your response as a JSON object in this exact format (no markdown, no explanations outside the JSON):\n{\n  "files": [\n    { "path": "relative/path/to/file", "content": "file content here" }\n  ],\n  "notes": "optional notes about the implementation"\n}\n\nMANDATORY CONSTRAINTS:
1. Every acceptance criterion listed in the task description MUST be fully implemented. If any criterion is missing, the task will be REJECTED.
2. Each file MUST be complete and functional. NO stubs, NO TODOs, NO placeholder code.
3. If the project already has existing files, preserve them and only modify what this specific task requires.${gameConstraint}${setupConstraint}`;
  }

  return `${baseContext}\n\nTask: ${task.title}\n${task.description}\n\nPlease provide clear step-by-step instructions. Return as JSON:\n{\n  "files": [],\n  "notes": "your detailed instructions here"\n}`;
}

/**
 * Execute a single task via the routed AI provider.
 * Supports automatic fallback to mock on failure.
 */
const CODING_TYPES = ['setup', 'development', 'production', 'creation', 'build', 'testing', 'deployment', 'monetization'];

export async function executeTask(
  task: Task,
  subProject: SubProject,
  project: Project,
  options: ExecutorOptions
): Promise<ExecuteResult> {
  const { registry, db, onProgress, signal } = options;
  const isCodingTask = CODING_TYPES.includes(subProject.type);

  // Check abort before starting
  if (signal?.aborted) {
    onProgress?.(`   ⏹️  Task cancelled: ${task.title}`);
    return { success: false, error: 'Execution aborted by user' };
  }

  try {
    // Update status to running
    task.status = 'running';
    db.saveTask(task, project.id);

    onProgress?.(`🔄 [${subProject.name}] ${task.title}`);

    // Route to AI provider
    const route = registry.route(task.complexity);
    task.aiProvider = route.provider;

    onProgress?.(`   🤖 Using ${route.provider}`);

    // For setup tasks, copy generic web scaffold template (not platform-specific)
    if (subProject.type === 'setup') {
      const copied = copyTemplate('web-scaffold', subProject.targetDir);
      if (copied.length > 0) {
        onProgress?.(`   📁 Template copied: ${copied.join(', ')}`);
      }
    }

    // Build prompt and execute
    const prompt = buildPrompt(task, subProject, project);
    debugLog(`Executor Prompt [${subProject.name} / ${task.title}]`, prompt);
    let output: string;

    let firstTokenReceived = false;
    const onToken = (_token: string) => {
      if (!firstTokenReceived) {
        firstTokenReceived = true;
        onProgress?.(`   ✍️  AI 开始生成代码...（请耐心等待，完整代码通常需要 1-5 分钟）`);
      }
      // Token streaming happens silently after the first notification
      // The adapter's parseStream will print completion stats
    };

    try {
      output = await route.adapter.execute(prompt, onToken);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // User-initiated abort — do NOT fallback to mock, just propagate
      if (signal?.aborted) {
        throw err;
      }

      // Log the specific error for debugging
      onProgress?.(`   ⚠️  ${route.provider} error: ${errorMsg.slice(0, 120)}`);

      // Fallback to mock adapter on failure
      const mock = registry.get('mock');
      if (mock && route.provider !== 'mock') {
        onProgress?.(`   🔄 Falling back to mock adapter`);
        task.aiProvider = 'mock';
        output = await mock.execute(prompt);
      } else {
        throw err;
      }
    }

    // Check abort after AI call
    if (signal?.aborted) {
      task.status = 'failed';
      task.error = 'Execution aborted by user';
      db.saveTask(task, project.id);
      onProgress?.(`   ⏹️  Task aborted: ${task.title}`);
      return { success: false, error: 'Execution aborted by user' };
    }

    // Update task as completed
    task.status = 'completed';
    task.result = output;
    db.saveTask(task, project.id);

    // Parse AI output and write files
    let writtenFiles = applyAIOutput(subProject.targetDir, output);
    if (writtenFiles.length > 0 && !(writtenFiles.length === 1 && writtenFiles[0] === 'notes.md')) {
      onProgress?.(`   📝 Written: ${writtenFiles.join(', ')}`);
    } else if (writtenFiles.length === 1 && writtenFiles[0] === 'notes.md') {
      // AI may have nested JSON inside notes.md (markdown code block) — try to extract files from it
      onProgress?.(`   ⚠️  AI 输出只解析到 notes.md，尝试从中二次提取代码文件...`);
      const notesPath = join(subProject.targetDir, 'notes.md');
      if (existsSync(notesPath)) {
        const notesContent = readFileSync(notesPath, 'utf-8');
        const parsedFromNotes = parseAIOutput(notesContent);
        if (parsedFromNotes.files.length > 0) {
          // Write extracted files (clear notes.md first to avoid duplication)
          const extractedFiles = applyAIOutput(subProject.targetDir, notesContent);
          if (extractedFiles.length > 1 || (extractedFiles.length === 1 && extractedFiles[0] !== 'notes.md')) {
            onProgress?.(`   📝 二次提取成功: ${extractedFiles.filter(f => f !== 'notes.md').join(', ')}`);
            writtenFiles = extractedFiles;
          }
        }
      }
      // If still only notes.md, ask AI to reformat
      if (writtenFiles.length === 1 && writtenFiles[0] === 'notes.md' && route.provider !== 'mock') {
        onProgress?.(`   🔄 请求 AI 重新格式化输出...`);
        const reformatPrompt = `Your previous response was saved as notes.md but the file structure could not be extracted. Please return ONLY a JSON object in this exact format (no markdown code blocks, no explanations outside JSON):
{\n  "files": [\n    { "path": "relative/path/to/file", "content": "complete file content here" }\n  ],\n  "notes": "optional implementation notes"\n}`;
        try {
          const reformatOutput = await route.adapter.execute(reformatPrompt, onToken);
          const reformatFiles = applyAIOutput(subProject.targetDir, reformatOutput);
          if (reformatFiles.length > 1 || (reformatFiles.length === 1 && reformatFiles[0] !== 'notes.md')) {
            onProgress?.(`   📝 重新格式化后写入: ${reformatFiles.filter(f => f !== 'notes.md').join(', ')}`);
            writtenFiles = reformatFiles;
            task.result = reformatOutput;
            db.saveTask(task, project.id);
          }
        } catch {
          // Reformat failed — continue with what we have
        }
      }
    } else {
      // AI returned empty or unparseable content — likely a 504/gateway timeout
      onProgress?.(`   ⚠️  AI 返回空内容，可能是服务端超时`);
      const mock = registry.get('mock');
      if (mock && route.provider !== 'mock') {
        onProgress?.(`   🔄 使用 Mock 模式补全内容`);
        const mockOutput = await mock.execute(prompt);
        const mockFiles = applyAIOutput(subProject.targetDir, mockOutput);
        if (mockFiles.length > 0) {
          onProgress?.(`   📝 Mock 补全: ${mockFiles.join(', ')}`);
        }
        task.result = mockOutput;
        task.aiProvider = 'mock';
        db.saveTask(task, project.id);
      }
    }

    // Validate output quality — reject empty/stub code
    onProgress?.(`   🔍 Validating code quality...`);
    const validation = validateTaskOutput(subProject.targetDir, task.title);
    if (!validation.valid) {
      onProgress?.(`   ❌ Validation FAILED (score: ${validation.score}/100)`);
      for (const issue of validation.issues.slice(0, 5)) {
        onProgress?.(`      • ${issue}`);
      }
      task.status = 'failed';
      task.error = `Code validation failed: ${validation.issues.join('; ')}`;
      db.saveTask(task, project.id);
      return { success: false, error: task.error };
    }
    onProgress?.(`   ✅ Validation passed (${validation.score}/100)`);

    // Phase 2.5: Runtime validation — actually run the code to prove it works
    let runtimePassed = true;
    if (isCodingTask && route.provider !== 'mock') {
      onProgress?.(`   🚀 正在本地运行验证...`);
      const runResult = await runProject(subProject.targetDir);
      if (!runResult.success) {
        onProgress?.(`   ❌ 运行失败: ${runResult.stderr.slice(0, 200)}`);
        runtimePassed = false;
        // Auto-fix loop: feed error back to AI, max 2 attempts
        let fixed = false;
        for (let fixAttempt = 1; fixAttempt <= 2; fixAttempt++) {
          onProgress?.(`   🔄 第 ${fixAttempt}/2 次自动修复...`);
          const fixPrompt = buildFixPrompt(task.description, prompt, runResult);
          try {
            const fixOutput = await route.adapter.execute(fixPrompt, onToken);
            const fixWritten = applyAIOutput(subProject.targetDir, fixOutput);
            if (fixWritten.length > 0) {
              onProgress?.(`   📝 修复后写入: ${fixWritten.join(', ')}`);
            }
            task.result = fixOutput;
            db.saveTask(task, project.id);

            // Re-run after fix
            const reRun = await runProject(subProject.targetDir);
            if (reRun.success) {
              onProgress?.(`   ✅ 修复后运行通过`);
              runtimePassed = true;
              fixed = true;
              break;
            }
            onProgress?.(`   ❌ 修复后仍运行失败`);
          } catch (fixErr) {
            const fixErrMsg = fixErr instanceof Error ? fixErr.message : String(fixErr);
            onProgress?.(`   ⚠️  修复请求失败: ${fixErrMsg.slice(0, 120)}`);
          }
        }

        if (!fixed) {
          task.status = 'failed';
          task.error = `Runtime validation failed after 2 fix attempts. ${runResult.stderr.slice(0, 200)}`;
          db.saveTask(task, project.id);
          return { success: false, error: task.error };
        }
      } else {
        onProgress?.(`   ✅ 本地运行验证通过`);
      }
    }


    // Phase 3: Acceptance test — execute incubator-generated criteria
    // If the incubator defined acceptance criteria for this sub-project, kele runs them.
    // This replaces subjective AI review with objective, requirement-grounded verification.
    const validationPassed = validation.valid;
    const hasAcceptanceCriteria = (subProject.acceptanceCriteria?.length || 0) > 0;

    if (hasAcceptanceCriteria) {
      onProgress?.(`   🧪 执行孵化器验收标准 (${subProject.acceptanceCriteria!.length} 项)...`);
      const acceptance = runAcceptanceCriteria(subProject);

      if (acceptance.passed) {
        onProgress?.(`   ✅ 验收通过 (评分: ${acceptance.score}/100)`);
        if (acceptance.results.length > 0) {
          for (const r of acceptance.results) {
            const icon = r.passed ? '✓' : '○';
            onProgress?.(`      ${icon} ${r.criterion.description}`);
          }
        }
      } else {
        onProgress?.(`   ❌ 验收未通过 (评分: ${acceptance.score}/100)`);
        const failed = acceptance.results.filter(r => !r.passed);
        for (const r of failed) {
          onProgress?.(`      ✗ ${r.criterion.description} — ${r.actual}`);
        }

        // Retry loop: feed specific criterion failures back to AI
        const maxRetries = 2;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          onProgress?.(`   🔄 第 ${attempt}/${maxRetries} 次修复...`);

          const fixPrompt = buildPrompt(task, subProject, project) + `\n\n` +
            `⚠️ ACCEPTANCE TEST FAILED. The incubator defined these criteria that your output did not meet:\n\n` +
            failed.map((r) => `- ${r.criterion.description}\n  Expected: ${r.criterion.expected}\n  Actual: ${r.actual}`).join('\n\n') + `\n\n` +
            `Please fix ALL failures and return the COMPLETE corrected output.`;

          try {
            const retryOutput = await route.adapter.execute(fixPrompt, onToken);
            const retryWritten = applyAIOutput(subProject.targetDir, retryOutput);
            if (retryWritten.length > 0) {
              onProgress?.(`   📝 修复后写入: ${retryWritten.join(', ')}`);
            }
            task.result = retryOutput;
            db.saveTask(task, project.id);

            // Re-run acceptance after fix
            const reAcceptance = runAcceptanceCriteria(subProject);
            if (reAcceptance.passed) {
              onProgress?.(`   ✅ 修复后验收通过 (评分: ${reAcceptance.score}/100)`);
              break;
            } else {
              onProgress?.(`   ⚠️  修复后仍未通过 (评分: ${reAcceptance.score}/100)`);
              if (attempt >= maxRetries) {
                // Smart degradation: if validation + runtime passed, accept as WARNING
                if (validationPassed && runtimePassed) {
                  onProgress?.(`   ⚠️  修复用尽但代码可运行，接受为警告继续执行`);
                  task.status = 'completed';
                  task.error = `Acceptance test warning (score: ${reAcceptance.score}/100). Failed: ${failed.map(f => f.criterion.description).join('; ')}`;
                  db.saveTask(task, project.id);
                  break;
                }
                task.status = 'failed';
                task.error = `Acceptance test failed after ${maxRetries} fix attempts.`;
                db.saveTask(task, project.id);
                return { success: false, error: task.error };
              }
            }
          } catch (retryErr) {
            const retryError = retryErr instanceof Error ? retryErr.message : String(retryErr);
            onProgress?.(`   ❌ 修复请求失败: ${retryError.slice(0, 120)}`);
            if (attempt >= maxRetries) {
              if (validationPassed && runtimePassed) {
                onProgress?.(`   ⚠️  修复请求失败但代码可运行，接受为警告继续执行`);
                task.status = 'completed';
                task.error = `Acceptance test warning. Retry failed: ${retryError}`;
                db.saveTask(task, project.id);
                break;
              }
              task.status = 'failed';
              task.error = `Fix attempt failed: ${retryError}`;
              db.saveTask(task, project.id);
              return { success: false, error: task.error };
            }
          }
        }
      }
    } else if (isCodingTask && route.provider !== 'mock') {
      // Fallback to AI review if no acceptance criteria defined (legacy path)
      onProgress?.(`   🔍 AI 正在验收任务产出...`);
      let review = await reviewTaskOutput(task, subProject, project, route.adapter);

      if (review.verdict === 'PASS' || review.score >= 6) {
        onProgress?.(`   ✅ 验收通过 (评分: ${review.score}/10)`);
      } else {
        // Only FAIL (score < 6) triggers fix loop. PARTIAL with score >= 6 is acceptable.
        onProgress?.(`   ❌ 验收未通过 (评分: ${review.score}/10)`);
        onProgress?.(`   问题: ${review.issues.join('; ')}`);

        // Retry loop: up to 2 attempts for FAIL
        const maxRetries = 2;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          onProgress?.(`   🔄 第 ${attempt}/${maxRetries} 次修复...`);

          const fixPrompt = buildPrompt(task, subProject, project) + `\n\n` +
            `⚠️ PREVIOUS ATTEMPT FAILED QUALITY REVIEW (FAIL).\n\n` +
            `Issues found:\n${review.issues.map((i) => `- ${i}`).join('\n')}\n\n` +
            `Fix instructions:\n${review.fixInstructions}\n\n` +
            `Please fix ALL issues and return the COMPLETE corrected output. Do NOT return partial fixes.`;

          try {
            const retryOutput = await route.adapter.execute(fixPrompt, onToken);
            const retryWritten = applyAIOutput(subProject.targetDir, retryOutput);
            if (retryWritten.length > 0) {
              onProgress?.(`   📝 修复后写入: ${retryWritten.join(', ')}`);
            }
            task.result = retryOutput;
            db.saveTask(task, project.id);

            // Re-run validation after fix
            const reValidation = validateTaskOutput(subProject.targetDir, task.title);
            if (!reValidation.valid) {
              onProgress?.(`   ❌ 修复后静态检查仍失败 (score: ${reValidation.score})`);
            }

            // Re-review after fix
            review = await reviewTaskOutput(task, subProject, project, route.adapter);
            if (review.verdict === 'PASS' || review.score >= 6) {
              onProgress?.(`   ✅ 修复后验收通过 (评分: ${review.score}/10)`);
              break;
            } else {
              onProgress?.(`   ⚠️  修复后仍未通过 (评分: ${review.score}/10)`);
              if (attempt >= maxRetries) {
                // Smart degradation: if validation + runtime passed and review score >= 5, accept as WARNING
                if (validationPassed && runtimePassed && review.score >= 5) {
                  onProgress?.(`   ⚠️  修复用尽但代码可运行，接受为警告继续执行`);
                  task.status = 'completed';
                  task.error = `Quality review warning (score: ${review.score}/10). Issues: ${review.issues.join('; ')}`;
                  db.saveTask(task, project.id);
                  break; // Exit fix loop, continue execution
                }
                task.status = 'failed';
                task.error = `Task failed quality review after ${maxRetries} fix attempts. Issues: ${review.issues.join('; ')}`;
                db.saveTask(task, project.id);
                return { success: false, error: task.error };
              }
            }
          } catch (retryErr) {
            const retryError = retryErr instanceof Error ? retryErr.message : String(retryErr);
            onProgress?.(`   ❌ 修复请求失败: ${retryError.slice(0, 120)}`);
            if (attempt >= maxRetries) {
              // Smart degradation on retry failure too
              if (validationPassed && runtimePassed && review.score >= 5) {
                onProgress?.(`   ⚠️  修复请求失败但代码可运行，接受为警告继续执行`);
                task.status = 'completed';
                task.error = `Quality review warning (score: ${review.score}/10). Retry failed: ${retryError}`;
                db.saveTask(task, project.id);
                break;
              }
              task.status = 'failed';
              task.error = `Fix attempt failed: ${retryError}`;
              db.saveTask(task, project.id);
              return { success: false, error: task.error };
            }
          }
        }
      }
    }

    onProgress?.(`   ✅ Completed`);

    return { success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    task.status = 'failed';
    task.error = error;
    db.saveTask(task, project.id);

    onProgress?.(`   ❌ Failed: ${error.slice(0, 200)}`);

    return { success: false, error };
  }
}

/**
 * Execute all pending tasks in a project.
 */
export async function executeProject(
  project: Project,
  options: ExecutorOptions
): Promise<{ completed: number; failed: number; aborted: boolean }> {
  const { db, onProgress, signal } = options;

  // Save project state
  db.saveProject(project);
  for (const sp of project.subProjects) {
    db.saveSubProject(sp, project.id);
  }
  for (const task of project.tasks) {
    db.saveTask(task, project.id);
  }

  onProgress?.(`🚀 Starting execution: ${project.name}`);

  // Sort sub-projects topologically
  const sortedSPs = sortSubProjects(project.subProjects);
  let completed = 0;
  let failed = 0;

  for (const sp of sortedSPs) {
    // Check abort before each sub-project
    if (signal?.aborted) {
      onProgress?.(`\n⏹️  Execution aborted by user`);
      return { completed, failed, aborted: true };
    }

    onProgress?.(`\n📦 Sub-project: ${sp.name}`);

    const spTasks = project.tasks.filter((t) => t.subProjectId === sp.id && t.status === 'pending');

    for (const task of spTasks) {
      const result = await executeTask(task, sp, project, options);

      if (result.success) {
        completed++;
      } else if (result.error === 'Execution aborted by user') {
        onProgress?.(`\n⏹️  Execution aborted by user`);
        return { completed, failed, aborted: true };
      } else {
        failed++;
        // Sub-project tasks are sequential — if one fails, subsequent tasks
        // cannot succeed because they depend on the previous output.
        onProgress?.(`   ❌ 任务失败，停止当前子项目后续任务`);
        sp.status = 'failed';
        db.saveSubProject(sp, project.id);
        // Critical sub-project failure = project cannot succeed
        // Setup is excluded because template files are already copied; AI failures here are recoverable.
        const isCritical = ['development', 'production', 'creation'].includes(sp.type);
        if (isCritical) {
          onProgress?.(`\n❌ 核心子项目「${sp.name}」失败，项目无法继续。停止执行。`);
          return { completed, failed, aborted: false };
        }
        break; // Non-critical sub-project failed — stop this SP but continue project
      }
    }

    // If sub-project completed successfully
    if (sp.status !== 'failed') {
      sp.status = 'completed';
      db.saveSubProject(sp, project.id);
    }

    // Phase 4: Global progress supervision — review health after each sub-project
    const shouldReview =
      project.idea.complexity === 'complex' ||
      failed > 0 ||
      project.subProjects.filter((s) => s.status === 'completed').length >= 2;

    if (shouldReview && options.registry) {
      try {
        const route = options.registry.route('medium');
        onProgress?.(`\n   🔍 项目总监正在评估整体进度...`);
        const health = await reviewProjectHealth(project, route.adapter);

        if (health.healthy) {
          onProgress?.(`   ✅ 项目健康度良好 (${health.progress})`);
        } else {
          onProgress?.(`   ⚠️ 项目健康度异常 (${health.progress})`);
        }

        if (health.concerns.length > 0) {
          onProgress?.(`   关注项:`);
          for (const concern of health.concerns.slice(0, 3)) {
            onProgress?.(`      • ${concern}`);
          }
        }

        if (health.recommendations.length > 0) {
          onProgress?.(`   建议:`);
          for (const rec of health.recommendations.slice(0, 3)) {
            onProgress?.(`      → ${rec}`);
          }
        }

        if (health.scopeAdjustment) {
          onProgress?.(`   范围调整: ${health.scopeAdjustment}`);
        }
      } catch {
        // Health review is advisory — don't block execution on failure
      }
    }
  }

  onProgress?.(`\n🏁 Execution complete: ${completed} completed, ${failed} failed`);

  return { completed, failed, aborted: false };
}
