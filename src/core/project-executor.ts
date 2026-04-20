import type { Project } from '../types/index.js';
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
 * Execute all pending tasks in a project, topologically sorted by dependencies.
 * Includes global health review after each sub-project.
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
  let completed = 0;
  let failed = 0;

  for (const sp of sortedSPs) {
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
        onProgress?.(`   ❌ 任务失败，停止当前子项目后续任务`);
        sp.status = 'failed';
        db.saveSubProject(sp, project.id);
        const isCritical = ['development', 'production', 'creation'].includes(sp.type);
        if (isCritical) {
          onProgress?.(`\n❌ 核心子项目「${sp.name}」失败，项目无法继续。停止执行。`);
          return { completed, failed, aborted: false };
        }
        break;
      }
    }

    if (sp.status !== 'failed') {
      sp.status = 'completed';
      db.saveSubProject(sp, project.id);
    }

    // Global progress supervision — review health after each sub-project
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
