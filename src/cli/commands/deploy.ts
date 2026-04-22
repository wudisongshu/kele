/**
 * kele deploy — one-click deployment to production platforms.
 *
 * Usage:
 *   kele deploy <project-id> [platform]
 *   kele deploy my-game github-pages
 *   kele deploy my-game --dry-run
 *
 * Platforms: github-pages, wechat-miniprogram, itchio, vps
 */

import { Command } from 'commander';
import { KeleDatabase } from '../../db/index.js';
import {
  getDeployStrategy,
  listDeployPlatforms,
  detectPlatformFromProject,
  type DeployOptions,
} from '../../core/deploy-strategies.js';
import { c } from '../utils.js';

export function setupDeployCommand(program: Command): void {
  program
    .command('deploy')
    .argument('<project-id>', 'Project ID to deploy')
    .argument('[platform]', `Target platform (${listDeployPlatforms().join(', ')})`)
    .description('Deploy a project to a production platform')
    .option('--dry-run', 'Show what would be done without actually deploying', false)
    .option('--verbose', 'Show detailed output during deployment', false)
    .action(async (projectId: string, platformArg: string | undefined, options: { dryRun: boolean; verbose: boolean }) => {
      const db = new KeleDatabase();
      const project = db.getProject(projectId);

      if (!project) {
        console.error(c.red(`❌ 项目不存在: ${projectId}`));
        console.log('   用 kele list 查看所有项目');
        process.exit(1);
      }

      // Determine platform
      let platform = platformArg;
      if (!platform) {
        const detected = detectPlatformFromProject(project.idea.monetization);
        if (detected) {
          platform = detected;
          console.log(`🔍 自动检测到平台: ${c.cyan(platform)} (来自项目变现方式: ${project.idea.monetization})`);
        } else {
          console.error(c.red(`❌ 无法自动检测部署平台`));
          console.log(`   项目变现方式: ${project.idea.monetization}`);
          console.log(`   请显式指定平台: kele deploy ${projectId} <platform>`);
          console.log(`   支持的平台: ${listDeployPlatforms().join(', ')}`);
          process.exit(1);
        }
      }

      const strategy = getDeployStrategy(platform);
      if (!strategy) {
        console.error(c.red(`❌ 不支持的部署平台: ${platform}`));
        console.log(`   支持的平台: ${listDeployPlatforms().join(', ')}`);
        process.exit(1);
      }

      console.log(`\n🚀 部署项目: ${c.bold(project.name)} → ${c.cyan(strategy.label)}\n`);

      // ── Step 1: Prerequisites ──
      console.log(`📋 检查先决条件...`);
      const preResult = await strategy.checkPrerequisites(project.rootDir);
      for (const check of preResult.checks) {
        const icon = check.passed ? '✅' : check.required ? '❌' : '⚠️';
        const color = check.passed ? c.green : check.required ? c.red : c.yellow;
        console.log(`   ${icon} ${color(check.name)}: ${check.message}`);
      }

      if (!preResult.ready) {
        console.error(c.red(`\n❌ 先决条件未满足，无法继续部署。`));
        console.log(`\n${strategy.getDeployGuide(project.rootDir)}`);
        process.exit(1);
      }

      // ── Step 2: Validation ──
      console.log(`\n🔍 验证项目质量...`);
      const valResult = await strategy.validateProject(project.rootDir, project.idea.type);
      for (const check of valResult.checks) {
        const icon = check.passed ? '✅' : '⚠️';
        const color = check.passed ? c.green : c.yellow;
        console.log(`   ${icon} ${color(check.name)}: ${check.message}`);
      }
      console.log(`   📊 验证得分: ${valResult.score}/100`);

      if (!valResult.valid) {
        console.error(c.yellow(`\n⚠️  项目验证未通过（得分 ${valResult.score}），建议先修复问题。`));
        console.log(`   可用 kele validate ${projectId} --fix 查看详情`);
        // For dry-run we continue; for real deploy we warn but don't block
        if (!options.dryRun) {
          console.log(c.yellow(`   继续部署中...（风险自负）`));
        }
      }

      // ── Step 3: Deploy ──
      console.log(`\n📤 开始部署...`);
      if (options.dryRun) {
        console.log(c.blue(`   [DRY-RUN 模式] 仅模拟，不执行实际部署`));
      }

      const deployOpts: DeployOptions = {
        dryRun: options.dryRun,
        verbose: options.verbose,
      };

      const deployResult = await strategy.deploy(project.rootDir, deployOpts);

      if (deployResult.success) {
        const icon = options.dryRun ? '📋' : '🎉';
        const color = options.dryRun ? c.blue : c.green;
        console.log(`\n${icon} ${color('部署成功')}`);
        console.log(`   ${deployResult.message}`);
        if (deployResult.command) {
          console.log(`   命令: ${c.cyan(deployResult.command)}`);
        }
        if (deployResult.output && options.verbose) {
          console.log(`   输出: ${deployResult.output}`);
        }
      } else {
        console.error(`\n❌ ${c.red('部署失败')}`);
        console.error(`   ${deployResult.message}`);
        if (deployResult.command) {
          console.log(`   可手动运行: ${c.cyan(deployResult.command)}`);
        }
        console.log(`\n${strategy.getDeployGuide(project.rootDir)}`);
        process.exit(1);
      }

      // ── Step 4: Post-deploy guide ──
      if (!options.dryRun) {
        console.log(`\n📖 后续步骤:`);
        console.log(strategy.getDeployGuide(project.rootDir));
      }

      db.close();
    });
}
