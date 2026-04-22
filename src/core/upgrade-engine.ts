import { randomUUID } from 'crypto';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { Task, Project, SubProject, ExecuteResult } from '../types/index.js';
import type { ProviderRegistry } from '../adapters/index.js';
import type { KeleDatabase } from '../db/index.js';
import { applyAIOutput } from './file-writer.js';
import { executeWithFallback } from './adapter-utils.js';
import { validateTaskOutput } from './task-validator.js';
import { validateGameInBrowser } from './game-validator-browser.js';
import { debugLog } from '../debug.js';

/**
 * UpgradeEngine — enables iterative improvement of existing tasks.
 *
 * User workflow:
 * 1. kele generates a project (e.g. a game)
 * 2. User says "change the art style to pixel" or "add multiplayer"
 * 3. UpgradeEngine reads the existing code, builds an upgrade prompt,
 *    executes AI, and writes the updated files.
 */

export interface UpgradeOptions {
  registry: ProviderRegistry;
  db: KeleDatabase;
  onProgress?: (message: string) => void;
  timeout?: number;
}

/**
 * Build an upgrade prompt that includes the existing code context.
 */
function readFilesFromDir(dir: string, maxSize = 50000): string {
  if (!existsSync(dir)) return '';
  let result = '';
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const path = join(dir, entry.name);
    try {
      const content = readFileSync(path, 'utf-8');
      if (content.length > maxSize) {
        result += `\n--- ${entry.name} (truncated, ${content.length} chars) ---\n${content.slice(0, maxSize)}\n... [truncated]\n`;
      } else {
        result += `\n--- ${entry.name} ---\n${content}\n`;
      }
    } catch {
      // Skip unreadable files
    }
  }
  return result;
}

function buildUpgradePrompt(
  task: Task,
  subProject: SubProject,
  project: Project,
  upgradeRequest: string
): string {
  // Read actual files from disk (diff-aware: captures user manual edits too)
  const diskFiles = readFilesFromDir(subProject.targetDir);
  const previousCode = diskFiles
    ? `## Current Implementation (from filesystem)\n\nHere is the ACTUAL current code in ${subProject.targetDir}:\n\n${diskFiles.slice(0, 15000)}`
    : task.result
      ? `## Previous Implementation (from database)\n\n${task.result.slice(0, 12000)}`
      : '## Previous Implementation\n\nNo previous code available — this is a new implementation.';

  return `You are a senior software engineer working on the project "${project.name}".

Sub-project: ${subProject.name}
Description: ${subProject.description}
Target directory: ${subProject.targetDir}
User's original idea: "${project.idea.rawText}"

Task: ${task.title}
${task.description}

${previousCode}

---

## UPGRADE REQUEST

The user wants to improve this task. Here is their specific request:

"${upgradeRequest}"

Please update the implementation to satisfy this request. Preserve all existing functionality that the user did NOT ask to change. Only modify what is necessary.

CODE QUALITY REQUIREMENTS:
1. Modularity: Each file has ONE clear responsibility.
2. Naming: Use descriptive names. No abbreviations.
3. Types: Use strict typing. No 'any' types.
4. Error handling: Validate inputs, handle edge cases.
5. Comments: Explain WHY, not WHAT.
6. No bloat: No speculative abstractions.

CRITICAL: Return your response as a JSON object:
{
  "files": [
    { "path": "relative/path/to/file", "content": "file content here" }
  ],
  "notes": "optional notes about what changed and why"
}`;
}

/**
 * Upgrade a specific task based on user feedback.
 *
 * @returns The new task with updated code
 */
export async function upgradeTask(
  originalTask: Task,
  subProject: SubProject,
  project: Project,
  upgradeRequest: string,
  options: UpgradeOptions
): Promise<ExecuteResult> {
  const { registry, db, onProgress } = options;

  try {
    onProgress?.(`🔄 Upgrading [${subProject.name}] ${originalTask.title}`);
    onProgress?.(`   📝 Request: ${upgradeRequest}`);

    // Create new task as a child of the original
    const newTask: Task = {
      id: randomUUID(),
      subProjectId: subProject.id,
      title: `${originalTask.title} (v${originalTask.version + 1})`,
      description: `${originalTask.description}\n\nUpgrade: ${upgradeRequest}`,
      complexity: originalTask.complexity,
      status: 'running',
      parentTaskId: originalTask.id,
      version: originalTask.version + 1,
      createdAt: new Date().toISOString(),
    };

    db.saveTask(newTask, project.id);

    // Route to AI provider
    const route = registry.route(originalTask.complexity);
    newTask.aiProvider = route.provider;
    onProgress?.(`   🤖 Using ${route.provider}`);

    const prompt = buildUpgradePrompt(originalTask, subProject, project, upgradeRequest);
    debugLog(`Upgrade Prompt [${subProject.name} / ${originalTask.title}]`, prompt);

    const aiResult = await executeWithFallback(registry, prompt, route.provider, route.adapter, undefined, onProgress);
    const output = aiResult.output;
    if (aiResult.provider === 'mock') {
      newTask.aiProvider = 'mock';
    }

    // Write updated files
    const writtenFiles = applyAIOutput(subProject.targetDir, output);
    if (writtenFiles.length > 0) {
      onProgress?.(`   📝 Updated: ${writtenFiles.join(', ')}`);
    }

    // Validate upgraded code
    onProgress?.(`   🔍 Validating upgraded code...`);
    const validation = validateTaskOutput(subProject.targetDir, newTask.title);
    if (!validation.valid) {
      onProgress?.(`   ⚠️  Code quality issues: ${validation.issues.slice(0, 3).join('; ')}`);
    }

    // For games, run browser validation
    if (project.idea.type === 'game') {
      const browser = await validateGameInBrowser(subProject.targetDir);
      if (browser.playable) {
        onProgress?.(`   ✅ Game playable (Score: ${browser.score}/100)`);
      } else {
        onProgress?.(`   ⚠️  Game validation: ${browser.score}/100 — ${browser.errors.join('; ')}`);
      }
    }

    // Mark original as superseded and new as completed
    originalTask.status = 'skipped';
    db.saveTask(originalTask, project.id);

    newTask.status = 'completed';
    newTask.result = output;
    db.saveTask(newTask, project.id);

    onProgress?.(`   ✅ Upgrade complete (v${newTask.version})`);

    return { success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    onProgress?.(`   ❌ Upgrade failed: ${error.slice(0, 200)}`);
    return { success: false, error };
  }
}

/**
 * Batch upgrade multiple tasks with the same request.
 * Useful for applying a global change (e.g., "change all colors to dark mode").
 */
export async function batchUpgrade(
  tasks: Task[],
  subProjects: SubProject[],
  project: Project,
  upgradeRequest: string,
  options: UpgradeOptions
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const task of tasks) {
    const sp = subProjects.find((s) => s.id === task.subProjectId);
    if (!sp) {
      failed++;
      continue;
    }

    const result = await upgradeTask(task, sp, project, upgradeRequest, options);
    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}
