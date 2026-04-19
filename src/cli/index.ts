#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { parseIdea } from '../core/idea-engine.js';
import { incubate } from '../core/incubator.js';
import { planTasks } from '../core/task-planner.js';
import { executeProject } from '../core/executor.js';
import { upgradeTask } from '../core/upgrade-engine.js';
import { parseIntent } from '../core/intent-engine.js';
import { createRegistryFromConfig } from '../adapters/index.js';
import { KeleDatabase } from '../db/index.js';
import { needsResearch, research } from '../core/research-engine.js';
import {
  setProvider,
  removeProvider,
  setDefaultProvider,
  getConfigSummary,
  hasAnyProvider,
  getAutoYes,
  setAutoYes,
} from '../config/index.js';
import {
  setPlatformCredentials,
  getPlatformCredentials,
  hasPlatformCredentials,
  PLATFORM_FIELDS,
  getCredentialPrompt,
} from '../platform-credentials.js';
import {
  formatReleaseInsightForUser,
  formatReleaseChecklist,
} from '../platform-knowledge.js';
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
  .option('-o, --output <dir>', 'Output directory for generated projects', join(homedir(), 'kele-projects'))
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

    // === Intent Engine ===
    const db = new KeleDatabase();
    const registry = createRegistryFromConfig();
    const route = registry.route('medium');
    const intent = await parseIntent(ideaText, route.adapter);

    switch (intent.type) {
      case 'CREATE':
        await handleCreateIntent(intent.idea, options, db);
        break;
      case 'UPGRADE':
        await handleUpgradeIntent(intent.projectQuery, intent.taskQuery || undefined, intent.request, options, db);
        break;
      case 'QUERY':
        await handleQueryIntent(intent.query, db);
        break;
      case 'CONFIG':
        await handleConfigIntent(intent.configType as 'provider' | 'secrets', intent.action);
        break;
      case 'RUN':
        await handleRunIntent(intent.projectQuery, db);
        break;
      case 'CHAT':
        await handleChatIntent(intent.message);
        break;
    }
  });

async function handleCreateIntent(
  ideaText: string,
  options: { output: string; yes: boolean; timeout?: number },
  db: KeleDatabase,
) {
  console.log('🥤 kele 收到了你的想法（创建项目）：');
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

  // Show release insight immediately so user knows what's needed
  if (idea.monetization && idea.monetization !== 'unknown') {
    const insight = formatReleaseInsightForUser(idea.monetization);
    if (insight) {
      console.log(insight);
    }
  }

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

      if (!options.yes && !(await confirmCheckpoint('研究方向是否正确？'))) {
        return;
      }
    }
  }

  // Step 3: Incubate sub-projects
  const projectName = generateProjectSlug(ideaText, idea.type);
  const rootDir = join(options.output, projectName);
  mkdirSync(options.output, { recursive: true });
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
  if (!options.yes && !(await confirmCheckpoint('确认以上子项目计划？'))) {
    return;
  }

  // Step 4: Plan tasks for each sub-project
  const allTasks = [];
  for (const sp of subProjects) {
    const planResult = planTasks(sp, idea);
    if (planResult.success && planResult.tasks) {
      for (const t of planResult.tasks) {
        t.version = 1;
      }
      allTasks.push(...planResult.tasks);
    }
  }

  console.log(`📐 拆解出 ${allTasks.length} 个任务\n`);

  // Checkpoint: confirm tasks
  if (!options.yes && !(await confirmCheckpoint(`确认执行 ${allTasks.length} 个任务？`))) {
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

  const result = await executeProject(project, {
    registry,
    db,
    onProgress: (msg) => console.log(msg),
    timeout: options.timeout,
  });

  console.log(`\n✨ 项目完成！`);
  console.log(`   项目目录: ${rootDir}`);
  console.log(`   任务统计: ${result.completed} 完成, ${result.failed} 失败`);

  await printLocalRunGuide(rootDir);

  console.log(`\n💡 对结果不满意？可以升级任务：`);
  console.log(`   kele upgrade ${project.id} <task-id> "把画面改成像素风"`);
  console.log(`   kele list    # 查看所有项目和任务`);

  if (result.failed > 0) {
    console.log(`\n⚠️  有 ${result.failed} 个任务失败，请检查日志或手动修复。`);
  }

  // Show release checklist if a platform was targeted
  if (idea.monetization && idea.monetization !== 'unknown') {
    const checklist = formatReleaseChecklist(idea.monetization);
    if (checklist) {
      console.log(checklist);
    }
  }
}

