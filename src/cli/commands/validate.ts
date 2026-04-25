/**
 * kele validate — validate a project's playability.
 */

import { Command } from 'commander';
import { GameValidator } from '../../core/validator.js';
import { ProjectManager } from '../../project/manager.js';

export function setupValidateCommand(program: Command): void {
  program
    .command('validate <id>')
    .description('验证项目可玩性并评分')
    .action((id: string) => {
      const pm = new ProjectManager();
      const project = pm.findByIdentifier(id);
      pm.close();

      if (!project) {
        console.log(`❌ 未找到项目: ${id}`);
        return;
      }

      const validator = new GameValidator(project.rootDir);
      validator.validate('index.html').then((result) => {
        console.log(`项目: ${project.name}`);
        console.log(`📊 可玩性评分: ${result.score}/100`);
        result.details.forEach((d) => console.log('  ' + d));
        console.log(result.playable ? '✅ 验证通过' : '❌ 验证未通过');
      });
    });
}
