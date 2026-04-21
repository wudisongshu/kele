/**
 * kele upgrade — upgrade an existing task with new requirements.
 */

import { Command } from 'commander';
import { upgradeTask } from '../../core/upgrade-engine.js';
import { createRegistryFromConfig } from '../../adapters/index.js';
import { printNoProviderHelp, parseTimeout } from '../utils.js';
import { hasAnyProvider } from '../../config/index.js';
import type { AIProvider } from '../../types/index.js';
import { KeleDatabase } from '../../db/index.js';

export function setupUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .argument('<project-id>', 'Project ID')
    .argument('<task-id>', 'Task ID to upgrade')
    .argument('<request>', 'Upgrade request, e.g. "change art to pixel style"')
    .description('Upgrade an existing task with new requirements')
    .option('-t, --timeout <seconds>', 'AI request timeout (kept for compatibility, no effect)', parseTimeout)
    .option('--mock', 'Force mock AI mode for fast testing', false)
    .option('--debug', 'Show all prompts sent to AI for debugging', false)
    .action(async (projectId: string, taskId: string, request: string, options: { timeout?: number; debug: boolean; mock: boolean }) => {
      if (options.debug) {
        const { setDebug } = await import('../../debug.js');
        setDebug(true);
        console.log('🔍 Debug mode enabled — all AI prompts will be logged\n');
      }
      if (!hasAnyProvider()) {
        printNoProviderHelp();
        return;
      }
      if (!hasAnyProvider()) {
        printNoProviderHelp();
        return;
      }

      const db = new KeleDatabase();
      const project = db.getProject(projectId);

      if (!project) {
        console.error(`❌ 项目不存在: ${projectId}`);
        process.exit(1);
      }

      const tasks = db.getTasks(projectId);
      const originalTask = tasks.find((t) => t.id === taskId);

      if (!originalTask) {
        console.error(`❌ 任务不存在: ${taskId}`);
        console.log('   用 kele show <project-id> 查看所有任务');
        process.exit(1);
      }

      const subProjects = db.getSubProjects(projectId);
      const subProject = subProjects.find((sp) => sp.id === originalTask.subProjectId);

      if (!subProject) {
        console.error(`❌ 子项目不存在`);
        process.exit(1);
      }

      // Load full project with sub-projects
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

      const result = await upgradeTask(originalTask, subProject, fullProject, request, {
        registry,
        db,
        onProgress: (msg: string) => console.log(msg),
        timeout: options.timeout,
      });

      if (result.success) {
        console.log(`\n✨ 升级完成！`);
        console.log(`   项目目录: ${subProject.targetDir}`);
      } else {
        console.log(`\n❌ 升级失败: ${result.error}`);
        process.exit(1);
      }
    });
}