async function handleUpgradeIntent(
  projectQuery: string,
  taskQuery: string | undefined,
  request: string,
  options: { yes: boolean; timeout?: number },
  db: KeleDatabase,
) {
  console.log('🥤 kele 识别到升级意图：');
  console.log(`   项目: "${projectQuery}"`);
  if (taskQuery) console.log(`   任务: "${taskQuery}"`);
  console.log(`   需求: "${request}"\n`);

  const projects = db.listProjects();
  if (projects.length === 0) {
    console.log('🥤 暂无项目。用 kele "你的想法" 创建一个！');
    return;
  }

  // Fuzzy match project
  let targetProject = projects.find((p) => p.name.includes(projectQuery) || (p.idea?.keywords?.some((k: string) => projectQuery.includes(k))));
  if (!targetProject && projects.length === 1) {
    targetProject = projects[0];
  }
  if (!targetProject) {
    console.log(`❌ 未找到匹配的项目: "${projectQuery}"`);
    console.log('可用项目:');
    for (const p of projects) {
      console.log(`   • ${p.name} (${p.id})`);
    }
    return;
  }

  const tasks = db.getTasks(targetProject.id);
  let targetTask = tasks[tasks.length - 1];

  if (taskQuery) {
    const matched = tasks.find((t) => t.title.includes(taskQuery) || t.id.includes(taskQuery));
    if (matched) targetTask = matched;
  }

  if (!targetTask) {
    console.log('❌ 该项目没有可升级的任务');
    return;
  }

  if (!options.yes) {
    console.log(`⏸️  CHECKPOINT: 即将升级任务`);
    console.log(`   项目: ${targetProject.name}`);
    console.log(`   任务: ${targetTask.title} (${targetTask.id})`);
    console.log(`   需求: ${request}`);
    console.log('   确认执行请添加 --yes\n');
    return;
  }

  const registry = createRegistryFromConfig();
  const project = db.getProject(targetProject.id);
  if (!project) {
    console.log('❌ 项目数据异常');
    return;
  }
  const subProject = project.subProjects.find((sp) => sp.id === targetTask.subProjectId);
  if (!subProject) {
    console.log('❌ 子项目未找到');
    return;
  }

  const result = await upgradeTask(
    targetTask,
    subProject,
    project,
    request,
    { registry, db, onProgress: (msg: string) => console.log(msg) },
  );

  if (result.success) {
    console.log(`\n✅ 升级完成！`);
  } else {
    console.error(`\n❌ 升级失败: ${result.error}`);
  }
}

async function handleQueryIntent(query: string, db: KeleDatabase) {
  const projects = db.listProjects();
  if (projects.length === 0) {
    console.log('🥤 暂无项目。用 kele "你的想法" 创建一个！');
    return;
  }

  // Check if querying a specific project
  const targetProject = projects.find((p) => p.name.includes(query) || query.includes(p.name));

  if (targetProject) {
    console.log(`🥤 项目详情: ${targetProject.name}\n`);
    console.log(`   ID: ${targetProject.id}`);
    console.log(`   状态: ${targetProject.status}`);
    console.log(`   目录: ${targetProject.rootDir}`);
    console.log(`   创建于: ${targetProject.createdAt}`);

    const tasks = db.getTasks(targetProject.id);
    if (tasks.length > 0) {
      console.log(`\n   任务列表 (${tasks.length}):`);
      for (const t of tasks) {
        const v = t.version > 1 ? ` (v${t.version})` : '';
        console.log(`     [${t.status}] ${t.title}${v}`);
      }
    }
  } else {
    console.log(`🥤 项目列表 (${projects.length} 个)\n`);
    for (const project of projects) {
      const tasks = db.getTasks(project.id);
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const failed = tasks.filter((t) => t.status === 'failed').length;
      console.log(`   ${project.name} — ${tasks.length} 任务 (${completed}✓ ${failed}✗)`);
    }
  }
}

