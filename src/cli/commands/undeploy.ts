/**
 * kele undeploy — remove a deployed project from GitHub Pages.
 */

import { Command } from 'commander';
import { ProjectManager } from '../../project/manager.js';
import { undeployGitHubPages } from '../../deploy/platforms/github-pages.js';
import { loadConfig } from '../../config/manager.js';
import { error, success, info } from '../../utils/logger.js';

export function setupUndeployCommand(program: Command): void {
  program
    .command('undeploy <id>')
    .description('Remove a project from GitHub Pages')
    .action(async (id: string) => {
      const pm = new ProjectManager();
      const project = pm.findByIdentifier(id);

      if (!project) {
        pm.close();
        error(`未找到项目: ${id}`);
        process.exit(1);
      }

      info(`从 GitHub Pages 下线 ${id}...`);

      const config = loadConfig();
      const result = await undeployGitHubPages(id, {
        token: config.github?.token,
        repo: config.github?.repo,
        branch: config.github?.branch,
      });

      if (result.removed) {
        success(result.message);
        pm.removeDeployment(id, 'github-pages');
      } else {
        error(result.message);
      }

      pm.close();
    });
}
