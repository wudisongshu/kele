/**
 * Chat Engine — multi-turn conversational creation mode for kele.
 *
 * Maintains dialogue history, injects context into prompts,
 * and routes user intents to the right backend (modify, add, run, deploy, Q&A).
 */

import { randomUUID } from 'crypto';
import type { Project, SubProject, Task } from '../types/index.js';
import type { ProviderRegistry } from '../adapters/index.js';
import type { KeleDatabase } from '../db/index.js';
import type { UserIntent } from './intent-engine.js';
import { upgradeTask } from './upgrade-engine.js';
import { executeTask } from './executor.js';
import { planTasks } from './task-planner.js';
import { PromptTemplate } from '../incubator/prompt-template.js';
import { runProject } from './run-validator.js';
import {
  getDeployStrategy,
  detectPlatformFromProject,
} from './deploy-strategies.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  action?: string;
}

export interface ChatContext {
  projectId: string;
  history: ChatTurn[];
  maxHistory: number;
}

export interface ChatActionResult {
  success: boolean;
  message: string;
  action: string;
  details?: string;
}

export interface ChatEngineOptions {
  registry: ProviderRegistry;
  db: KeleDatabase;
  onProgress?: (message: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// History management
// ─────────────────────────────────────────────────────────────────────────────

export function createChatContext(projectId: string, maxHistory = 10): ChatContext {
  return { projectId, history: [], maxHistory };
}

export function addTurn(
  ctx: ChatContext,
  role: 'user' | 'assistant',
  content: string,
  action?: string
): void {
  ctx.history.push({ role, content, action });
  // Trim to maxHistory, keeping most recent
  if (ctx.history.length > ctx.maxHistory) {
    ctx.history = ctx.history.slice(-ctx.maxHistory);
  }
}

/**
 * Summarize recent history into a compact string for prompt injection.
 */
export function summarizeHistory(history: ChatTurn[]): string {
  if (history.length === 0) return 'No previous conversation.';
  const lines = history.map((turn) => {
    const prefix = turn.role === 'user' ? 'User' : 'AI';
    const actionTag = turn.action ? ` [${turn.action}]` : '';
    const text = turn.content.length > 200 ? turn.content.slice(0, 200) + '...' : turn.content;
    return `${prefix}${actionTag}: ${text}`;
  });
  return lines.join('\n');
}

/**
 * Rough token estimator (1 token ≈ 4 chars for English/Chinese mixed).
 */
export function estimateTokenCost(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Build a prompt that includes project context + conversation history + current input.
 */
export async function buildChatPrompt(
  ctx: ChatContext,
  userInput: string,
  project: Project
): Promise<string> {
  const historySummary = summarizeHistory(ctx.history);
  const subProjectNames = project.subProjects.map((sp) => `- ${sp.name} (${sp.type})`).join('\n');

  const template = new PromptTemplate();
  return await template.getSystemMessage('chat', {
    projectName: project.name,
    projectIdea: project.idea.rawText,
    projectType: project.idea.type,
    projectMonetization: project.idea.monetization,
    subProjects: subProjectNames || 'None yet',
    historyLength: String(ctx.history.length),
    historySummary,
    userInput,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent routing
// ─────────────────────────────────────────────────────────────────────────────

function findBestTaskForModify(project: Project, db: KeleDatabase): { task: Task; subProject: SubProject } | null {
  const tasks = db.getTasks(project.id);
  const subProjects = db.getSubProjects(project.id);

  // Prefer most recently completed development/creation task
  const codingTypes = ['development', 'creation', 'production'];
  const candidates = tasks
    .filter((t) => t.status === 'completed' || t.status === 'failed')
    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());

  for (const task of candidates) {
    const sp = subProjects.find((s) => s.id === task.subProjectId);
    if (sp && codingTypes.includes(sp.type)) {
      return { task, subProject: sp };
    }
  }

  // Fallback: any completed task
  if (candidates.length > 0) {
    const task = candidates[0];
    const sp = subProjects.find((s) => s.id === task.subProjectId);
    if (sp) return { task, subProject: sp };
  }

  return null;
}

function createFeatureSubProject(request: string, project: Project): SubProject {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: `Feature: ${request.slice(0, 40)}`,
    description: request,
    type: 'development',
    targetDir: project.rootDir, // write into same root for simplicity
    dependencies: [],
    status: 'pending',
    createdAt: now,
  };
}

/**
 * Handle a chat-mode intent and execute the corresponding action.
 */
export async function handleChatIntent(
  intent: UserIntent,
  project: Project,
  ctx: ChatContext,
  options: ChatEngineOptions
): Promise<ChatActionResult> {
  const { registry, db, onProgress } = options;

  switch (intent.type) {
    case 'MODIFY': {
      onProgress?.(`🔧 识别到修改意图: ${intent.request}`);
      const target = findBestTaskForModify(project, db);
      if (!target) {
        return { success: false, action: 'MODIFY', message: '未找到可修改的任务。项目可能还没有完成任何开发任务。' };
      }
      const { task, subProject } = target;
      onProgress?.(`   → 将修改任务: [${subProject.name}] ${task.title}`);

      const result = await upgradeTask(task, subProject, project, intent.request, {
        registry,
        db,
        onProgress: (msg) => onProgress?.(`   ${msg}`),
      });

      if (result.success) {
        return { success: true, action: 'MODIFY', message: `修改完成: ${task.title} (v${task.version + 1})` };
      }
      return { success: false, action: 'MODIFY', message: `修改失败: ${result.error || 'Unknown error'}` };
    }

    case 'ADD': {
      onProgress?.(`➕ 识别到新增功能意图: ${intent.request}`);
      const newSp = createFeatureSubProject(intent.request, project);
      db.saveSubProject(newSp, project.id);
      onProgress?.(`   → 创建子项目: ${newSp.name}`);

      const planResult = planTasks(newSp, project.idea);
      if (!planResult.success || !planResult.tasks) {
        return { success: false, action: 'ADD', message: `任务规划失败: ${planResult.error || 'Unknown'}` };
      }

      for (const task of planResult.tasks) {
        db.saveTask(task, project.id);
      }

      // Execute the first task
      const firstTask = planResult.tasks[0];
      const execResult = await executeTask(firstTask, newSp, project, {
        registry,
        db,
        onProgress: (msg) => onProgress?.(`   ${msg}`),
      });

      if (execResult.success) {
        return { success: true, action: 'ADD', message: `新增功能完成: ${newSp.name} (${planResult.tasks.length} 个任务)` };
      }
      return { success: false, action: 'ADD', message: `新增功能失败: ${execResult.error || 'Unknown error'}` };
    }

    case 'QUESTION': {
      onProgress?.(`❓ 识别到咨询意图`);
      const prompt = await buildChatPrompt(ctx, intent.question, project);
      const route = registry.route('simple');
      try {
        const answer = await route.adapter.execute(prompt);
        return { success: true, action: 'QUESTION', message: answer.trim() };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, action: 'QUESTION', message: `回答失败: ${msg}` };
      }
    }

    case 'RUN': {
      onProgress?.(`▶️ 运行项目...`);
      const subProjects = db.getSubProjects(project.id);
      const targetDir = subProjects[0]?.targetDir || project.rootDir;
      const result = await runProject(targetDir);
      if (result.success) {
        const summary = result.stdout.slice(0, 300) || '运行成功，无输出';
        return { success: true, action: 'RUN', message: `运行成功\n${summary}` };
      }
      return { success: false, action: 'RUN', message: `运行失败\n${result.stderr.slice(0, 500)}` };
    }

    case 'DEPLOY': {
      onProgress?.(`🚀 识别到部署意图`);
      const platform = intent.platform || detectPlatformFromProject(project.idea.monetization);
      if (!platform) {
        return { success: false, action: 'DEPLOY', message: '无法自动检测部署平台，请显式指定。' };
      }
      const strategy = getDeployStrategy(platform);
      if (!strategy) {
        return { success: false, action: 'DEPLOY', message: `不支持的平台: ${platform}` };
      }
      const subProjects = db.getSubProjects(project.id);
      const targetDir = subProjects[0]?.targetDir || project.rootDir;

      const pre = await strategy.checkPrerequisites(targetDir);
      if (!pre.ready) {
        const missing = pre.checks.filter((c) => !c.passed && c.required).map((c) => c.name).join(', ');
        return { success: false, action: 'DEPLOY', message: `先决条件未满足: ${missing}` };
      }

      const deployResult = await strategy.deploy(targetDir, { dryRun: false, verbose: false });
      return {
        success: deployResult.success,
        action: 'DEPLOY',
        message: deployResult.message,
      };
    }

    case 'UPGRADE': {
      // In chat mode, treat UPGRADE as MODIFY on the current project
      onProgress?.(`🔧 识别到升级意图: ${intent.request}`);
      const target = findBestTaskForModify(project, db);
      if (!target) {
        return { success: false, action: 'UPGRADE', message: '未找到可升级的任务。' };
      }
      const { task, subProject } = target;
      const result = await upgradeTask(task, subProject, project, intent.request, {
        registry,
        db,
        onProgress: (msg) => onProgress?.(`   ${msg}`),
      });
      if (result.success) {
        return { success: true, action: 'UPGRADE', message: `升级完成: ${task.title} (v${task.version + 1})` };
      }
      return { success: false, action: 'UPGRADE', message: `升级失败: ${result.error || 'Unknown error'}` };
    }

    case 'QUERY': {
      onProgress?.(`📊 查询项目状态...`);
      const tasks = db.getTasks(project.id);
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const failed = tasks.filter((t) => t.status === 'failed').length;
      const running = tasks.filter((t) => t.status === 'running').length;
      const subProjects = db.getSubProjects(project.id);
      return {
        success: true,
        action: 'QUERY',
        message:
          `项目: ${project.name}\n` +
          `子项目: ${subProjects.length} 个\n` +
          `任务: ${tasks.length} 个 (${completed} 完成, ${failed} 失败, ${running} 运行中)`,
      };
    }

    default: {
      // For CREATE, CONFIG, DELETE, CHAT — just have AI respond
      const prompt = await buildChatPrompt(ctx, intent.type === 'CHAT' ? intent.message : JSON.stringify(intent), project);
      const route = registry.route('simple');
      try {
        const answer = await route.adapter.execute(prompt);
        return { success: true, action: 'CHAT', message: answer.trim() };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, action: 'CHAT', message: `AI 响应失败: ${msg}` };
      }
    }
  }
}
