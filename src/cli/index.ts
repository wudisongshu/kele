#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseIdea } from '../core/idea-engine.js';
import { incubate } from '../core/incubator.js';
import { planTasks } from '../core/task-planner.js';
import { executeProject } from '../core/executor.js';
import { ProviderRegistry } from '../adapters/index.js';
import { KeleDatabase } from '../db/index.js';
import type { Project } from '../types/index.js';

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
  .action(async (ideaText: string | undefined, options: { output: string; yes: boolean }) => {
    if (!ideaText) {
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
      console.log('🚀 即将开始执行。使用 --yes 跳过确认。');
      console.log('   （当前为 Mock 模式，未配置真实 AI API）\n');
      // In a real interactive CLI, we would prompt here.
      // For now, we proceed since non-interactive mode is active.
    }

    // Step 6: Execute
    const registry = new ProviderRegistry();
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

program.parse();
