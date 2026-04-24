/**
 * kele list — list all projects.
 */

import { Command } from 'commander';
import { ProjectManager } from '../../project/manager.js';

export function setupListCommand(program: Command): void {
  program
    .command('list')
    .description('List all projects')
    .action(() => {
      const pm = new ProjectManager();
      const projects = pm.list();
      pm.close();

      if (projects.length === 0) {
        console.log('暂无项目。用 kele "<你的想法>" 创建一个！');
        return;
      }

      console.log(`项目列表 (${projects.length} 个)\n`);
      for (const p of projects) {
        const icon = p.status === 'completed' ? '✅' : p.status === 'failed' ? '❌' : '⏳';
        console.log(`  ${icon} ${p.name} (${p.id})`);
        console.log(`     ${p.description}`);
        console.log(`     目录: ${p.rootDir}`);
        console.log();
      }
    });
}
