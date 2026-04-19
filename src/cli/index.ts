#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseIdea } from '../core/idea-engine.js';
import { incubate } from '../core/incubator.js';
import { planTasks } from '../core/task-planner.js';
import { executeProject } from '../core/executor.js';
import { upgradeTask } from '../core/upgrade-engine.js';
import { createRegistryFromConfig } from '../adapters/index.js';
import { KeleDatabase } from '../db/index.js';
import { needsResearch, research } from '../core/research-engine.js';
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

/**
 * Collect repeatable --header options into a Record.
 */
function collectHeaders(value: string, previous: Record<string, string>): Record<string, string> {
  const [k, v] = value.split(':');
  if (k && v !== undefined) {
    previous[k.trim()] = v.trim();
  }
  return previous;
}

/**
 * Parse timeout from CLI option or environment variable.
 */
function parseTimeout(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) {
    console.warn(`⚠️  Invalid timeout "${value}", using default 1800s`);
    return 1800;
  }
  return parsed;
}

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
  .option('-t, --timeout <seconds>', 'AI request timeout in seconds (default: 1800 = 30min)', parseTimeout)
  .action(async (ideaText: string | undefined, options: { output: string; yes: boolean; timeout?: number }) => {
    if (!ideaText) {
      printUsage();
      return;
    }

    // Check if any AI provider is configured
    if (!hasAnyProvider()) {
      printNoProviderHelp();
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

    const registry = createRegistryFromConfig();
    const route = registry.route('medium');

    // Step 2: Business Research (if needed)
    if (needsResearch(ideaText, idea.keywords)) {
      console.log('🔍 检测到模糊/竞品参考需求，启动商业研究...\n');

      let researchResult = await research(ideaText, route.adapter);

      // Fallback to mock if real provider fails
      if (!researchResult.success) {
        const mock = registry.get('mock');
        if (mock && route.provider !== 'mock') {
          console.log('   ⚠️  AI provider 调用失败，使用 Mock 模式生成研究报告\n');
          researchResult = await research(ideaText, mock);
        }
      }

      if (researchResult.success && researchResult.report) {
        const report = researchResult.report;
        console.log('📊 研究报告');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🎯 研究对象: ${report.subject}`);
        console.log(`\n📌 产品分析:`);
        console.log(report.productAnalysis.slice(0, 300) + (report.productAnalysis.length > 300 ? '...' : ''));
        console.log(`\n💰 变现分析:`);
        console.log(report.monetizationAnalysis.slice(0, 300) + (report.monetizationAnalysis.length > 300 ? '...' : ''));
        console.log(`\n💡 核心建议:`);
        console.log(report.recommendations.slice(0, 400) + (report.recommendations.length > 400 ? '...' : ''));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        if (!options.yes) {
          console.log('⏸️  CHECKPOINT: 请确认研究方向是否正确');
          console.log('   如果方向正确，请添加 --yes 继续执行');
          console.log('   如果需要调整，请重新描述你的想法\n');
          return;
        }
      }
    }

    // Step 3: Incubate sub-projects
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
      if (sp.dependencies.length > 0) {
        console.log(`     依赖: ${sp.dependencies.join(', ')}`);
      }
    }
    console.log();

    // Checkpoint: confirm sub-projects
    if (!options.yes) {
      console.log('⏸️  CHECKPOINT: 请确认子项目计划');
      console.log('   以上子项目将依次执行，每个完成后进入下一个');
      console.log('   确认无误请添加 --yes 继续\n');
      return;
    }

    // Step 4: Plan tasks for each sub-project
    const allTasks = [];
    for (const sp of subProjects) {
      const planResult = planTasks(sp, idea);
      if (planResult.success && planResult.tasks) {
        // Initialize version for new tasks
        for (const t of planResult.tasks) {
          t.version = 1;
        }
        allTasks.push(...planResult.tasks);
      }
    }

    console.log(`📐 拆解出 ${allTasks.length} 个任务\n`);

    // Checkpoint: confirm tasks
    if (!options.yes) {
      console.log('⏸️  CHECKPOINT: 任务拆解完成');
      console.log(`   共 ${allTasks.length} 个任务待执行`);
      console.log('   确认执行请添加 --yes\n');
      return;
    }

    // Step 5: Assemble and execute project
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

    const db = new KeleDatabase();

    const result = await executeProject(project, {
      registry,
      db,
      onProgress: (msg) => console.log(msg),
      timeout: options.timeout,
    });

    console.log(`\n✨ 项目完成！`);
    console.log(`   项目目录: ${rootDir}`);
    console.log(`   任务统计: ${result.completed} 完成, ${result.failed} 失败`);
    console.log(`\n💡 对结果不满意？可以升级任务：`);
    console.log(`   kele upgrade ${project.id} <task-id> "把画面改成像素风"`);
    console.log(`   kele list    # 查看所有项目和任务`);

    if (result.failed > 0) {
      console.log(`\n⚠️  有 ${result.failed} 个任务失败，请检查日志或手动修复。`);
    }
  });

// --- Config command: kele config ---
program
  .command('config')
  .description('Manage AI provider configuration')
  .option('--provider <name>', 'Provider name (e.g. kimi, deepseek, qwen)')
  .option('--key <apiKey>', 'API Key')
  .option('--url <baseURL>', 'Base URL for the API')
  .option('--model <model>', 'Model name')
  .option('--header <header>', 'Extra header in key:value format (repeatable)', collectHeaders, {})
  .option('--default <name>', 'Set default provider')
  .option('--remove <name>', 'Remove a provider')
  .action((options: {
    provider?: string;
    key?: string;
    url?: string;
    model?: string;
    header?: Record<string, string>;
    default?: string;
    remove?: string;
  }) => {
    if (!options.provider && !options.default && !options.remove) {
      console.log('🥤 kele 配置\n');
      console.log(getConfigSummary());
      console.log('\n添加 provider：');
      console.log('  kele config --provider kimi --key sk-xxx --url https://api.moonshot.cn/v1 --model moonshot-v1-128k');
      console.log('  kele config --provider kimi-code --key sk-xxx --url https://api.kimi.com/coding/v1 --model kimi-for-coding');
      console.log('  kele config --provider deepseek --key sk-xxx --url https://api.deepseek.com/v1 --model deepseek-chat');
      console.log('  kele config --provider qwen --key sk-xxx --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo');
      return;
    }

    if (options.remove) {
      removeProvider(options.remove);
      console.log(`✅ 已移除 provider: ${options.remove}`);
      return;
    }

    if (options.default) {
      setDefaultProvider(options.default);
      console.log(`✅ 默认 provider 已设为: ${options.default}`);
      return;
    }

    if (options.provider) {
      if (!options.key || !options.url || !options.model) {
        console.error('❌ 添加 provider 需要提供 --key, --url, --model');
        process.exit(1);
      }

      setProvider(options.provider, {
        apiKey: options.key,
        baseURL: options.url,
        model: options.model,
        headers: options.header && Object.keys(options.header).length > 0 ? options.header : undefined,
      });

      console.log(`✅ 已配置 provider: ${options.provider}`);
      console.log(`   model: ${options.model}`);
      console.log(`   url: ${options.url}`);
    }
  });

// --- List command: kele list ---
program
  .command('list')
  .description('List all projects and their tasks')
  .action(() => {
    const db = new KeleDatabase();
    const projects = db.listProjects();

    if (projects.length === 0) {
      console.log('🥤 暂无项目。用 kele "你的想法" 创建一个！');
      return;
    }

    console.log(`🥤 项目列表 (${projects.length} 个)\n`);

    for (const project of projects) {
      const subProjects = db.getSubProjects(project.id);
      const tasks = db.getTasks(project.id);
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const failed = tasks.filter((t) => t.status === 'failed').length;
      const total = tasks.length;

      console.log(`📁 ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   想法: ${project.idea.rawText.slice(0, 40)}${project.idea.rawText.length > 40 ? '...' : ''}`);
      console.log(`   子项目: ${subProjects.length} | 任务: ${completed}/${total} 完成${failed > 0 ? `, ${failed} 失败` : ''}`);
      console.log(`   目录: ${project.rootDir}`);
      console.log();
    }
  });

// --- Show command: kele show <project-id> ---
program
  .command('show')
  .argument('<project-id>', 'Project ID')
  .description('Show project details with all tasks')
  .action((projectId: string) => {
    const db = new KeleDatabase();
    const project = db.getProject(projectId);

    if (!project) {
      console.error(`❌ 项目不存在: ${projectId}`);
      console.log('   用 kele list 查看所有项目');
      process.exit(1);
    }

    const subProjects = db.getSubProjects(projectId);
    const tasks = db.getTasks(projectId);

    console.log(`📁 ${project.name}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   想法: ${project.idea.rawText}`);
    console.log(`   类型: ${project.idea.type} | 复杂度: ${project.idea.complexity}`);
    console.log(`   目录: ${project.rootDir}`);
    console.log();

    for (const sp of subProjects) {
      const spTasks = tasks.filter((t) => t.subProjectId === sp.id);
      console.log(`📦 ${sp.name} (${sp.type})`);
      console.log(`   目录: ${sp.targetDir}`);

      for (const task of spTasks) {
        const statusIcon = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : task.status === 'running' ? '🔄' : '⏳';
        const versionInfo = task.version > 1 ? ` v${task.version}` : '';
        const providerInfo = task.aiProvider ? ` [${task.aiProvider}]` : '';
        console.log(`   ${statusIcon} ${task.title}${versionInfo}${providerInfo}`);
        console.log(`      ID: ${task.id}`);
      }
      console.log();
    }
  });

// --- Upgrade command: kele upgrade <project-id> <task-id> <request> ---
program
  .command('upgrade')
  .argument('<project-id>', 'Project ID')
  .argument('<task-id>', 'Task ID to upgrade')
  .argument('<request>', 'Upgrade request, e.g. "change art to pixel style"')
  .description('Upgrade an existing task with new requirements')
  .action(async (projectId: string, taskId: string, request: string) => {
    if (!hasAnyProvider()) {
      printNoProviderHelp();
      return;
    }

    const db = new KeleDatabase();
    const project = db.getProject(projectId);

    if (!project) {
      console.error(`❌ 项目不存在: ${projectId}`);
      process.exit(1);
    }

    const tasks = db.getTasks(projectId);
    const originalTask = tasks.find((t) => t.id === taskId);

    if (!originalTask) {
      console.error(`❌ 任务不存在: ${taskId}`);
      console.log('   用 kele show <project-id> 查看所有任务');
      process.exit(1);
    }

    const subProjects = db.getSubProjects(projectId);
    const subProject = subProjects.find((sp) => sp.id === originalTask.subProjectId);

    if (!subProject) {
      console.error(`❌ 子项目不存在`);
      process.exit(1);
    }

    // Load full project with sub-projects
    const fullProject: Project = {
      ...project,
      subProjects,
      tasks,
    };

    const registry = createRegistryFromConfig();

    const result = await upgradeTask(originalTask, subProject, fullProject, request, {
      registry,
      db,
      onProgress: (msg) => console.log(msg),
    });

    if (result.success) {
      console.log(`\n✨ 升级完成！`);
      console.log(`   项目目录: ${subProject.targetDir}`);
    } else {
      console.log(`\n❌ 升级失败: ${result.error}`);
      process.exit(1);
    }
  });

function printUsage(): void {
  console.log('🥤 kele — 你的创意变现助手\n');
  console.log('用法示例：');
  console.log('  kele "我要做一个塔防游戏并部署到微信小程序赚钱"');
  console.log('  kele "帮我写一首歌并发布到音乐平台" --output ~/my-music');
  console.log('  kele "做一个像牛牛消消乐那样的游戏" --yes');
  console.log('\n管理项目：');
  console.log('  kele list                    列出所有项目');
  console.log('  kele show <project-id>       查看项目详情');
  console.log('  kele upgrade <pid> <tid> "..."  升级某个任务');
  console.log('\n配置 AI：');
  console.log('  kele config --provider kimi --key sk-xxx --url https://api.moonshot.cn/v1 --model moonshot-v1-128k');
  console.log('  kele config --provider kimi-code --key sk-xxx --url https://api.kimi.com/coding/v1 --model kimi-for-coding');
  console.log('  kele config --provider deepseek --key sk-xxx --url https://api.deepseek.com/v1 --model deepseek-chat');
  console.log('\n选项：');
  console.log('  -o, --output <dir>   指定项目生成目录');
  console.log('  -y, --yes            自动执行所有任务（跳过确认）');
  console.log('  -t, --timeout <s>    AI 超时时间（默认 1800 秒 = 30 分钟）');
  console.log('  -v, --version        显示版本号');
}

function printNoProviderHelp(): void {
  console.log('⚠️  未配置 AI API Key');
  console.log('kele 需要调用 AI 来完成任务。请配置至少一个 provider：\n');
  console.log('  kele config --provider kimi --key <your-key> --url https://api.moonshot.cn/v1 --model moonshot-v1-128k');
  console.log('  kele config --provider kimi-code --key <your-key> --url https://api.kimi.com/coding/v1 --model kimi-for-coding');
  console.log('  kele config --provider deepseek --key <your-key> --url https://api.deepseek.com/v1 --model deepseek-chat');
  console.log('  kele config --provider qwen --key <your-key> --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo');
  console.log('\n或者使用 --yes 以 Mock 模式运行（仅用于测试）：');
  console.log('  kele "你的 idea" --yes');
}

program.parse();
