/**
 * kele resume — handle "继续"/"接着干" natural-language intent.
 */


import { executeProject } from '../../core/project-executor.js';
import { createRegistryFromConfig } from '../../adapters/index.js';
import { formatReleaseChecklist } from '../../platform-knowledge.js';
import { printLocalRunGuide } from '../run-guide.js';
import type { Project } from '../../types/index.js';
import { KeleDatabase } from '../../db/index.js';

export async function handleResumeIntent(projectQuery: string | undefined, db: KeleDatabase): Promise<void> {
  const projects = db.listProjects();
  if (projects.length === 0) {
    console.log('🥤 暂无项目。用 kele "你的想法" 创建一个！');
    return;
  }

  // Find project with running tasks, or the most recent project
  let targetProject: Project | undefined;

  if (projectQuery) {
    targetProject = projects.find((p) => p.name.includes(projectQuery) || projectQuery.includes(p.name));
  }

  if (!targetProject) {
    // Check for projects with running tasks
    for (const p of projects) {
      const tasks = db.getTasks(p.id);
      if (tasks.some((t) => t.status === 'running' || t.status === 'pending')) {
        targetProject = p;
        break;
      }
    }
  }

  if (!targetProject) {
    targetProject = projects[projects.length - 1];
  }

  const tasks = db.getTasks(targetProject.id);
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;

  console.log(`🔄 恢复项目: ${targetProject.name}`);
  console.log(`   任务进度: ${completed} 完成 / ${running} 进行中 / ${pending} 待执行 / ${failed} 失败\n`);

  if (pending === 0 && running === 0) {
    console.log('✅ 所有任务已完成！');
    await printLocalRunGuide(targetProject.rootDir);
    return;
  }

  // Reset running tasks back to pending so they can be re-executed
  for (const task of tasks) {
    if (task.status === 'running') {
      task.status = 'pending';
      db.saveTask(task, targetProject.id);
    }
  }

  const registry = createRegistryFromConfig();

  // Re-assemble project with updated tasks
  const project: Project = {
    ...targetProject,
    subProjects: db.getSubProjects(targetProject.id),
    tasks: db.getTasks(targetProject.id),
  };

  // Setup abort handling
  const abortController = new AbortController();
  const sigintHandler = () => {
    console.log('\n\n⏹️  收到中断信号，正在安全退出...');
    console.log('   当前任务状态已保存到数据库');
    console.log('   之后可以用 kele "继续" 或 kele "接着干" 恢复');
    abortController.abort();
  };
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigintHandler);

  const result = await executeProject(project, {
    registry,
    db,
    onProgress: (msg) => console.log(msg),
    signal: abortController.signal,
  });

  process.off('SIGINT', sigintHandler);
  process.off('SIGTERM', sigintHandler);

  if (result.aborted) {
    console.log('\n⏹️  执行已中断');
    console.log(`   项目目录: ${project.rootDir}`);
    console.log('   用 kele "继续" 或 kele "接着干" 恢复');
    return;
  }

  console.log(`\n✨ 项目完成！`);
  console.log(`   项目目录: ${project.rootDir}`);
  console.log(`   任务统计: ${result.completed} 完成, ${result.failed} 失败`);

  await printLocalRunGuide(project.rootDir);

  if (targetProject.idea.monetization && targetProject.idea.monetization !== 'unknown') {
    const checklist = formatReleaseChecklist(targetProject.idea.monetization);
    if (checklist) {
      console.log(checklist);
    }
  }
}
