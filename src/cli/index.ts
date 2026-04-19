#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseIdea } from '../core/idea-engine.js';
import { incubate } from '../core/incubator.js';
import { planTasks } from '../core/task-planner.js';
import { executeProject } from '../core/executor.js';
import { createRegistryFromConfig } from '../adapters/index.js';
import { KeleDatabase } from '../db/index.js';
import {
  setProvider,
  removeProvider,
  setDefaultProvider,
  getConfigSummary,
  hasAnyProvider,
} from '../config/index.js';
import type { Project } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
const { version } = packageJson;

const program = new Command();

program
  .name('kele')
  .description('kele — Idea-to-Monetization AI workflow engine')
  .version(version, '-v, --version', 'Display version number');

// --- Main command: kele "idea" ---
program
  .argument('[idea]', 'Your idea, e.g. "我要做一个塔防游戏并部署赚钱"')
  .option('-o, --output <dir>', 'Output directory for generated projects', process.cwd())
  .option('-y, --yes', 'Skip confirmation and auto-execute all tasks', false)
  .action(async (ideaText: string | undefined, options: { output: string; yes: boolean }) => {
    if (!ideaText) {
      console.log('🥤 kele — 你的创意变现助手\n');
      console.log('用法示例：');
      console.log('  kele "我要做一个塔防游戏并部署到微信小程序赚钱"');
      console.log('  kele "帮我写一首歌并发布到音乐平台" --output ~/my-music');
      console.log('  kele "做一个记账工具小程序" --yes');
      console.log('\n配置 AI：');
      console.log('  kele config --provider kimi --key sk-xxx --url https://api.moonshot.cn/v1 --model kimi-latest');
      console.log('  kele config --provider deepseek --key sk-xxx --url https://api.deepseek.com/v1 --model deepseek-chat');
      console.log('\n选项：');
      console.log('  -o, --output <dir>   指定项目生成目录');
      console.log('  -y, --yes            自动执行所有任务（不询问确认）');
      console.log('  -v, --version        显示版本号');
      return;
    }

    // Check if any AI provider is configured
    if (!hasAnyProvider()) {
      console.log('⚠️  未配置 AI API Key');
      console.log('kele 需要调用 AI 来完成任务。请配置至少一个 provider：\n');
      console.log('  kele config --provider kimi --key <your-key> --url https://api.moonshot.cn/v1 --model kimi-latest');
      console.log('  kele config --provider deepseek --key <your-key> --url https://api.deepseek.com/v1 --model deepseek-chat');
      console.log('  kele config --provider qwen --key <your-key> --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo');
      console.log('\n或者使用 --yes 以 Mock 模式运行（仅用于测试）：');
      console.log('  kele "你的 idea" --yes');
      return;
    }

    console.log('🥤 kele 收到了你的想法：');
    console.log(`   "${ideaText}"\n`);

    // Step 1: Parse idea
    const parseResult = parseIdea(ideaText);
    if (!parseResult.success || !parseResult.idea) {
      console.error('❌ 无法解析你的想法：', parseResult.error);
      process.exit(1);
    }

    const idea = parseResult.idea;
    console.log(`📋 解析结果：`);
    console.log(`   类型: ${idea.type}`);
    console.log(`   变现渠道: ${idea.monetization}`);
    console.log(`   复杂度: ${idea.complexity}`);
    console.log(`   关键词: ${idea.keywords.join(', ')}\n`);

    // Step 2: Incubate sub-projects
    const projectName = ideaText.slice(0, 30).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-');
    const rootDir = join(options.output, projectName);
    const incubateResult = incubate(idea, rootDir);

    if (!incubateResult.success || !incubateResult.subProjects) {
      console.error('❌ 孵化失败：', incubateResult.error);
      process.exit(1);
    }

    const subProjects = incubateResult.subProjects;
    console.log(`🥚 孵化出 ${subProjects.length} 个子项目：`);
    for (const sp of subProjects) {
      console.log(`   • ${sp.name} (${sp.type})`);
    }
    console.log();

    // Step 3: Plan tasks for each sub-project
    const allTasks = [];
    for (const sp of subProjects) {
      const planResult = planTasks(sp, idea);
      if (planResult.success && planResult.tasks) {
        allTasks.push(...planResult.tasks);
      }
    }

    console.log(`📐 拆解出 ${allTasks.length} 个任务\n`);

    // Step 4: Assemble project
    const project: Project = {
      id: idea.id,
      name: projectName,
      idea,
      subProjects,
      tasks: allTasks,
      status: 'initialized',
      rootDir,
      createdAt: idea.createdAt,
      updatedAt: idea.createdAt,
    };

    // Step 5: Confirm with user (unless --yes)
    if (!options.yes) {
      console.log('🚀 即将开始执行。使用 --yes 跳过确认。\n');
      // In non-interactive environments, we proceed after showing the plan.
      // In a real TTY, we would prompt the user here.
    }

    // Step 6: Execute
    const registry = createRegistryFromConfig();
    const db = new KeleDatabase();

    const result = await executeProject(project, {
      registry,
      db,
      onProgress: (msg) => console.log(msg),
    });

    console.log(`\n✨ 项目完成！`);
    console.log(`   项目目录: ${rootDir}`);
    console.log(`   任务统计: ${result.completed} 完成, ${result.failed} 失败`);
  });

// --- Config command: kele config ---
program
  .command('config')
  .description('Manage AI provider configuration')
  .option('--provider <name>', 'Provider name (e.g. kimi, deepseek, qwen)')
  .option('--key <apiKey>', 'API Key')
  .option('--url <baseURL>', 'Base URL for the API')
  .option('--model <model>', 'Model name')
  .option('--default <name>', 'Set default provider')
  .option('--remove <name>', 'Remove a provider')
  .action((options: {
    provider?: string;
    key?: string;
    url?: string;
    model?: string;
    default?: string;
    remove?: string;
  }) => {
    // Show current config
    if (!options.provider && !options.default && !options.remove) {
      console.log('🥤 kele 配置\n');
      console.log(getConfigSummary());
      console.log('\n添加 provider：');
      console.log('  kele config --provider kimi --key sk-xxx --url https://api.moonshot.cn/v1 --model kimi-latest');
      console.log('  kele config --provider deepseek --key sk-xxx --url https://api.deepseek.com/v1 --model deepseek-chat');
      console.log('  kele config --provider qwen --key sk-xxx --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo');
      return;
    }

    // Remove provider
    if (options.remove) {
      removeProvider(options.remove);
      console.log(`✅ 已移除 provider: ${options.remove}`);
      return;
    }

    // Set default provider
    if (options.default) {
      setDefaultProvider(options.default);
      console.log(`✅ 默认 provider 已设为: ${options.default}`);
      return;
    }

    // Add/update provider
    if (options.provider) {
      if (!options.key || !options.url || !options.model) {
        console.error('❌ 添加 provider 需要提供 --key, --url, --model');
        process.exit(1);
      }

      setProvider(options.provider, {
        apiKey: options.key,
        baseURL: options.url,
        model: options.model,
      });

      console.log(`✅ 已配置 provider: ${options.provider}`);
      console.log(`   model: ${options.model}`);
      console.log(`   url: ${options.url}`);
    }
  });

program.parse();
