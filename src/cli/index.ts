#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseIdea } from '../core/idea-engine.js';
import { incubate } from '../core/incubator.js';
import { incubateWithAI } from '../core/ai-incubator.js';
import { planTasks } from '../core/task-planner.js';
import { executeProject } from '../core/project-executor.js';
import { upgradeTask } from '../core/upgrade-engine.js';
import { parseIntent } from '../core/intent-engine.js';
import { validateTaskOutput } from '../core/task-validator.js';
import { validateGameInBrowser } from '../core/game-validator-browser.js';
import { createRegistryFromConfig } from '../adapters/index.js';
import { createProgressLogger } from '../core/logger.js';
import { runDoctor } from './commands/doctor.js';
import { runClean } from './commands/clean.js';
import { runExport } from './commands/export.js';
import { runInit } from './commands/init.js';
import { runLogs } from './commands/logs.js';
import { runStats } from './commands/stats.js';
import type { AIProvider } from '../types/index.js';
import { KeleDatabase } from '../db/index.js';
import { needsResearch, research } from '../core/research-engine.js';
import {
  setProvider,
  removeProvider,
  setDefaultProvider,
  getConfigSummary,
  hasAnyProvider,
  setAutoYes,
  setTelemetryEnabled,
  setOutputDir,
  getOutputDir,
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
  getDeployCommandGuide,
} from '../platform-knowledge.js';
import { printLocalRunGuide } from './run-guide.js';
import { confirmCheckpoint, generateProjectSlug, printNoProviderHelp } from './utils.js';
import { routeMonetization, formatRouteRecommendations } from '../core/monetization-router.js';
import type { Project, Idea } from '../types/index.js';

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
 * Parse timeout from CLI option.
 * kele principle: no timeouts by default. Wait indefinitely for AI.
 * This option is kept for backward compatibility but has no effect.
 */
function parseTimeout(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) {
    console.warn(`⚠️  Invalid timeout "${value}"`);
    return Infinity as unknown as number;
  }
  return parsed;
}

const program = new Command();

program
  .name('kele')
  .description(`kele v${version} — Idea-to-Monetization AI workflow engine\n\n` +
    `Examples:\n` +
    `  $ kele "做一个塔防游戏"                    # Create a new game\n` +
    `  $ kele "做一个塔防游戏" --mock --yes       # Fast mock mode\n` +
    `  $ kele list                               # List all projects\n` +
    `  $ kele doctor                             # Check setup\n` +
    `  $ kele upgrade <project> <task> "改像素风"  # Upgrade a task\n` +
    `  $ kele retry <project> <task>             # Retry failed task\n` +
    `  $ kele delete <project>                   # Delete a project\n` +
    `  $ kele export <project> [dir]             # Export project files`)
  .version(`${version} (Node ${process.version}, TS 5.9.3, ${process.platform})`, '-v, --version', 'Display version number');

// --- Main command: kele "idea" ---
program
  .argument('[idea]', 'Your idea, e.g. "我要做一个塔防游戏并部署赚钱"')
  .option('-o, --output <dir>', 'Output directory for generated projects', getOutputDir())
  .option('-y, --yes', 'Skip confirmation and auto-execute all tasks', false)
  .option('-t, --timeout <seconds>', 'AI request timeout (kept for compatibility, no effect)', parseTimeout)
  .option('--debug', 'Show all prompts sent to AI for debugging', false)
  .option('--mock', 'Force mock AI mode for fast testing (no API calls)', false)
  .option('--json', 'Output structured JSON instead of human-readable text (for CI/CD)', false)
  .option('--dry-run', 'Show what would be done without executing AI calls', false)
  .option('--quiet', 'Suppress non-error output', false)
  .action(async (ideaText: string | undefined, options: { output: string; yes: boolean; timeout?: number; debug: boolean; mock: boolean; json: boolean; dryRun: boolean; quiet: boolean }) => {
    if (options.quiet) {
      const originalLog = console.log;
      console.log = () => {};
      process.on('exit', () => { console.log = originalLog; });
    }
    if (options.debug) {
      const { setDebug } = await import('../debug.js');
      setDebug(true);
      console.log('🔍 Debug mode enabled — all AI prompts will be logged\n');
    }
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
    if (options.mock) {
      const mockAdapter = registry.get('mock')!;
      registry.route = () => ({ provider: 'mock' as AIProvider, adapter: mockAdapter });
    }
    const route = registry.route('medium');
    const intent = await parseIntent(ideaText, route.adapter);

    if (options.dryRun) {
      console.log('🔍 [DRY RUN] 将执行以下操作（未实际运行）：');
      console.log(`   意图: ${intent.type}`);
      if (intent.type === 'CREATE') console.log(`   项目: ${intent.idea || ideaText}`);
      if (intent.type === 'UPGRADE') console.log(`   升级: ${intent.projectQuery} -> ${intent.request}`);
      console.log('   使用 --dry-run 预览，移除该参数以实际执行');
      return;
    }

    switch (intent.type) {
      case 'CREATE':
        await handleCreateIntent(intent.idea, options, db, options.mock);
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
      case 'RESUME':
        await handleResumeIntent(intent.projectQuery, db);
        break;
      case 'CHAT':
        await handleChatIntent(intent.message);
        break;
    }
  });

