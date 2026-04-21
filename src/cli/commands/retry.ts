/**
 * kele retry — retry a failed task without re-running the entire project.
 */

import { Command } from 'commander';
import { executeProject } from '../../core/project-executor.js';
import { createRegistryFromConfig } from '../../adapters/index.js';
import { parseTimeout } from '../utils.js';
import type { AIProvider } from '../../types/index.js';
import { KeleDatabase } from '../../db/index.js';

export function setupRetryCommand(program: Command): void {
  program
    .command('retry')
    .argument('<project-id>', 'Project ID')
    .argument('[task-id]', 'Task ID to retry (omit with --all to retry all failed tasks)')
    .description('Retry a failed task without re-running the entire project')
    .option('-t, --timeout <seconds>', 'AI request timeout (kept for compatibility, no effect)', parseTimeout)
    .option('--mock', 'Force mock AI mode for fast testing', false)
    .option('--all', 'Retry all failed tasks in the project', false)
    .option('--force', 'Retry even if task is not in failed status', false)
    .action(async (projectId: string, taskId: string | undefined, options: { timeout?: number; mock: boolean; all: boolean; force: boolean }) => {
      const db = new KeleDatabase();
      const project = db.getProject(projectId);

      if (!project) {
        console.error(`❌ 项目不存在: ${projectId}`);
        process.exit(1);
      }

      const tasks = db.getTasks(projectId);
      const subProjects = db.getSubProjects(projectId);

      let tasksToRetry: typeof tasks;

      if (options.all) {
        tasksToRetry = tasks.filter((t) => t.status === 'failed');
        if (tasksToRetry.length === 0) {
          console.log('✅ 没有失败的任务需要重试。');
          return;
        }
        console.log(`🔄 批量重试 ${tasksToRetry.length} 个失败任务...\n`);
      } else {
        if (!taskId) {
          console.error('❌ 请提供 task-id 或使用 --all 重试所有失败任务');
          process.exit(1);
        }
        const task = tasks.find((t) => t.id === taskId);
        if (!task) {
          console.error(`❌ 任务不存在: ${taskId}`);
          console.log('   用 kele show <project-id> 查看所有任务');
          process.exit(1);
        }
        if (task.status !== 'failed' && !options.force) {
          console.log(`⚠️  任务状态为 ${task.status}，不是失败状态。只有失败的任务才能 retry。使用 --force 强制重试。`);
          process.exit(1);
        }
        tasksToRetry = [task];
        const subProject = subProjects.find((sp) => sp.id === task.subProjectId);
        console.log(`🔄 重试任务: ${task.title}`);
        console.log(`   项目: ${project.name}`);
        console.log(`   子项目: ${subProject?.name ?? 'unknown'}`);
        console.log();
      }

      // Reset all failed tasks to pending
      for (const task of tasksToRetry) {
        task.status = 'pending';
        db.saveTask(task, projectId);
      }

      const fullProject = {
        ...project,
        subProjects,
        tasks,
      };

      const registry = createRegistryFromConfig();
      if (options.mock) {
        const mockAdapter = registry.get('mock')!;
        registry.route = () => ({ provider: 'mock' as AIProvider, adapter: mockAdapter });
      }

      const result = await executeProject(fullProject, {
        registry,
        db,
        onProgress: (msg) => console.log(msg),
        timeout: options.timeout,
      });

      if (result.failed === 0 && !result.aborted) {
        console.log(`\n✅ 重试完成！${result.completed} 个任务成功完成。`);
      } else if (result.aborted) {
        console.log(`\n⏹️  重试被中断。已完成 ${result.completed} 个任务。`);
      } else {
        console.log(`\n❌ 重试完成，但有 ${result.failed} 个任务失败。`);
        process.exit(1);
      }
    });
}
