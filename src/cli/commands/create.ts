/**
 * kele create — main command: kele "idea" and all intent handlers.
 */

import { Command } from 'commander';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { parseIdea } from '../../core/idea-engine.js';
import { incubate } from '../../core/incubator.js';
import { incubateWithAI } from '../../core/ai-incubator.js';
import { matchContract } from '../../core/contract-engine.js';
import { planTasks } from '../../core/task-planner.js';
import { executeProject } from '../../core/project-executor.js';
import { parseIntent } from '../../core/intent-engine.js';
import { QuickModeEngine } from '../../core/quick-mode.js';
import { ProviderFallback } from '../../core/provider-fallback.js';
import { FunctionLevelFixer } from '../../core/function-level-fixer.js';
import { PlayabilityValidator } from '../../core/playability-validator.js';
import { createRegistryFromConfig } from '../../adapters/index.js';
import { createProgressLogger } from '../../core/logger.js';
import { needsResearch, research } from '../../core/research-engine.js';
import { routeMonetization, formatRouteRecommendations } from '../../core/monetization-router.js';
import { generateProductPartnerReport, formatProductPartnerReport } from '../../core/product-partner.js';
import { formatReleaseInsightForUser, getDeployCommandGuide } from '../../platform-knowledge.js';
import { printLocalRunGuide } from '../run-guide.js';
import { confirmCheckpoint, generateProjectSlug, printNoProviderHelp, parseTimeout, printUsage } from '../utils.js';
import { getConfigSummary, hasAnyProvider } from '../../config/index.js';
import type { AIProvider } from '../../types/index.js';
import type { Project, Idea } from '../../types/index.js';
import { KeleDatabase } from '../../db/index.js';
import { handleResumeIntent } from './resume.js';

