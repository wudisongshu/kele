/**
 * kele deploy — deploy an existing project to a hosting platform.
 * Also supports --prune and --clean-all for maintenance.
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { ProjectManager } from '../../project/manager.js';
import { deployProject, getDefaultPlatform, pruneGitHubPages, cleanAllGitHubPages, refreshGitHubPagesNav, cleanOrphanGitHubPages } from '../../deploy/index.js';
import { loadConfig } from '../../config/manager.js';
import type { DeployPlatform } from '../../deploy/types.js';
import { error, success, info } from '../../utils/logger.js';

export function setupDeployCommand(program: Command): void {
  program
    .command('deploy [id]')
    .description('Deploy a project, or prune/clean deployments')
    .option('-p, --platform <name>', 'Platform: static, github-pages, vercel, netlify')
    .option('-o, --out <dir>', 'Output directory (for static platform)')
    .option('--prune <n>', 'Keep only the N most recent GitHub Pages deployments')
    .option('--clean-all', 'Remove ALL GitHub Pages deployments (dangerous)')
    .option('--refresh', 'Re-generate nav page without adding/removing games')
    .option('--clean-orphans', 'Remove deployments whose local project no longer exists')
    .action(async (
      id: string | undefined,
      options: { platform?: string; out?: string; prune?: string; cleanAll?: boolean; refresh?: boolean; cleanOrphans?: boolean },
    ) => {
      const config = loadConfig();

      // --- Prune mode ---
      if (options.prune !== undefined) {
        const keep = parseInt(options.prune, 10);
        if (Number.isNaN(keep) || keep < 1) {
          error('--prune 参数必须是正整数');
          process.exit(1);
        }
        info(`清理旧部署，保留最近 ${keep} 个...`);
        const result = await pruneGitHubPages(keep, {
          token: config.github?.token,
          repo: config.github?.repo,
          branch: config.github?.branch,
        });
        success(result.message);
        return;
      }

      // --- Refresh nav page ---
      if (options.refresh) {
        info('刷新导航页...');
        const result = await refreshGitHubPagesNav({
          token: config.github?.token,
          repo: config.github?.repo,
          branch: config.github?.branch,
        });
        success(result.message);
        return;
      }

      // --- Clean orphans ---
      if (options.cleanOrphans) {
        info('清理孤儿部署...');
        const result = await cleanOrphanGitHubPages({
          token: config.github?.token,
          repo: config.github?.repo,
          branch: config.github?.branch,
        });
        if (result.removed.length > 0) {
          success(result.message);
        } else {
          console.log(result.message);
        }
        return;
      }

      // --- Clean-all mode ---
      if (options.cleanAll) {
        const pm = new ProjectManager();
        const projects = pm.list();
        const deployed = projects.filter((p) =>
          p.deployments.some((d) => d.platform === 'github-pages'),
        );

        console.log('⚠️  这将删除 GitHub Pages 上的所有已部署游戏！\n');
        console.log('受影响的游戏：');
        for (const p of deployed) {
          const gh = p.deployments.find((d) => d.platform === 'github-pages');
          console.log(`  - ${p.id} (${p.description})`);
          if (gh?.url) console.log(`    ${gh.url}`);
        }
        console.log('\n此操作不可恢复，是否继续？ (yes/no)');

        // Simple stdin confirmation
        const answer = await new Promise<string>((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim().toLowerCase()));
        });

        if (answer !== 'yes') {
          console.log('已取消');
          pm.close();
          process.exit(0);
        }

        info('清空所有 GitHub Pages 部署...');
        const result = await cleanAllGitHubPages({
          token: config.github?.token,
          repo: config.github?.repo,
          branch: config.github?.branch,
        });
        success(result.message);

        // Clear deployment records from all projects
        for (const p of deployed) {
          pm.removeDeployment(p.id, 'github-pages');
        }
        pm.close();
        return;
      }

      // --- Normal deploy mode ---
      if (!id) {
        error('请提供项目 ID，或使用 --prune / --clean-all');
        process.exit(1);
      }

      const pm = new ProjectManager();
      const project = pm.findByIdentifier(id);

      if (!project) {
        pm.close();
        error(`未找到项目: ${id}`);
        process.exit(1);
      }

      if (!existsSync(project.rootDir)) {
        pm.close();
        error(`项目文件已不存在: ${project.rootDir}`);
        console.log('   请重新生成该项目');
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
          console.log('   注意：首次访问可能需要 1-2 分钟生效');
        }

        pm.addDeployment(project.id, {
          platform,
          url: result.url ?? '',
          deployedAt: new Date().toISOString(),
        });
      } else {
        error(result.message);
        pm.close();
        process.exit(1);
      }

      pm.close();
    });
}
