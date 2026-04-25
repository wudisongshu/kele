/**
 * kele deploy — deploy an existing project to a hosting platform.
 */

import { Command } from 'commander';
import { ProjectManager } from '../../project/manager.js';
import { deployProject, getDefaultPlatform } from '../../deploy/index.js';
import type { DeployPlatform } from '../../deploy/types.js';
import { error, success, info } from '../../utils/logger.js';

export function setupDeployCommand(program: Command): void {
  program
    .command('deploy <id>')
    .description('Deploy a project to a hosting platform')
    .option('-p, --platform <name>', 'Platform: static, github-pages, vercel, netlify')
    .option('-o, --out <dir>', 'Output directory (for static platform)')
    .action(async (id: string, options: { platform?: string; out?: string }) => {
      const pm = new ProjectManager();
      const project = pm.get(id);
      pm.close();

      if (!project) {
        error(`未找到项目: ${id}`);
        process.exit(1);
      }

      const platform = (options.platform ?? getDefaultPlatform()) as DeployPlatform;
      info(`部署到 ${platform}...`);

      const result = await deployProject(project, {
        platform,
        outDir: options.out,
      });

      if (result.success) {
        success(result.message);
        if (result.url) {
          console.log(`🔗 ${result.url}`);
        }
      } else {
        error(result.message);
        process.exit(1);
      }
    });
}