async function handleConfigIntent(configType: 'provider' | 'secrets' | 'unknown', action: string) {
  if (configType === 'provider') {
    console.log(getConfigSummary());
    return;
  }
  if (configType === 'secrets') {
    console.log('🥤 平台凭证管理');
    console.log('   用法: kele secrets --platform <平台名> --set <key>=<value>');
    console.log('   平台: wechat-miniprogram, douyin, steam, app-store, google-play');
    return;
  }
  console.log(`🥤 配置意图: ${action}`);
}

async function handleRunIntent(projectQuery: string | undefined, db: KeleDatabase) {
  const projects = db.listProjects();
  if (projects.length === 0) {
    console.log('🥤 暂无项目。用 kele "你的想法" 创建一个！');
    return;
  }

  let targetProject = projectQuery
    ? projects.find((p) => p.name.includes(projectQuery) || projectQuery.includes(p.name))
    : undefined;

  if (!targetProject) {
    targetProject = projects[projects.length - 1];
  }

  console.log(`🚀 项目: ${targetProject.name}\n`);
  await printLocalRunGuide(targetProject.rootDir);
}

async function handleChatIntent(message: string) {
  const registry = createRegistryFromConfig();
  const route = registry.route('medium');

  console.log('🥤 kele: 让我想想...\n');

  try {
    const response = await route.adapter.execute(
      `你是 kele，一个帮用户把想法变成产品的 AI 助手。请用中文简洁回答以下问题：\n\n${message}`,
    );
    console.log(response);
  } catch (err) {
    console.error('❌ AI 调用失败:', (err as Error).message);
  }
}

/**
 * Interactive checkpoint confirmation.
 * If autoYes is enabled globally, always returns true.
 * Otherwise prompts the user in-terminal.
 */
async function confirmCheckpoint(question: string): Promise<boolean> {
  if (getAutoYes()) {
    return true;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question(`⏸️  ${question} [Y/n/e(edit)] `, resolve);
  });
  rl.close();

  const normalized = answer.trim().toLowerCase();
  if (normalized === 'e' || normalized === 'edit') {
    console.log('   💡 请重新描述你的想法，然后再次运行 kele');
    return false;
  }
  if (normalized === 'n' || normalized === 'no') {
    console.log('   ⏹️  已取消');
    return false;
  }
  // Default: yes (empty, y, yes, or anything else)
  return true;
}

/**
 * Print a local run guide based on what files were generated.
 */