export function setupCreateCommand(program: Command): void {
  program
    .argument('[idea]', 'Your idea, e.g. "我要做一个塔防游戏并部署赚钱"')
    .option('-o, --output <dir>', 'Output directory for generated projects')
    .option('-y, --yes', 'Skip confirmation and auto-execute all tasks', false)
    .option('-t, --timeout <seconds>', 'AI request timeout (kept for compatibility, no effect)', parseTimeout)
    .option('--debug', 'Show all prompts sent to AI for debugging', false)
    .option('--mock', 'Force mock AI mode for fast testing (no API calls)', false)
    .option('--json', 'Output structured JSON instead of human-readable text (for CI/CD)', false)
    .option('--dry-run', 'Show what would be done without executing AI calls', false)
    .option('--recovery-mode <mode>', 'Failure recovery: auto, skip, interactive (default)', 'interactive')
    .option('--skip-partner', 'Skip Product Partner analysis (competitor + monetization + virality)', false)
    .option('--full', 'Force full Incubator mode (skip quick mode)', false)
    .option('--quiet', 'Suppress non-error output', false)
    .action(async (ideaText: string | undefined, options: { output?: string; yes: boolean; timeout?: number; debug: boolean; mock: boolean; json: boolean; dryRun: boolean; quiet: boolean; recoveryMode?: string; skipPartner?: boolean; full?: boolean }) => {
      if (options.quiet) {
        const originalLog = console.log;
        console.log = () => {};
        process.on('exit', () => { console.log = originalLog; });
      }
      if (options.debug) {
        const { setDebug } = await import('../../debug.js');
        setDebug(true);
        console.log('🔍 Debug mode enabled — all AI prompts will be logged\n');
      }
      if (!ideaText || ideaText.trim().length === 0) {
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
}

async function handleCreateIntent(
  ideaText: string,
  options: { output?: string; yes: boolean; timeout?: number; json?: boolean; skipPartner?: boolean; recoveryMode?: string; full?: boolean },
  db: KeleDatabase,
  useMock: boolean = false,
) {
  const logger = createProgressLogger(options.json || false);

  logger.log('🥤 kele 收到了你的想法（创建项目）：');
  logger.log(`   "${ideaText}"\n`);

  // ── Step 0: Quick Mode (default path for simple games) ──
  const projectName = generateProjectSlug(ideaText, 'game');
  const outputDir = options.output || join(process.env.HOME || process.env.USERPROFILE || '.', 'kele-projects');
  const rootDir = join(outputDir, projectName);
  mkdirSync(outputDir, { recursive: true });

  const registry = createRegistryFromConfig();
  let fallback: ProviderFallback;
  if (useMock) {
    const mockAdapter = registry.get('mock')!;
    registry.route = () => ({ provider: 'mock' as AIProvider, adapter: mockAdapter });
    fallback = new ProviderFallback([mockAdapter]);
  } else {
    fallback = new ProviderFallback(registry.getAllAvailableAdapters());
  }
  const quickMode = new QuickModeEngine(fallback, rootDir);

  if (!options.full && quickMode.isSimpleGame(ideaText)) {
    console.log('🚀 快速模式：生成单文件游戏...');
    console.log('   （简单游戏跳过 AI Incubator，直接生成可玩代码）');

    try {
      // 1. Generate code
      const result = await quickMode.execute(ideaText);
      if (!result.success) {
        console.log('❌ 快速模式生成失败:', result.error);
        console.log('💡 建议: 使用 --full 参数强制使用复杂模式（AI Incubator）');
        process.exit(1);
      }

      console.log(`✅ 生成完成: ${result.filePath}`);

      // 2. Function-level fix
      console.log('🔧 检查并修复空函数...');
      const fixer = new FunctionLevelFixer(fallback.getPrimary());
      await fixer.fixFile(result.filePath, ideaText);

      // 3. Playability validation
      console.log('🎮 验证游戏可玩性...');
      const validator = new PlayabilityValidator(rootDir);
      let playability = await validator.validate('index.html');

      console.log(`📊 可玩性评分: ${playability.score}/100`);
      playability.details.forEach((d) => console.log('  ' + d));

      if (playability.playable) {
        console.log('✅ 游戏生成完成且可玩！');
        console.log(`📂 文件位置: ${result.filePath}`);
        console.log('💡 提示: 用浏览器打开 index.html 即可游玩');
        await printLocalRunGuide(rootDir);
        return;
      }

      // 4. Retry fix + validation once
      console.log('⚠️ 可玩性验证未通过，尝试修复...');
      const fixed = await fixer.fixFile(result.filePath, ideaText);
      if (fixed) {
        const retry = await validator.validate('index.html');
        console.log(`📊 修复后可玩性评分: ${retry.score}/100`);
        retry.details.forEach((d) => console.log('  ' + d));
        if (retry.playable) {
          console.log('✅ 修复后验证通过！');
          console.log(`📂 文件位置: ${result.filePath}`);
          console.log('💡 提示: 用浏览器打开 index.html 即可游玩');
          await printLocalRunGuide(rootDir);
          return;
        }
      }

      console.log('❌ 快速模式验证未通过。');
      console.log('💡 建议: 使用 --full 参数强制使用复杂模式（AI Incubator）');
      process.exit(1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('❌ 快速模式异常:', msg);
      console.log('💡 建议: 使用 --full 参数强制使用复杂模式（AI Incubator）');
      process.exit(1);
    }
  }
  // ── End Quick Mode ──

  // Step tracker: total 5 major steps
  const totalSteps = 5;
  let currentStep = 0;
  const printStep = (label: string) => {
    currentStep++;
    console.log(`\n[步骤 ${currentStep}/${totalSteps}] ${label}`);
  };

  printStep('解析想法');
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

  const route = registry.route('medium');

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

  printStep('商业研究（如需要）');
  // Step 2: Business Research (if needed)
  if (needsResearch(ideaText, idea.keywords)) {
    console.log('🔍 检测到模糊/竞品参考需求，启动商业研究...\n');

    let researchResult = await research(ideaText, route.adapter, (msg) => console.log(msg));

    // Fallback to mock if real provider fails
    if (!researchResult.success) {
      const mock = registry.get('mock');
      if (mock && route.provider !== 'mock') {
        console.log('   ⚠️  AI provider 调用失败，使用 Mock 模式生成研究报告\n');
        researchResult = await research(ideaText, mock, (msg) => console.log(msg));
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

  // Step 2.5: Product Partner Analysis (always runs unless --skip-partner)
  if (!options.skipPartner) {
    printStep('产品经理分析');
    const partnerReport = generateProductPartnerReport(ideaText, idea.type, idea.monetization);
    console.log(formatProductPartnerReport(partnerReport));

    if (!options.yes && !(await confirmCheckpoint('确认产品经理分析方向？'))) {
      return;
    }
  }

  printStep('AI 孵化器分析项目结构');
  // Step 3: Incubate sub-projects (AI-driven, fallback to local rules)
  mkdirSync(outputDir, { recursive: true });

  // Debug/logs go into the project directory
  const { setDebugDir } = await import('../../debug.js');
  const { setLogDir } = await import('../../core/logger.js');
  setDebugDir(rootDir);
  setLogDir(rootDir);

  console.log('🧠 AI 正在分析项目结构...\n');
  const contract = matchContract(idea.rawText);
  if (contract) {
    console.log(`   📜 匹配到玩法契约: ${contract.name}`);
  }
  let incubateResult = await incubateWithAI(idea, rootDir, route.adapter, (msg) => console.log(msg), contract || undefined);

  if (!incubateResult.success) {
    // Template not found is a fatal configuration error — do NOT fall back to mock
    if (incubateResult.error?.includes('TemplateNotFoundError')) {
      console.log(`   ❌ ${incubateResult.error}`);
      console.log('   💡 请检查 kele 模板文件是否正确安装。');
      process.exit(1);
    }
    const mock = registry.get('mock');
    if (mock && route.provider !== 'mock') {
      console.log(`   ⚠️  AI incubator failed: ${incubateResult.error?.slice(0, 80)}`);
      console.log('   🔄 Falling back to mock incubator...');
      incubateResult = await incubateWithAI(idea, rootDir, mock, (msg) => console.log(msg), contract || undefined);
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

  printStep('拆解任务');
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

  printStep('执行代码生成');
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
    recoveryMode: (['auto', 'skip', 'interactive'].includes(options.recoveryMode || '') ? options.recoveryMode : 'interactive') as import('../../core/recovery-wizard.js').RecoveryMode,
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

  // Final monetization readiness check
  if (idea.monetization && idea.monetization !== 'unknown') {
    const { checkMonetizationReadiness } = await import('../../core/monetization-readiness.js');
    const devSp = subProjects.find((s) => s.type === 'development');
    const checkDir = devSp?.targetDir || rootDir;
    console.log(`\n💰 变现 readiness 检查 (${idea.monetization})...`);
    const readiness = checkMonetizationReadiness(checkDir, idea.monetization);
    console.log(`   变现就绪度: ${readiness.score}/100`);
    if (readiness.monetizable) {
      console.log(`   ✅ 变现基础已就绪`);
    } else {
      console.log(`   ⚠️  变现尚未完全就绪，以下检查未通过:`);
      for (const c of readiness.checks.filter((c) => c.required && !c.passed)) {
        console.log(`      • ${c.message}`);
      }
    }
    for (const c of readiness.checks.filter((c) => !c.required && !c.passed)) {
      console.log(`      ○ ${c.message} (可选)`);
    }
  }

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

  const { upgradeTask } = await import('../../core/upgrade-engine.js');
  const { createRegistryFromConfig } = await import('../../adapters/index.js');
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
    const { getConfigSummary } = await import('../../config/index.js');
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
    const chatPrompt = `你是 kele，一个帮用户把想法变成产品的 AI 助手。请用中文简洁回答以下问题：\n\n${message}`;
    const { debugLog } = await import('../../debug.js');
    debugLog('Chat Prompt', chatPrompt);
    const response = await route.adapter.execute(chatPrompt);
    console.log(response);
  } catch (err) {
    console.error('❌ AI 调用失败:', (err as Error).message);
  }
}
