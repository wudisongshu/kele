/**
 * kele list — list all projects and their tasks.
 */

import { Command } from 'commander';
import { KeleDatabase } from '../../db/index.js';

export function setupListCommand(program: Command): void {
  program
    .command('list')
    .description('List all projects and their tasks')
    .option('--status <status>', 'Filter by status (pending, executing, completed, failed)')
    .option('--type <type>', 'Filter by type (game, tool, bot, etc.)')
    .option('--format <type>', 'Output format: text (default) or json', 'text')
    .action((opts: { status?: string; type?: string; format?: string }) => {
      const db = new KeleDatabase();
      let projects = db.listProjects();

      if (opts.status) {
        projects = projects.filter((p) => p.status === opts.status);
      }
      if (opts.type) {
        projects = projects.filter((p) => p.idea.type === opts.type);
      }

      if (projects.length === 0) {
        if (opts.format === 'json') {
          console.log(JSON.stringify({ projects: [] }, null, 2));
        } else {
          console.log('🥤 暂无项目。用 kele "你的想法" 创建一个！');
        }
        return;
      }

      if (opts.format === 'json') {
        const data = projects.map((project) => {
          const subProjects = db.getSubProjects(project.id);
          const tasks = db.getTasks(project.id);
          const completed = tasks.filter((t) => t.status === 'completed').length;
          const failed = tasks.filter((t) => t.status === 'failed').length;
          return {
            id: project.id,
            name: project.name,
            idea: project.idea.rawText,
            type: project.idea.type,
            monetization: project.idea.monetization,
            status: project.status,
            rootDir: project.rootDir,
            subProjects: subProjects.length,
            tasks: { total: tasks.length, completed, failed },
          };
        });
        console.log(JSON.stringify({ projects: data }, null, 2));
        return;
      }

      console.log(`🥤 项目列表 (${projects.length} 个)\n`);

      for (const project of projects) {
        const subProjects = db.getSubProjects(project.id);
        const tasks = db.getTasks(project.id);
        const completed = tasks.filter((t) => t.status === 'completed').length;
        const failed = tasks.filter((t) => t.status === 'failed').length;
        const total = tasks.length;

        console.log(`📁 ${project.name}`);
        console.log(`   ID: ${project.id}`);
        console.log(`   想法: ${project.idea.rawText.slice(0, 40)}${project.idea.rawText.length > 40 ? '...' : ''}`);
        console.log(`   子项目: ${subProjects.length} | 任务: ${completed}/${total} 完成${failed > 0 ? `, ${failed} 失败` : ''}`);
        console.log(`   目录: ${project.rootDir}`);
        console.log();
      }
    });
}
