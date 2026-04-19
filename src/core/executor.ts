import type { Project, Task, SubProject, ExecuteResult } from '../types/index.js';
import type { ProviderRegistry } from '../adapters/index.js';
import type { KeleDatabase } from '../db/index.js';
import { applyAIOutput } from './file-writer.js';
import { copyTemplate, getTemplateType, getTemplateDescription } from './template-loader.js';

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
1. Modularity: Each file has ONE clear responsibility. No god files.
2. Naming: Use descriptive names (isValidEmail, not check). No abbreviations.
3. Types: Use strict typing (TypeScript/JSDoc). No 'any' types.
4. Error handling: Validate inputs, handle edge cases, fail gracefully.
5. Comments: Explain WHY, not WHAT. Complex logic gets inline comments.
6. No bloat: No speculative abstractions. If 200 lines could be 50, rewrite.
7. Consistency: Match existing code style in the project.
8. No hardcoded secrets: Use config/env for API keys, URLs, etc.`;

/**
 * Build a prompt for a specific task.
 */
function buildPrompt(task: Task, subProject: SubProject, project: Project): string {
  const templateType = getTemplateType(project.idea.monetization);
  const templateDesc = getTemplateDescription(templateType);
  const isCodingTask = ['setup', 'development', 'production', 'creation', 'build'].includes(subProject.type);

  const baseContext = `You are a senior software engineer working on the project "${project.name}".

Sub-project: ${subProject.name}
Description: ${subProject.description}
Target directory: ${subProject.targetDir}
Platform template: ${templateDesc}
User's original idea: "${project.idea.rawText}"`;

  if (isCodingTask) {
    return `${baseContext}

Task: ${task.title}
${task.description}

${CODE_QUALITY_RULES}

CRITICAL: Return your response as a JSON object in this exact format (no markdown, no explanations outside the JSON):
{
  "files": [
    { "path": "relative/path/to/file", "content": "file content here" }
  ],
  "notes": "optional notes about the implementation"
}`;
  }

  return `${baseContext}

Task: ${task.title}
${task.description}

Please provide clear step-by-step instructions. Return as JSON:
{
  "files": [],
  "notes": "your detailed instructions here"
}`;
}

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

    // For setup tasks, copy template first
    if (subProject.type === 'setup') {
      const templateType = getTemplateType(project.idea.monetization);
      const copied = copyTemplate(templateType, subProject.targetDir);
      if (copied.length > 0) {
        onProgress?.(`   📁 Template copied: ${copied.join(', ')}`);
      }
    }

    // Build prompt and execute
    const prompt = buildPrompt(task, subProject, project);
    let output: string;

    try {
      output = await route.adapter.execute(prompt);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

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

    // Update task as completed
    task.status = 'completed';
    task.result = output;
    db.saveTask(task, project.id);

    // Parse AI output and write files
    const writtenFiles = applyAIOutput(subProject.targetDir, output);
    if (writtenFiles.length > 0) {
      onProgress?.(`   📝 Written: ${writtenFiles.join(', ')}`);
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
        // Continue on failure for resilience, but warn user
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
