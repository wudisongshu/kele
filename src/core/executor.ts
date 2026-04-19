import type { Project, Task, SubProject, ExecuteResult } from '../types/index.js';
import type { ProviderRegistry } from '../adapters/index.js';
import type { KeleDatabase } from '../db/index.js';

/**
 * Executor — schedules and runs tasks in dependency order.
 *
 * Features:
 * - Topological sorting of sub-projects by dependencies
 * - Per-task AI provider routing via ProviderRegistry
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
 * Build a prompt for a specific task.
 */
function buildPrompt(task: Task, subProject: SubProject, project: Project): string {
  return `You are a senior software engineer working on the project "${project.name}".

Sub-project: ${subProject.name}
Description: ${subProject.description}
Target directory: ${subProject.targetDir}

Task: ${task.title}
${task.description}

User's original idea: "${project.idea.rawText}"

Please provide a complete implementation. If generating code, return it as a JSON object with a "files" array containing {path, content} objects.
If the task is non-coding (configuration, submission, etc.), provide clear step-by-step instructions.`;
}

/**
 * Execute a single task via the routed AI provider.
 */
export async function executeTask(
  task: Task,
  subProject: SubProject,
  project: Project,
  options: ExecutorOptions
): Promise<ExecuteResult> {
  const { registry, db, onProgress } = options;

  try {
    // Update status to running
    task.status = 'running';
    db.saveTask(task, project.id);

    onProgress?.(`🔄 [${subProject.name}] ${task.title}`);

    // Route to AI provider
    const route = registry.route(task.complexity);
    task.aiProvider = route.provider;

    onProgress?.(`   🤖 Using ${route.provider}`);

    // Build prompt and execute
    const prompt = buildPrompt(task, subProject, project);
    const output = await route.adapter.execute(prompt);

    // Update task as completed
    task.status = 'completed';
    task.result = output;
    db.saveTask(task, project.id);

    onProgress?.(`   ✅ Completed`);

    return { success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    task.status = 'failed';
    task.error = error;
    db.saveTask(task, project.id);

    onProgress?.(`   ❌ Failed: ${error}`);

    return { success: false, error };
  }
}

/**
 * Execute all pending tasks in a project.
 */
export async function executeProject(
  project: Project,
  options: ExecutorOptions
): Promise<{ completed: number; failed: number }> {
  const { db, onProgress } = options;

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
    onProgress?.(`\n📦 Sub-project: ${sp.name}`);

    const spTasks = project.tasks.filter((t) => t.subProjectId === sp.id && t.status === 'pending');

    for (const task of spTasks) {
      const result = await executeTask(task, sp, project, options);

      if (result.success) {
        completed++;
      } else {
        failed++;
        // For MVP, continue on failure. In production, might want to stop.
        onProgress?.(`   ⚠️  Continuing despite failure...`);
      }
    }

    // Update sub-project status
    sp.status = failed > 0 ? 'failed' : 'completed';
    db.saveSubProject(sp, project.id);
  }

  onProgress?.(`\n🏁 Execution complete: ${completed} completed, ${failed} failed`);

  return { completed, failed };
}
