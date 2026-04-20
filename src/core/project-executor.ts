import type { Project, SubProject } from '../types/index.js';
import type { ProviderRegistry } from '../adapters/index.js';
import type { KeleDatabase } from '../db/index.js';
import { sortSubProjects, executeTask } from './executor.js';
import { reviewProjectHealth } from './project-reviewer.js';

export interface ProjectExecutorOptions {
  registry: ProviderRegistry;
  db: KeleDatabase;
  autoRun?: boolean;
  onProgress?: (message: string) => void;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Group sub-projects by dependency level.
 * Level 0 = no dependencies, Level 1 = depends on level 0, etc.
 */
function groupByDependencyLevel(sortedSPs: SubProject[]): SubProject[][] {
  const levels = new Map<string, number>();

  for (const sp of sortedSPs) {
    if (sp.dependencies.length === 0) {
      levels.set(sp.id, 0);
    } else {
      const maxDepLevel = Math.max(
        ...sp.dependencies.map((depId) => levels.get(depId) ?? 0)
      );
      levels.set(sp.id, maxDepLevel + 1);
    }
  }

  const maxLevel = Math.max(...levels.values(), 0);
  const batches: SubProject[][] = [];
  for (let i = 0; i <= maxLevel; i++) {
    const batch = sortedSPs.filter((sp) => levels.get(sp.id) === i);
    if (batch.length > 0) batches.push(batch);
  }
  return batches;
}

/**
 * Execute a single sub-project's pending tasks.
 */
async function executeSubProject(
  sp: SubProject,
  project: Project,
  options: ProjectExecutorOptions
): Promise<{ success: boolean; tasksCompleted: number; tasksFailed: number; aborted: boolean }> {
  const { db, onProgress, signal } = options;

  onProgress?.(`\n📦 Sub-project: ${sp.name}`);

  const spTasks = project.tasks.filter((t) => t.subProjectId === sp.id && t.status === 'pending');
  let tasksCompleted = 0;
  let tasksFailed = 0;

  for (const task of spTasks) {
    if (signal?.aborted) {
      return { success: false, tasksCompleted, tasksFailed, aborted: true };
    }

    const result = await executeTask(task, sp, project, options);

    if (result.success) {
      tasksCompleted++;
    } else if (result.error === 'Execution aborted by user') {
      return { success: false, tasksCompleted, tasksFailed, aborted: true };
    } else {
      tasksFailed++;
      onProgress?.(`   ❌ 任务失败，停止当前子项目后续任务`);
      sp.status = 'failed';
      db.saveSubProject(sp, project.id);
      break;
    }
  }

  if (sp.status !== 'failed') {
    sp.status = 'completed';
    db.saveSubProject(sp, project.id);
  }

  return { success: tasksFailed === 0, tasksCompleted, tasksFailed, aborted: false };
}

/**
 * Execute all pending tasks in a project, topologically sorted by dependencies.
 * Independent sub-projects at the same dependency level run concurrently.
 * Includes global health review after each batch.
 */
export async function executeProject(
  project: Project,
  options: ProjectExecutorOptions
): Promise<{ completed: number; failed: number; aborted: boolean }> {
  const { db, onProgress, signal, registry } = options;

  // Save project state
  db.saveProject(project);
  for (const sp of project.subProjects) {
    db.saveSubProject(sp, project.id);
  }
  for (const task of project.tasks) {
    db.saveTask(task, project.id);
  }

  onProgress?.(`🚀 Starting execution: ${project.name}`);

  const sortedSPs = sortSubProjects(project.subProjects);
  const batches = groupByDependencyLevel(sortedSPs);
  let completed = 0;
  let failed = 0;

  for (const batch of batches) {
    if (signal?.aborted) {
      onProgress?.(`\n⏹️  Execution aborted by user`);
      return { completed, failed, aborted: true };
    }

    // Execute sub-projects in this batch concurrently
    const batchSize = batch.length;
    if (batchSize > 1) {
      onProgress?.(`\n📦 并行执行 ${batchSize} 个子项目...`);
    }

    const results = await Promise.all(
      batch.map((sp) => executeSubProject(sp, project, options))
    );

    for (const result of results) {
      completed += result.tasksCompleted;
      failed += result.tasksFailed;

      if (result.aborted) {
        onProgress?.(`\n⏹️  Execution aborted by user`);
        return { completed, failed, aborted: true };
      }

      if (!result.success) {
        const failedSp = batch.find((sp) => sp.status === 'failed');
        if (failedSp) {
          const isCritical = ['development', 'production', 'creation'].includes(failedSp.type);
          if (isCritical) {
            onProgress?.(`\n❌ 核心子项目「${failedSp.name}」失败，项目无法继续。停止执行。`);
            return { completed, failed, aborted: false };
          }
        }
      }
    }

    // Global progress supervision — review health after each batch
    const shouldReview =
      project.idea.complexity === 'complex' ||
      failed > 0 ||
      project.subProjects.filter((s) => s.status === 'completed').length >= 2;

    if (shouldReview && registry) {
      try {
        const route = registry.route('medium');
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
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        onProgress?.(`   ⚠️ 健康检查失败: ${error.slice(0, 100)}`);
      }
    }
  }

  onProgress?.(`\n🏁 Execution complete: ${completed} completed, ${failed} failed`);
  return { completed, failed, aborted: false };
}
