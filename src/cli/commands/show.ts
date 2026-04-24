/**
 * kele show — show project details.
 */

import { Command } from 'commander';
import { ProjectManager } from '../../project/manager.js';

export function setupShowCommand(program: Command): void {
  program
    .command('show <id>')
    .description('Show project details')
    .action((id: string) => {
      const pm = new ProjectManager();
      const project = pm.get(id);
      pm.close();

      if (!project) {
        console.log(`❌ 未找到项目: ${id}`);
        return;
      }

      console.log(`项目: ${project.name}`);
      console.log(`ID: ${project.id}`);
      console.log(`描述: ${project.description}`);
      console.log(`状态: ${project.status}`);
      console.log(`目录: ${project.rootDir}`);
      console.log(`创建时间: ${project.createdAt}`);
    });
}
