/**
 * kele show — show project details with all tasks.
 */

import { Command } from 'commander';
import { KeleDatabase } from '../../db/index.js';

export function setupShowCommand(program: Command): void {
  program
    .command('show')
    .argument('<project-id>', 'Project ID')
    .description('Show project details with all tasks')
    .action((projectId: string) => {
      const db = new KeleDatabase();
      const project = db.getProject(projectId);

      if (!project) {
        console.error(`❌ 项目不存在: ${projectId}`);
        console.log('   用 kele list 查看所有项目');
        process.exit(1);
      }

      const subProjects = db.getSubProjects(projectId);
      const tasks = db.getTasks(projectId);

      console.log(`📁 ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   想法: ${project.idea.rawText}`);
      console.log(`   类型: ${project.idea.type} | 复杂度: ${project.idea.complexity}`);
      console.log(`   目录: ${project.rootDir}`);
      console.log();

      for (const sp of subProjects) {
        const spTasks = tasks.filter((t) => t.subProjectId === sp.id);
        console.log(`📦 ${sp.name} (${sp.type})`);
        console.log(`   目录: ${sp.targetDir}`);

        for (const task of spTasks) {
          const statusIcon = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : task.status === 'running' ? '🔄' : '⏳';
          const versionInfo = task.version > 1 ? ` v${task.version}` : '';
          const providerInfo = task.aiProvider ? ` [${task.aiProvider}]` : '';
          console.log(`   ${statusIcon} ${task.title}${versionInfo}${providerInfo}`);
          console.log(`      ID: ${task.id}`);
        }
        console.log();
      }
    });
}
