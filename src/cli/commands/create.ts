/**
 * kele create — create a new project from an idea.
 *
 * Core flow:
 * 1. Parse idea
 * 2. Determine if simple game/tool → quick mode
 * 3. Generate single-file HTML
 * 4. Validate playability
 * 5. Save project metadata
 */

import { Command } from 'commander';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { createRouterFromConfig } from '../../ai/router.js';
import { GameGenerator } from '../../core/generator.js';
import { GameValidator } from '../../core/validator.js';
import { ProjectManager } from '../../project/manager.js';
import { getOutputDir, hasAnyProvider } from '../../config/manager.js';
import { generateProjectSlug } from '../utils.js';
import { info, success, error } from '../../utils/logger.js';
import { deployProject, getDefaultPlatform } from '../../deploy/index.js';
import type { DeployPlatform } from '../../deploy/types.js';
import { printChecklist } from '../../deploy/checklist.js';

export function setupCreateCommand(program: Command): void {
  program
    .argument('[idea]', 'Your idea, e.g. "做个贪吃蛇游戏"')
    .option('-o, --output <dir>', 'Output directory')
    .option('-y, --yes', 'Skip confirmation', false)
    .option('--mock', 'Use mock AI (no API calls)', false)
    .option('--deploy [platform]', 'Deploy after generation (auto-detects platform if no value)')
    .option('--debug', 'Enable debug logging', false)
    .action(async (ideaText: string | undefined, options: { output?: string; yes: boolean; mock: boolean; debug: boolean; deploy?: string | true }) => {
      if (!ideaText || ideaText.trim().length === 0) {
        console.log('Usage: kele "<your idea>"');
        console.log('Example: kele "做一个贪吃蛇游戏"');
        return;
      }

      if (options.debug) {
        const { setDebug } = await import('../../utils/logger.js');
        setDebug(true);
      }

      if (!options.mock && !hasAnyProvider()) {
        console.log('❌ 未配置 AI provider');
        console.log('请运行: kele config --provider <name> --key <key> --url <url> --model <model>');
        console.log('\n或使用 mock 模式测试:');
        console.log('  kele "做个游戏" --mock');
        return;
      }

      // Setup
      const projectName = generateProjectSlug(ideaText, 'game');
      const outputDir = options.output || getOutputDir();
      const rootDir = join(outputDir, projectName);
      mkdirSync(outputDir, { recursive: true });

      const router = createRouterFromConfig();

      const provider = router.route(options.mock ? 'mock' : undefined).adapter;
      info(`使用 ${provider.name} 生成代码...`);

      // Generate
      const generator = new GameGenerator(provider, rootDir);
      const result = await generator.generate(ideaText);

      if (!result.success) {
        error(`生成失败: ${result.error}`);
        process.exit(1);
      }

      success(`生成完成: ${result.filePath}`);

      // Validate
      const validator = new GameValidator(rootDir);
      const playability = await validator.validate('index.html');

      console.log(`📊 可玩性评分: ${playability.score}/100`);
      playability.details.forEach((d) => console.log('  ' + d));

      if (!playability.playable) {
        error('可玩性验证未通过');
        process.exit(1);
      }

      // Save project
      const pm = new ProjectManager();
      const project = pm.create({
        name: result.gameTitle || projectName,
        description: ideaText,
        rootDir,
        prompt: ideaText,
      });
      pm.updateStatus(project.id, 'completed');

      success('游戏生成完成且可玩！');
      console.log(`📂 文件位置: ${result.filePath}`);
      console.log('💡 用浏览器打开 index.html 即可游玩');

      // Deploy if requested
      if (options.deploy !== undefined) {
        const platform: DeployPlatform =
          options.deploy === true ? getDefaultPlatform() : (options.deploy as DeployPlatform);
        info(`部署到 ${platform}...`);
        const deployResult = await deployProject(project, { platform });
        if (deployResult.success) {
          success(deployResult.message);
          if (deployResult.url) {
            console.log(`🔗 ${deployResult.url}`);
            console.log('   注意：首次访问可能需要 1-2 分钟生效');
          }

          // Record deployment
          pm.addDeployment(project.id, {
            platform,
            url: deployResult.url ?? '',
            deployedAt: new Date().toISOString(),
          });
        } else {
          error(deployResult.message);
        }
      }

      // Print checklist
      printChecklist(project);

      pm.close();
    });
}
