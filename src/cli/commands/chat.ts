/**
 * kele chat — interactive multi-turn creation REPL.
 *
 * Usage:
 *   kele chat [project-id]
 *
 * Enters an interactive loop where users can:
 *   - Modify existing code ("把塔改成激光塔")
 *   - Add new features ("加一个无尽模式")
 *   - Ask questions ("怎么接广告？")
 *   - Run tests ("运行一下")
 *   - Deploy ("部署到 GitHub Pages")
 *
 * Special commands:
 *   exit, quit, q  — exit REPL
 *   save           — force save state
 *   status, st     — show project status
 *   help, h        — show help
 */

import { createInterface } from 'readline';
import { Command } from 'commander';
import { KeleDatabase } from '../../db/index.js';
import { debugLog } from '../../debug.js';
import { createRegistryFromConfig } from '../../adapters/index.js';
import { parseIntent } from '../../core/intent-engine.js';
import {
  createChatContext,
  addTurn,
  handleChatIntent,
  estimateTokenCost,
  buildChatPrompt,
} from '../../core/chat-engine.js';
import { printNoProviderHelp } from '../utils.js';
import { hasAnyProvider } from '../../config/index.js';
import type { Project } from '../../types/index.js';
import type { UserIntent } from '../../core/intent-engine.js';

const WELCOME_BANNER = `
🥤 kele chat — 多轮对话创作模式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

输入你的想法，kele 会即时响应：
  "把敌人改成僵尸"       → 修改现有代码
  "加一个排行榜"         → 新增功能
  "怎么变现？"           → 技术/变现咨询
  "运行一下"             → 本地测试
  "部署"                 → 一键部署

特殊指令: status, save, help, exit
按 Ctrl+C 可优雅退出并保存状态
`;

function printHelp(): void {
  console.log(`
📖 kele chat 指令
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
创作指令（自然语言）：
  修改/优化/调整/修复...    修改现有功能
  添加/新增/加入...          添加新功能
  怎么/为什么/如何...        技术咨询
  运行/测试/启动...          本地运行
  部署/发布/上线...          部署项目

特殊命令：
  status, st     查看项目状态
  save           手动保存状态
  help, h        显示帮助
  exit, quit, q  退出对话模式
`);
}

function printStatus(project: Project, db: KeleDatabase): void {
  const tasks = db.getTasks(project.id);
  const subProjects = db.getSubProjects(project.id);
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const running = tasks.filter((t) => t.status === 'running').length;

  console.log(`\n📊 项目状态: ${project.name}`);
  console.log(`   子项目: ${subProjects.length} 个`);
  for (const sp of subProjects.slice(-5)) {
    const icon = sp.status === 'completed' ? '✅' : sp.status === 'failed' ? '❌' : '⏳';
    console.log(`     ${icon} ${sp.name} (${sp.type})`);
  }
  if (subProjects.length > 5) {
    console.log(`     ... 还有 ${subProjects.length - 5} 个`);
  }
  console.log(`   任务: ${tasks.length} 个 (${completed} 完成, ${failed} 失败, ${running} 运行中)`);
  console.log(`   目录: ${project.rootDir}`);
  console.log(`   变现: ${project.idea.monetization}\n`);
}

function isSpecialCommand(input: string): string | null {
  const lower = input.trim().toLowerCase();
  if (['exit', 'quit', 'q'].includes(lower)) return 'exit';
  if (lower === 'save') return 'save';
  if (['status', 'st'].includes(lower)) return 'status';
  if (['help', 'h'].includes(lower)) return 'help';
  return null;
}

