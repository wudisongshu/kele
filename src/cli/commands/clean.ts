/**
 * kele clean — remove failed/abandoned projects.
 */

import { KeleDatabase } from '../../db/index.js';
import { rmSync } from 'fs';

export function runClean(autoDelete = false): void {
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