async function handleCreateIntent(
  ideaText: string,
  options: { output: string; yes: boolean; timeout?: number; json?: boolean },
  db: KeleDatabase,
  useMock: boolean = false,
) {
  const logger = createProgressLogger(options.json || false);

  logger.log('🥤 kele 收到了你的想法（创建项目）：');
  logger.log(`   "${ideaText}"\n`);

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

  // Show monetization route recommendations
  const routes = routeMonetization(idea);
  console.log(formatRouteRecommendations(routes));

  // If user didn't explicitly specify a platform, default to the top recommendation
  const topRoute = routes[0];
  if (idea.monetization === 'unknown' && topRoute) {
    idea.monetization = topRoute.platform as Idea['monetization'];
    console.log(`   kele 已自动选择最优路径: ${topRoute.platformLabel}\n`);
  }

  // Interactive confirmation: let user switch platform if they want
  const selectedRoute = routes.find((r) => r.platform === idea.monetization) || topRoute;
  if (selectedRoute) {
    console.log(`💰 确认变现路径: ${selectedRoute.platformLabel}`);
    console.log(`   收益模式: ${selectedRoute.revenueModel}`);
    console.log(`   收款方式: ${selectedRoute.payoutMethod}`);
    console.log(`   预估收益: ${selectedRoute.estimatedRevenue}`);
    console.log();

    if (!options.yes && !(await confirmCheckpoint(`确认使用 ${selectedRoute.platformLabel} 变现？`))) {
      return;
    }
  }

  // Show release insight for the selected platform
  if (idea.monetization && idea.monetization !== 'unknown') {
    const insight = formatReleaseInsightForUser(idea.monetization);
    if (insight) {
      console.log(insight);
    }
  }

  const registry = createRegistryFromConfig();
  if (useMock) {
    const mockAdapter = registry.get('mock')!;
    registry.route = () => ({ provider: 'mock' as AIProvider, adapter: mockAdapter });
  }
  const route = registry.route('medium');

  // Test provider connectivity before starting
  if (!useMock) {
    console.log(`   🔌 检测 ${route.provider} 连接...`);
    logger.debug('Testing provider connection', { provider: route.provider });
    const testResult = await route.adapter.testConnection();
    if (!testResult.ok) {
      console.error(`\n❌ ${route.provider} 连接失败: ${testResult.error}`);
      console.error('\n可能的解决方案：');
      console.error('  1. 检查 API key 是否正确: kele config --provider <name> --key <key>');
      console.error('  2. 检查网络连接');
      console.error('  3. 使用 --yes 以 Mock 模式运行（仅用于测试）');
      console.error(`\n当前配置:\n${getConfigSummary()}`);
      process.exit(1);
    }
    console.log(`   ✅ ${route.provider} 连接正常\n`);
    logger.debug('Provider connection successful', { provider: route.provider });
  }

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
      if (report.productAnalysis) {
        console.log(`\n📌 产品分析:`);
        console.log(report.productAnalysis.slice(0, 300) + (report.productAnalysis.length > 300 ? '...' : ''));
      }
      if (report.monetizationAnalysis) {
        console.log(`\n💰 变现分析:`);
        console.log(report.monetizationAnalysis.slice(0, 300) + (report.monetizationAnalysis.length > 300 ? '...' : ''));
      }
      if (report.recommendations) {
        console.log(`\n💡 核心建议:`);
        console.log(report.recommendations.slice(0, 400) + (report.recommendations.length > 400 ? '...' : ''));
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (!options.yes && !(await confirmCheckpoint('研究方向是否正确？'))) {
        return;
      }
    } else {
      console.log('   ⚠️  研究未返回有效内容，跳过此步骤\n');
    }
  }

  // Step 3: Incubate sub-projects (AI-driven, fallback to local rules)
  const projectName = generateProjectSlug(ideaText, idea.type);
  const rootDir = join(options.output, projectName);
  mkdirSync(options.output, { recursive: true });

  console.log('🧠 AI 正在分析项目结构...\n');
  let incubateResult = await incubateWithAI(idea, rootDir, route.adapter);

  if (!incubateResult.success) {
    const mock = registry.get('mock');
    if (mock && route.provider !== 'mock') {
      console.log(`   ⚠️  AI incubator failed: ${incubateResult.error?.slice(0, 80)}`);
      console.log('   🔄 Falling back to mock incubator...');
      incubateResult = await incubateWithAI(idea, rootDir, mock);
    }
  }

  if (!incubateResult.success || !incubateResult.subProjects) {
    console.log('   ⚠️  AI incubator unavailable, using default structure');
    const fallback = incubate(idea, rootDir);
    incubateResult = {
      success: fallback.success,
      subProjects: fallback.subProjects,
      error: fallback.error,
    };
  }

  if (!incubateResult.success || !incubateResult.subProjects) {
    console.error('❌ 孵化失败：', incubateResult.error);
    process.exit(1);
  }

  const subProjects = incubateResult.subProjects;
  logger.debug('Incubation result', {
    subProjectCount: subProjects.length,
    reasoningLength: incubateResult.reasoning?.length,
    provider: route.provider,
  });
  if (incubateResult.reasoning) {
    console.log(`💡 AI 设计思路: ${incubateResult.reasoning}`);
  }

  // Display monetization path
  if (incubateResult.monetizationPath) {
    console.log(`\n💰 变现路径:`);
    console.log(`   ${incubateResult.monetizationPath}`);
  }

  // Display risk assessment
  if (incubateResult.riskAssessment) {
    const ra = incubateResult.riskAssessment;
    console.log(`\n⚠️  风险评估:`);
    if (ra.technicalRisks?.length) {
      console.log(`   技术风险: ${ra.technicalRisks.join('; ')}`);
    }
    if (ra.marketRisks?.length) {
      console.log(`   市场风险: ${ra.marketRisks.join('; ')}`);
    }
    if (ra.timeRisks?.length) {
      console.log(`   时间风险: ${ra.timeRisks.join('; ')}`);
    }
    if (ra.mitigation) {
      console.log(`   缓解方案: ${ra.mitigation}`);
    }
  }

  // Display self-review notes
  if (incubateResult.selfReviewNotes) {
    console.log(`\n🔍 AI 自我审查:`);
    console.log(`   ${incubateResult.selfReviewNotes}`);
  }

  // Display validation results (Phase 2)
  if (incubateResult.validation) {
    const v = incubateResult.validation;
    console.log(`\n🛡️  孵化器质检报告:`);
    if (v.localValid) {
      console.log(`   ✅ 结构验证通过`);
    } else {
      console.log(`   ❌ 结构验证失败: ${v.localErrors.join('; ')}`);
    }
    if (v.localWarnings.length > 0) {
      console.log(`   ⚠️  警告: ${v.localWarnings.join('; ')}`);
    }
    if (v.revisions > 0) {
      console.log(`   🔄 AI 修正轮数: ${v.revisions}`);
    }
    if (v.aiApproved) {
      console.log(`   ✅ AI 审查通过`);
    } else {
      console.log(`   ⚠️  AI 审查发现问题: ${v.aiIssues.join('; ')}`);
    }
  }

  console.log(`\n🥚 孵化出 ${subProjects.length} 个子项目：`);
  for (const sp of subProjects) {
    const relevanceIcon = sp.monetizationRelevance === 'core' ? '🔴' : sp.monetizationRelevance === 'supporting' ? '🟡' : '⚪';
    const criticalIcon = sp.criticalPath ? '⏱️' : '';
    const riskIcon = sp.riskLevel === 'high' ? '🔥' : sp.riskLevel === 'medium' ? '⚡' : '';
    console.log(`   ${relevanceIcon} ${sp.name} ${criticalIcon}${riskIcon}`);
    console.log(`      类型: ${sp.type}${sp.estimatedEffort ? ` | 预估: ${sp.estimatedEffort}` : ''}${sp.riskLevel ? ` | 风险: ${sp.riskLevel}` : ''}`);
    if (sp.dependencies.length > 0) {
      console.log(`      依赖: ${sp.dependencies.join(', ')}`);
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

  // Setup graceful abort handling
  const abortController = new AbortController();
  const sigintHandler = () => {
    console.log('\n\n⏹️  收到中断信号，正在安全退出...');
    console.log('   当前任务状态已保存到数据库');
    console.log('   之后可以用 kele "继续" 或 kele "接着干" 恢复');
    abortController.abort();
    // CRITICAL: Custom SIGINT handler overrides Node.js default (exit process).
    // Async operations (stream readers, unclosed connections) may hang the event loop.
    // Give code 100ms to clean up, then force exit.
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigintHandler);

  const result = await executeProject(project, {
    registry,
    db,
    onProgress: (msg) => console.log(msg),
    timeout: options.timeout,
    signal: abortController.signal,
  });

  process.off('SIGINT', sigintHandler);
  process.off('SIGTERM', sigintHandler);

  if (result.aborted) {
    console.log('\n⏹️  执行已中断');
    console.log(`   项目目录: ${rootDir}`);
    console.log('   使用 kele "继续" 或 kele "接着干" 恢复');
    return;
  }

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

  // Show deploy command guide after project completion
  if (idea.monetization && idea.monetization !== 'unknown') {
    const deployGuide = getDeployCommandGuide(idea.monetization, rootDir);
    if (deployGuide) {
      console.log(deployGuide);
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

async function handleResumeIntent(projectQuery: string | undefined, db: KeleDatabase) {
  const projects = db.listProjects();
  if (projects.length === 0) {
    console.log('🥤 暂无项目。用 kele "你的想法" 创建一个！');
    return;
  }

  // Find project with running tasks, or the most recent project
  let targetProject: Project | undefined;

  if (projectQuery) {
    targetProject = projects.find((p) => p.name.includes(projectQuery) || projectQuery.includes(p.name));
  }

  if (!targetProject) {
    // Check for projects with running tasks
    for (const p of projects) {
      const tasks = db.getTasks(p.id);
      if (tasks.some((t) => t.status === 'running' || t.status === 'pending')) {
        targetProject = p;
        break;
      }
    }
  }

  if (!targetProject) {
    targetProject = projects[projects.length - 1];
  }

  const tasks = db.getTasks(targetProject.id);
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;

  console.log(`🔄 恢复项目: ${targetProject.name}`);
  console.log(`   任务进度: ${completed} 完成 / ${running} 进行中 / ${pending} 待执行 / ${failed} 失败\n`);

  if (pending === 0 && running === 0) {
    console.log('✅ 所有任务已完成！');
    await printLocalRunGuide(targetProject.rootDir);
    return;
  }

  // Reset running tasks back to pending so they can be re-executed
  for (const task of tasks) {
    if (task.status === 'running') {
      task.status = 'pending';
      db.saveTask(task, targetProject.id);
    }
  }

  const registry = createRegistryFromConfig();

  // Re-assemble project with updated tasks
  const project: Project = {
    ...targetProject,
    subProjects: db.getSubProjects(targetProject.id),
    tasks: db.getTasks(targetProject.id),
  };

  // Setup abort handling
  const abortController = new AbortController();
  const sigintHandler = () => {
    console.log('\n\n⏹️  收到中断信号，正在安全退出...');
    console.log('   当前任务状态已保存到数据库');
    console.log('   之后可以用 kele "继续" 或 kele "接着干" 恢复');
    abortController.abort();
  };
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigintHandler);

  const result = await executeProject(project, {
    registry,
    db,
    onProgress: (msg) => console.log(msg),
    signal: abortController.signal,
  });

  process.off('SIGINT', sigintHandler);
  process.off('SIGTERM', sigintHandler);

  if (result.aborted) {
    console.log('\n⏹️  执行已中断');
    console.log(`   项目目录: ${project.rootDir}`);
    console.log('   用 kele "继续" 或 kele "接着干" 恢复');
    return;
  }

  console.log(`\n✨ 项目完成！`);
  console.log(`   项目目录: ${project.rootDir}`);
  console.log(`   任务统计: ${result.completed} 完成, ${result.failed} 失败`);

  await printLocalRunGuide(project.rootDir);

  if (targetProject.idea.monetization && targetProject.idea.monetization !== 'unknown') {
    const checklist = formatReleaseChecklist(targetProject.idea.monetization);
    if (checklist) {
      console.log(checklist);
    }
  }
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
    const chatPrompt = `你是 kele，一个帮用户把想法变成产品的 AI 助手。请用中文简洁回答以下问题：\n\n${message}`;
    const { debugLog } = await import('../debug.js');
    debugLog('Chat Prompt', chatPrompt);
    const response = await route.adapter.execute(chatPrompt);
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
  .option('--telemetry', 'Enable telemetry collection')
  .option('--no-telemetry', 'Disable telemetry collection')
  .option('--output-dir <dir>', 'Set default output directory for projects')
  .option('--list', 'List all configured providers')
  .action((options: {
    provider?: string;
    key?: string;
    url?: string;
    model?: string;
    header?: Record<string, string>;
    default?: string;
    remove?: string;
    autoYes?: boolean;
    telemetry?: boolean;
    outputDir?: string;
    list?: boolean;
  }) => {
    if (options.list) {
      console.log('🥤 已配置的 Providers\n');
      console.log(getConfigSummary());
      return;
    }

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

    if (options.telemetry === true) {
      setTelemetryEnabled(true);
      console.log('✅ 已开启遥测数据收集');
      return;
    }
    if (options.telemetry === false) {
      setTelemetryEnabled(false);
      console.log('✅ 已关闭遥测数据收集');
      return;
    }

    if (options.outputDir) {
      setOutputDir(options.outputDir);
      console.log(`✅ 默认输出目录已设为: ${options.outputDir}`);
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
  .option('--status <status>', 'Filter by status (pending, executing, completed, failed)')
  .option('--type <type>', 'Filter by type (game, tool, bot, etc.)')
  .action((opts: { status?: string; type?: string }) => {
    const db = new KeleDatabase();
    let projects = db.listProjects();

    if (opts.status) {
      projects = projects.filter((p) => p.status === opts.status);
    }
    if (opts.type) {
      projects = projects.filter((p) => p.idea.type === opts.type);
    }

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

// --- Delete command: kele delete <project-id> ---
program
  .command('delete')
  .argument('<project-id>', 'Project ID to delete')
  .description('Delete a project and all its data')
  .option('--force', 'Skip confirmation and delete project files too', false)
  .action((projectId: string, opts: { force?: boolean }) => {
    const db = new KeleDatabase();
    const project = db.getProject(projectId);

    if (!project) {
      console.error(`❌ 项目不存在: ${projectId}`);
      console.log('   用 kele list 查看所有项目');
      process.exit(1);
    }

    if (!opts.force) {
      console.log(`⚠️  即将删除项目: ${project.name}`);
      console.log(`   ID: ${project.id}`);
      console.log(`   目录: ${project.rootDir}`);
      console.log();
    }

    db.deleteProject(projectId);

    if (opts.force) {
      try {
        const { rmSync } = require('fs');
        rmSync(project.rootDir, { recursive: true, force: true });
        console.log(`✅ 项目已彻底删除: ${project.name}`);
      } catch {
        console.log(`✅ 数据库记录已删除，但文件清理失败: ${project.rootDir}`);
      }
    } else {
      console.log(`✅ 项目已删除: ${project.name}`);
      console.log(`   💡 提示: 项目文件仍保留在 ${project.rootDir}`);
      console.log(`      如需彻底清理，请手动删除该目录。`);
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
  .option('-t, --timeout <seconds>', 'AI request timeout (kept for compatibility, no effect)', parseTimeout)
  .option('--mock', 'Force mock AI mode for fast testing', false)
  .option('--debug', 'Show all prompts sent to AI for debugging', false)
  .action(async (projectId: string, taskId: string, request: string, options: { timeout?: number; debug: boolean; mock: boolean }) => {
    if (options.debug) {
      const { setDebug } = await import('../debug.js');
      setDebug(true);
      console.log('🔍 Debug mode enabled — all AI prompts will be logged\n');
    }
    if (!hasAnyProvider()) {
      printNoProviderHelp();
      return;
    }
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
    if (options.mock) {
      const mockAdapter = registry.get('mock')!;
      registry.route = () => ({ provider: 'mock' as AIProvider, adapter: mockAdapter });
    }

    const result = await upgradeTask(originalTask, subProject, fullProject, request, {
      registry,
      db,
      onProgress: (msg) => console.log(msg),
      timeout: options.timeout,
    });

    if (result.success) {
      console.log(`\n✨ 升级完成！`);
      console.log(`   项目目录: ${subProject.targetDir}`);
    } else {
      console.log(`\n❌ 升级失败: ${result.error}`);
      process.exit(1);
    }
  });

// --- Search command: kele search <query> ---
program
  .command('search')
  .argument('<query>', 'Search query for projects')
  .description('Search projects by name or keywords')
  .option('--type <type>', 'Filter by project type (game, tool, bot, etc.)')
  .action((query: string, opts: { type?: string }) => {
    const db = new KeleDatabase();
    const projects = db.listProjects();
    const lowerQuery = query.toLowerCase();
    let matches = projects.filter((p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.idea?.keywords?.some((k: string) => k.toLowerCase().includes(lowerQuery)) ||
      p.idea?.rawText?.toLowerCase().includes(lowerQuery)
    );
    if (opts.type) {
      matches = matches.filter((p) => p.idea.type === opts.type);
    }
    if (matches.length === 0) {
      console.log(`🔍 未找到匹配 "${query}" 的项目`);
      return;
    }
    console.log(`🔍 找到 ${matches.length} 个匹配项目:\n`);
    for (const p of matches) {
      console.log(`  📁 ${p.name} (${p.id})`);
      console.log(`     ${p.idea?.rawText?.slice(0, 60) || 'No description'}...`);
    }
  });

// --- Retry command: kele retry <project-id> [task-id] ---
program
  .command('retry')
  .argument('<project-id>', 'Project ID')
  .argument('[task-id]', 'Task ID to retry (omit with --all to retry all failed tasks)')
  .description('Retry a failed task without re-running the entire project')
  .option('-t, --timeout <seconds>', 'AI request timeout (kept for compatibility, no effect)', parseTimeout)
  .option('--mock', 'Force mock AI mode for fast testing', false)
  .option('--all', 'Retry all failed tasks in the project', false)
  .option('--force', 'Retry even if task is not in failed status', false)
  .action(async (projectId: string, taskId: string | undefined, options: { timeout?: number; mock: boolean; all: boolean; force: boolean }) => {
    const db = new KeleDatabase();
    const project = db.getProject(projectId);

    if (!project) {
      console.error(`❌ 项目不存在: ${projectId}`);
      process.exit(1);
    }

    const tasks = db.getTasks(projectId);
    const subProjects = db.getSubProjects(projectId);

    let tasksToRetry: typeof tasks;

    if (options.all) {
      tasksToRetry = tasks.filter((t) => t.status === 'failed');
      if (tasksToRetry.length === 0) {
        console.log('✅ 没有失败的任务需要重试。');
        return;
      }
      console.log(`🔄 批量重试 ${tasksToRetry.length} 个失败任务...\n`);
    } else {
      if (!taskId) {
        console.error('❌ 请提供 task-id 或使用 --all 重试所有失败任务');
        process.exit(1);
      }
      const task = tasks.find((t) => t.id === taskId);
      if (!task) {
        console.error(`❌ 任务不存在: ${taskId}`);
        console.log('   用 kele show <project-id> 查看所有任务');
        process.exit(1);
      }
      if (task.status !== 'failed' && !options.force) {
        console.log(`⚠️  任务状态为 ${task.status}，不是失败状态。只有失败的任务才能 retry。使用 --force 强制重试。`);
        process.exit(1);
      }
      tasksToRetry = [task];
      const subProject = subProjects.find((sp) => sp.id === task.subProjectId);
      console.log(`🔄 重试任务: ${task.title}`);
      console.log(`   项目: ${project.name}`);
      console.log(`   子项目: ${subProject?.name ?? 'unknown'}`);
      console.log();
    }

    // Reset all failed tasks to pending
    for (const task of tasksToRetry) {
      task.status = 'pending';
      db.saveTask(task, projectId);
    }

    const fullProject: Project = {
      ...project,
      subProjects,
      tasks,
    };

    const registry = createRegistryFromConfig();
    if (options.mock) {
      const mockAdapter = registry.get('mock')!;
      registry.route = () => ({ provider: 'mock' as AIProvider, adapter: mockAdapter });
    }

    const result = await executeProject(fullProject, {
      registry,
      db,
      onProgress: (msg) => console.log(msg),
      timeout: options.timeout,
    });

    if (result.failed === 0 && !result.aborted) {
      console.log(`\n✅ 重试完成！${result.completed} 个任务成功完成。`);
    } else if (result.aborted) {
      console.log(`\n⏹️  重试被中断。已完成 ${result.completed} 个任务。`);
    } else {
      console.log(`\n❌ 重试完成，但有 ${result.failed} 个任务失败。`);
      process.exit(1);
    }
  });

// --- Validate command: kele validate <project-id> ---
program
  .command('validate')
  .argument('<project-id>', 'Project ID to validate')
  .description('Validate project quality and output a score report')
  .option('--fix', 'Auto-fix issues by retrying failed tasks')
  .action(async (projectId: string, opts: { fix?: boolean }) => {
    const db = new KeleDatabase();
    const project = db.getProject(projectId);

    if (!project) {
      console.error(`❌ 项目不存在: ${projectId}`);
      process.exit(1);
    }

    const subProjects = db.getSubProjects(projectId);
    console.log(`🔍 验证项目: ${project.name}\n`);

    let totalScore = 0;
    let spCount = 0;

    for (const sp of subProjects) {
      spCount++;
      console.log(`  📁 ${sp.name}`);
      const staticResult = validateTaskOutput(sp.targetDir, sp.name);
      const staticScore = staticResult.valid ? 100 : Math.max(0, 100 - staticResult.issues.length * 10);
      console.log(`     静态检查: ${staticResult.valid ? '✅' : '⚠️'} (${staticScore}/100)`);
      if (staticResult.issues.length > 0) {
        for (const issue of staticResult.issues.slice(0, 3)) {
          console.log(`       - ${issue}`);
        }
      }

      let browserScore = staticScore;
      if (project.idea.type === 'game') {
        const browserResult = validateGameInBrowser(sp.targetDir);
        browserScore = browserResult.score;
        console.log(`     游戏验证: ${browserResult.playable ? '✅' : '⚠️'} (${browserScore}/100)`);
        if (browserResult.errors.length > 0) {
          for (const err of browserResult.errors.slice(0, 3)) {
            console.log(`       - ${err}`);
          }
        }
      }

      // PWA validation for web projects
      if (project.idea.monetization === 'web' || project.idea.monetization === 'unknown') {
        const hasManifest = existsSync(join(sp.targetDir, 'manifest.json'));
        const hasSW = existsSync(join(sp.targetDir, 'sw.js'));
        if (hasManifest || hasSW) {
          console.log(`     PWA 支持: ${hasManifest ? '✅ manifest' : '⚠️ manifest'} ${hasSW ? '✅ sw.js' : '⚠️ sw.js'}`);
        }
      }

      totalScore += browserScore;
    }

    const avgScore = spCount > 0 ? Math.round(totalScore / spCount) : 0;
    console.log(`\n📊 项目总分: ${avgScore}/100`);
    if (avgScore >= 90) {
      console.log('   🏆 优秀 — 项目质量很高');
    } else if (avgScore >= 70) {
      console.log('   ✅ 良好 — 项目可以正常运行');
    } else if (avgScore >= 50) {
      console.log('   ⚠️  一般 — 建议用 kele upgrade 改进');
    } else {
      console.log('   ❌ 较差 — 建议用 kele retry 重试');
    }

    if (opts.fix && avgScore < 80) {
      console.log('\n🔧 --fix 模式: 自动修复低分任务...');
      const tasks = db.getTasks(projectId).filter(t => t.status === 'failed' || t.status === 'completed');
      const lowScoreTasks = tasks.filter(t => {
        const sp = subProjects.find(s => s.id === t.subProjectId);
        if (!sp) return false;
        const r = validateTaskOutput(sp.targetDir, sp.name);
        return !r.valid;
      });
      if (lowScoreTasks.length > 0) {
        console.log(`   发现 ${lowScoreTasks.length} 个需要修复的任务`);
        for (const t of lowScoreTasks) {
          console.log(`   → 运行: kele retry ${projectId} ${t.id}`);
        }
      } else {
        console.log('   所有任务静态检查通过，无需修复');
      }
    }
  });

// --- Doctor command: kele doctor ---
program
  .command('doctor')
  .description('Diagnose environment and configuration issues')
  .option('--fix', 'Auto-fix common issues (create directories, default config)')
  .action((opts: { fix?: boolean }) => {
    runDoctor(opts.fix);
  });

// --- Clean command: kele clean ---
program
  .command('clean')
  .description('List failed/abandoned projects for cleanup')
  .option('--delete', 'Auto-delete failed/abandoned projects')
  .option('--debug-logs', 'Clean debug log files from ~/.kele/debug')
  .action((opts: { delete?: boolean; debugLogs?: boolean }) => {
    runClean(opts.delete, opts.debugLogs);
  });

// --- Export command: kele export <project-id> [target-dir] ---
program
  .command('export')
  .argument('<project-id>', 'Project ID to export')
  .argument('[target-dir]', 'Target directory (default: ./<project-name>-export)')
  .description('Export a project to a directory')
  .option('--format <type>', 'Export format: dir (default) or markdown')
  .action((projectId: string, targetDir?: string, opts?: { format?: string }) => {
    const format = opts?.format === 'markdown' ? 'markdown' : 'dir';
    runExport(projectId, targetDir, format);
  });

// --- Init command: kele init [dir] ---
program
  .command('init')
  .argument('[dir]', 'Directory to initialize (default: current directory)')
  .description('Initialize kele in an existing project directory')
  .action((dir?: string) => {
    runInit(dir);
  });

// --- Logs command: kele logs ---
program
  .command('logs')
  .option('-n, --lines <number>', 'Number of lines to show', '20')
  .description('View recent log entries')
  .action((options: { lines: string }) => {
    runLogs(parseInt(options.lines, 10));
  });

// --- Stats command: kele stats ---
program
  .command('stats')
  .description('Show usage statistics')
  .option('--format <type>', 'Output format: text (default) or json', 'text')
  .action((options: { format: string }) => {
    runStats(options.format === 'json');
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
  console.log('  kele "继续" 或 kele "接着干"    恢复中断的项目');
  console.log('\n配置 AI：');
  console.log('  kele config --provider kimi --key sk-xxx --url https://api.moonshot.cn/v1 --model moonshot-v1-128k');
  console.log('  kele config --provider kimi-code --key sk-xxx --url https://api.kimi.com/coding/v1 --model kimi-for-coding');
  console.log('  kele config --provider deepseek --key sk-xxx --url https://api.deepseek.com/v1 --model deepseek-chat');
  console.log('\n配置平台凭证：');
  console.log('  kele secrets --platform wechat-miniprogram --set appId=wx123456');
  console.log('\n选项：');
  console.log('  -o, --output <dir>   指定项目生成目录');
  console.log('  -y, --yes            自动执行所有任务（跳过确认）');
  console.log('  -t, --timeout <s>    AI 超时时间（已废弃，kele 永不超时）');
  console.log('  --debug              显示 kele 发给 AI 的所有 prompt');
  console.log('  -v, --version        显示版本号');
}

/**
 * Generate a short English slug for the project directory.
 * Avoids Chinese characters and long sentences.
 */
program.parse();