async function runRepl(project: Project, db: KeleDatabase, _debug: boolean, mock: boolean): Promise<void> {
  const registry = createRegistryFromConfig();
  if (mock) {
    const mockAdapter = registry.get('mock')!;
    registry.route = () => ({ provider: 'mock', adapter: mockAdapter });
  }

  const ctx = createChatContext(project.id);
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let active = true;
  let turnCount = 0;

  // Ctrl+C handler
  rl.on('SIGINT', () => {
    console.log('\n\n👋 收到退出信号，保存状态并退出...');
    active = false;
    rl.close();
  });

  // Load full project with sub-projects
  const fullProject: Project = {
    ...project,
    subProjects: db.getSubProjects(project.id),
    tasks: db.getTasks(project.id),
  };

  console.log(WELCOME_BANNER);
  printStatus(fullProject, db);

  while (active) {
    const input = await new Promise<string>((resolve) => {
      rl.question('💬 > ', resolve);
    });

    const trimmed = input.trim();
    if (!trimmed) continue;

    // Special commands
    const special = isSpecialCommand(trimmed);
    if (special) {
      switch (special) {
        case 'exit':
          active = false;
          console.log('\n👋 退出 kele chat。项目状态已保存。');
          console.log(`   下次继续: kele chat ${project.id}\n`);
          continue;
        case 'save':
          console.log('💾 状态已保存');
          continue;
        case 'status':
          printStatus(fullProject, db);
          continue;
        case 'help':
          printHelp();
          continue;
      }
    }

    turnCount++;
    console.log(`\n🔄 [第 ${turnCount} 轮] 分析意图...`);

    let intent: UserIntent;
    try {
      const route = registry.route('simple');
      intent = await parseIntent(trimmed, route.adapter);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Chat intent parse failed, using fallback', msg);
      // Fallback heuristic
      intent = { type: 'CHAT', message: trimmed };
    }

    console.log(`   🎯 意图: ${intent.type}`);

    // Show estimated token cost for AI operations
    const promptForEstimate = buildChatPrompt(ctx, trimmed, fullProject);
    const estimatedTokens = estimateTokenCost(promptForEstimate);
    if (['MODIFY', 'ADD', 'QUESTION', 'UPGRADE'].includes(intent.type)) {
      console.log(`   💰 预估 Token: ~${estimatedTokens}（约 ${Math.ceil(estimatedTokens / 1000)}K）`);
    }

    // Record user turn
    addTurn(ctx, 'user', trimmed, intent.type);

    // Execute
    const startTime = Date.now();
    const result = await handleChatIntent(intent, fullProject, ctx, {
      registry,
      db,
      onProgress: (msg) => console.log(`   ${msg}`),
    });
    const duration = Date.now() - startTime;

    // Record assistant turn
    addTurn(ctx, 'assistant', result.message, result.action);

    // Print result
    if (result.success) {
      console.log(`\n✅ [${result.action}] (${Math.round(duration / 1000)}s)`);
      console.log(result.message);
    } else {
      console.log(`\n⚠️ [${result.action}] (${Math.round(duration / 1000)}s)`);
      console.log(result.message);
    }

    // Refresh full project data after modifications
    fullProject.subProjects = db.getSubProjects(project.id);
    fullProject.tasks = db.getTasks(project.id);

    console.log(''); // spacer
  }

  rl.close();
}

export function setupChatCommand(program: Command): void {
  program
    .command('chat')
    .argument('[project-id]', 'Project ID to chat with (default: last project)')
    .description('Interactive multi-turn creation mode')
    .option('--debug', 'Show all prompts sent to AI for debugging', false)
    .option('--mock', 'Force mock AI mode for fast testing', false)
    .action(async (projectId: string | undefined, options: { debug: boolean; mock: boolean }) => {
      if (options.debug) {
        const { setDebug } = await import('../../debug.js');
        setDebug(true);
        console.log('🔍 Debug mode enabled\n');
      }

      if (!hasAnyProvider() && !options.mock) {
        printNoProviderHelp();
        return;
      }

      const db = new KeleDatabase();

      let project: Project | undefined;
      if (projectId) {
        project = db.getProject(projectId);
      } else {
        const projects = db.listProjects();
        if (projects.length > 0) {
          project = projects[0];
          console.log(`🎯 自动选择最近项目: ${project.name} (${project.id})`);
        }
      }

      if (!project) {
        console.error('❌ 未找到项目。请先创建项目：kele "你的 idea"');
        console.log('   或指定项目: kele chat <project-id>');
        process.exit(1);
      }

      const { setDebugDir } = await import('../../debug.js');
      const { setLogDir } = await import('../../core/logger.js');
      setDebugDir(project.rootDir);
      setLogDir(project.rootDir);

      await runRepl(project, db, options.debug, options.mock);
      db.close();
    });
}