async function printLocalRunGuide(rootDir: string) {
  const pkgPath = join(rootDir, 'package.json');
  const htmlPath = join(rootDir, 'index.html');
  const pyPath = join(rootDir, 'main.py');
  const goPath = join(rootDir, 'main.go');

  console.log('\n🚀 本地运行指南');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (existsSync(pkgPath)) {
    try {
      const pkgRaw = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgRaw);
      const hasDev = pkg.scripts?.dev;
      const hasStart = pkg.scripts?.start;
      console.log(`   cd "${rootDir}"`);
      if (!existsSync(join(rootDir, 'node_modules'))) {
        console.log('   npm install');
      }
      if (hasDev) {
        console.log('   npm run dev');
      } else if (hasStart) {
        console.log('   npm start');
      } else {
        console.log('   npx serve .   # 或 python3 -m http.server 8080');
      }
    } catch {
      console.log(`   cd "${rootDir}"`);
      console.log('   npm install && npm run dev');
    }
  } else if (existsSync(htmlPath)) {
    console.log(`   cd "${rootDir}"`);
    console.log('   python3 -m http.server 8080');
    console.log('   # 然后浏览器打开 http://localhost:8080');
  } else if (existsSync(pyPath)) {
    console.log(`   cd "${rootDir}"`);
    console.log('   python3 main.py');
  } else if (existsSync(goPath)) {
    console.log(`   cd "${rootDir}"`);
    console.log('   go run main.go');
  } else {
    console.log(`   cd "${rootDir}"`);
    console.log('   请查看项目内的 README 文件获取运行方式');
  }

  console.log('\n   配置免确认模式（以后不再询问）：');
  console.log('   kele config --auto-yes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

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
  .option('--auto-yes', 'Enable auto-confirm (skip all checkpoints)')
  .option('--no-auto-yes', 'Disable auto-confirm')
  .action((options: {
    provider?: string;
    key?: string;
    url?: string;
    model?: string;
    header?: Record<string, string>;
    default?: string;
    remove?: string;
    autoYes?: boolean;
  }) => {
    if (options.autoYes === true) {
      setAutoYes(true);
      console.log('✅ 已开启免确认模式（所有 checkpoint 自动通过）');
      return;
    }
    if (options.autoYes === false) {
      setAutoYes(false);
      console.log('✅ 已关闭免确认模式');
      return;
    }

    if (!options.provider && !options.default && !options.remove) {
      console.log('🥤 kele 配置\n');
      console.log(getConfigSummary());
      console.log('\n添加 provider：');
      console.log('  kele config --provider kimi --key sk-xxx --url https://api.moonshot.cn/v1 --model moonshot-v1-128k');
      console.log('  kele config --provider kimi-code --key sk-xxx --url https://api.kimi.com/coding/v1 --model kimi-for-coding');
      console.log('  kele config --provider deepseek --key sk-xxx --url https://api.deepseek.com/v1 --model deepseek-chat');
      console.log('  kele config --provider qwen --key sk-xxx --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo');
      console.log('\n免确认模式（跳过所有 checkpoint）：');
      console.log('  kele config --auto-yes');
      console.log('  kele config --no-auto-yes');
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

// --- Secrets command: kele secrets ---
program
  .command('secrets')
  .description('Manage platform deployment credentials')
  .option('--platform <name>', 'Platform name (wechat-miniprogram, douyin, steam, app-store, google-play)')
  .option('--set <kvs>', 'Set credentials as key=value,key2=value2')
  .action((options: { platform?: string; set?: string }) => {
    if (!options.platform) {
      console.log('🥤 平台凭证管理\n');
      console.log('已配置的平台：');
      for (const platform of Object.keys(PLATFORM_FIELDS)) {
        const ok = hasPlatformCredentials(platform);
        console.log(`  ${ok ? '✅' : '❌'} ${platform}`);
      }
      console.log('\n设置凭证：');
      console.log('  kele secrets --platform wechat-miniprogram --set appId=wx123456789,appSecret=xxx');
      console.log('  kele secrets --platform douyin --set appId=tt123456');
      return;
    }

    if (options.set) {
      const creds: Record<string, string> = {};
      const pairs = options.set.split(',');
      for (const pair of pairs) {
        const [k, v] = pair.split('=');
        if (k && v !== undefined) {
          creds[k.trim()] = v.trim();
        }
      }
      setPlatformCredentials(options.platform, creds);
      console.log(`✅ 已设置 ${options.platform} 凭证`);
      return;
    }

    // Show current credentials (masked)
    const creds = getPlatformCredentials(options.platform);
    if (!creds) {
      console.log(`❌ ${options.platform} 暂无凭证`);
      console.log(getCredentialPrompt(options.platform));
      return;
    }

    console.log(`${options.platform} 凭证：`);
    for (const [k, v] of Object.entries(creds)) {
      const display = v.length > 8 ? v.slice(0, 4) + '****' + v.slice(-4) : '****';
      console.log(`  ${k}: ${display}`);
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
  console.log('\n配置平台凭证：');
  console.log('  kele secrets --platform wechat-miniprogram --set appId=wx123456');
  console.log('\n选项：');
  console.log('  -o, --output <dir>   指定项目生成目录');
  console.log('  -y, --yes            自动执行所有任务（跳过确认）');
  console.log('  -t, --timeout <s>    AI 超时时间（默认 1800 秒 = 30 分钟）');
  console.log('  -v, --version        显示版本号');
}

/**
 * Generate a short English slug for the project directory.
 * Avoids Chinese characters and long sentences.
 */
function generateProjectSlug(ideaText: string, type: string): string {
  // Extract English words (a-z, at least 2 chars)
  const englishWords = ideaText.toLowerCase().match(/[a-z]{2,}/g) || [];

  if (englishWords.length > 0) {
    // Use first 2-3 English words, kebab-cased
    const slug = englishWords.slice(0, 3).join('-');
    return slug;
  }

  // No English words: use type + random hex suffix
  const suffix = randomBytes(3).toString('hex');
  return `${type}-${suffix}`;
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
