/**
 * kele optimize — post-deploy data-driven optimization loop.
 *
 * Collects metrics from deployed projects, analyzes them against thresholds,
 * generates optimization tasks, and optionally executes them.
 */

import { Command } from 'commander';
import { KeleDatabase } from '../../db/index.js';
import type { Project } from '../../types/index.js';
import {
  collectAllMetrics,
  loadPreviousMetrics,
  calculateTrend,
  saveMetricsHistory,
  formatWeeklyReport,
  type MetricsHistory,
} from '../../core/data-collector.js';
import {
  buildOptimizationPlan,
  formatOptimizationPlan,
  tasksToExecutableTasks,
} from '../../core/optimization-engine.js';
import { createRegistryFromConfig } from '../../adapters/index.js';
import { executeProject } from '../../core/project-executor.js';
import { confirmCheckpoint } from '../utils.js';

export function setupOptimizeCommand(program: Command): void {
  program
    .command('optimize')
    .argument('<project-id>', 'Project ID to optimize')
    .description('Analyze deployed project metrics and generate optimization tasks')
    .option('--mock', 'Use mock data instead of reading real metrics files', false)
    .option('--auto', 'Auto-execute optimization tasks without confirmation', false)
    .option('--report', 'Only print report, do not generate or execute tasks', false)
    .option('--dry-run', 'Show what would be optimized without making changes', false)
    .action(async (projectId: string, options: { mock: boolean; auto: boolean; report: boolean; dryRun: boolean }) => {
      const db = new KeleDatabase();
      const base = db.getProject(projectId);

      if (!base) {
        console.error(`❌ 项目不存在: ${projectId}`);
        console.log('   使用 kele list 查看所有项目');
        process.exit(1);
      }

      const project: Project = {
        ...base,
        subProjects: db.getSubProjects(projectId),
        tasks: db.getTasks(projectId),
      };

      console.log(`🚀 正在分析项目: ${project.name}\n`);

      // Step 1: Collect metrics
      const devSp = project.subProjects.find((sp) => sp.type === 'development');
      const checkDir = devSp?.targetDir || project.rootDir;
      const platform = project.idea.monetization || 'unknown';

      console.log('📊 收集数据中...');
      const currentMetrics = collectAllMetrics(checkDir, platform, options.mock);
      const previousMetrics = loadPreviousMetrics(projectId);
      const trend = calculateTrend(currentMetrics, previousMetrics);

      const history: MetricsHistory = {
        current: currentMetrics,
        previous: previousMetrics,
        trend,
      };

      // Step 2: Print weekly report
      console.log(formatWeeklyReport(history));

      if (options.report) {
        console.log('   ℹ️  --report 模式：只显示报告，不生成优化任务');
        if (!options.dryRun) {
          saveMetricsHistory(projectId, currentMetrics);
        }
        return;
      }

      // Step 3: Generate optimization plan
      console.log('🧠 分析优化机会...');
      const plan = buildOptimizationPlan(history, project);
      console.log(formatOptimizationPlan(plan));

      if (plan.tasks.length === 0) {
        console.log('✅ 所有指标健康，无需优化');
        if (!options.dryRun) {
          saveMetricsHistory(projectId, currentMetrics);
        }
        return;
      }

      if (options.dryRun) {
        console.log('\n🔍 [DRY RUN] 以上任务不会实际执行');
        return;
      }

      // Step 4: User confirmation (unless --auto)
      if (!options.auto) {
        const confirmed = await confirmCheckpoint(`是否执行 ${plan.tasks.length} 个优化任务？`);
        if (!confirmed) {
          console.log('   ⏹️  已取消');
          saveMetricsHistory(projectId, currentMetrics);
          return;
        }
      } else {
        console.log(`   🤖 自动模式：执行 ${plan.tasks.length} 个任务`);
      }

      // Step 5: Convert optimization tasks to executable tasks
      const targetSubProjectId = devSp?.id || project.subProjects[0]?.id || 'default';
      const newTasks = tasksToExecutableTasks(plan.tasks, targetSubProjectId);

      // Add new tasks to project
      for (const task of newTasks) {
        db.saveTask(task, projectId);
      }
      project.tasks = [...project.tasks, ...newTasks];

      console.log(`\n🔨 已创建 ${newTasks.length} 个优化任务，开始执行...\n`);

      // Step 6: Execute project with new tasks
      const registry = createRegistryFromConfig();
      const abortController = new AbortController();
      const sigintHandler = () => {
        console.log('\n\n⏹️  收到中断信号，正在安全退出...');
        abortController.abort();
        setTimeout(() => process.exit(0), 100);
      };
      process.on('SIGINT', sigintHandler);
      process.on('SIGTERM', sigintHandler);

      const result = await executeProject(project, {
        registry,
        db,
        onProgress: (msg) => console.log(msg),
        recoveryMode: 'interactive',
      });

      process.off('SIGINT', sigintHandler);
      process.off('SIGTERM', sigintHandler);

      // Step 7: Save metrics for next comparison
      saveMetricsHistory(projectId, currentMetrics);

      console.log(`\n✨ 优化完成！`);
      console.log(`   任务统计: ${result.completed} 完成, ${result.failed} 失败`);

      if (result.failed > 0) {
        console.log(`\n⚠️  有 ${result.failed} 个任务失败，可运行 kele retry ${projectId} <task-id> 重试`);
      }
    });
}
