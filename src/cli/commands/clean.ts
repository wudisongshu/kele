/**
 * kele clean — remove failed/abandoned projects.
 */

import { KeleDatabase } from '../../db/index.js';
import { rmSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Command } from 'commander';
import { debugLog } from '../../debug.js';

export function runClean(autoDelete = false, debugLogs = false): void {
  // Handle debug logs cleanup first
  if (debugLogs) {
    const debugDir = join(homedir(), '.kele', 'debug');
    if (!existsSync(debugDir)) {
      console.log('🥤 暂无 debug 日志需要清理');
      return;
    }
    const files = readdirSync(debugDir);
    let totalSize = 0;
    let removed = 0;
    for (const file of files) {
      const filePath = join(debugDir, file);
      try {
        totalSize += statSync(filePath).size;
        rmSync(filePath, { force: true });
        removed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog(`Clean rm failed: ${filePath}`, msg);
        // skip
      }
    }
    const sizeMB = (totalSize / 1024 / 1024).toFixed(1);
    console.log(`🧹 已清理 ${removed} 个 debug 日志文件 (${sizeMB}MB)`);
    return;
  }
  const db = new KeleDatabase();
  const projects = db.listProjects();

  if (projects.length === 0) {
    console.log('🥤 暂无项目需要清理');
    return;
  }

  // Find projects with failed tasks or no completed tasks
  const toClean = [];
  for (const project of projects) {
    const tasks = db.getTasks(project.id);
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const total = tasks.length;

    if (failed > 0 || (total > 0 && completed === 0)) {
      toClean.push({ project, failed, completed, total });
    }
  }

  if (toClean.length === 0) {
    console.log('✅ 所有项目状态良好，无需清理');
    return;
  }

  console.log(`🧹 发现 ${toClean.length} 个项目可以清理:\n`);
  for (const item of toClean) {
    console.log(`   📁 ${item.project.name}`);
    console.log(`      ID: ${item.project.id}`);
    console.log(`      任务: ${item.completed}/${item.total} 完成, ${item.failed} 失败`);
    console.log(`      目录: ${item.project.rootDir}`);
    console.log();
  }

  if (autoDelete) {
    console.log('🗑️ 自动删除模式 — 正在清理...');
    for (const item of toClean) {
      try {
        rmSync(item.project.rootDir, { recursive: true, force: true });
        db.deleteProject(item.project.id);
        console.log(`   ✅ 已删除: ${item.project.name}`);
      } catch {
        console.log(`   ❌ 删除失败: ${item.project.name}`);
      }
    }
    console.log('\n✅ 清理完成');
    return;
  }

  console.log('💡 使用 kele delete <project-id> 删除指定项目');
  console.log('   或使用 kele retry <project-id> <task-id> 重试失败任务');
}

export function setupCleanCommand(program: Command): void {
  program
    .command('clean')
    .description('List failed/abandoned projects for cleanup')
    .option('--delete', 'Auto-delete failed/abandoned projects')
    .option('--debug-logs', 'Clean debug log files from ~/.kele/debug')
    .action((opts: { delete?: boolean; debugLogs?: boolean }) => {
      runClean(opts.delete, opts.debugLogs);
    });
}
