#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
const { version } = packageJson;

const program = new Command();

program
  .name('kele')
  .description('kele — Idea-to-Monetization AI workflow engine')
  .version(version, '-v, --version', 'Display version number')
  .argument('[idea]', 'Your idea, e.g. "我要做一个塔防游戏并部署赚钱"')
  .option('-o, --output <dir>', 'Output directory for generated projects', process.cwd())
  .option('-y, --yes', 'Skip confirmation and auto-execute all tasks', false)
  .action(async (idea: string | undefined, options: { output: string; yes: boolean }) => {
    if (!idea) {
      console.log('🥤 kele — 你的创意变现助手\n');
      console.log('用法示例：');
      console.log('  kele "我要做一个塔防游戏并部署到微信小程序赚钱"');
      console.log('  kele "帮我写一首歌并发布到音乐平台" --output ~/my-music');
      console.log('  kele "做一个记账工具小程序" --yes');
      console.log('\n选项：');
      console.log('  -o, --output <dir>   指定项目生成目录');
      console.log('  -y, --yes            自动执行所有任务（不询问确认）');
      console.log('  -v, --version        显示版本号');
      return;
    }

    console.log('🥤 kele 收到了你的想法：');
    console.log(`   "${idea}"\n`);

    if (!options.yes) {
      console.log('（核心引擎开发中，完整工作流即将上线）');
      console.log(`   输出目录: ${options.output}`);
      return;
    }

    console.log('⚡ 自动执行模式已开启');
    console.log('（核心引擎开发中，完整工作流即将上线）');
  });

program.parse();
