/**
 * Recovery Wizard — human-friendly failure diagnosis and repair guidance.
 *
 * When a task fails, instead of dumping raw errors, kele now:
 * 1. Analyzes the failure type
 * 2. Generates a plain-Chinese diagnosis
 * 3. Offers actionable recovery options with cost estimates
 * 4. Executes the user's choice (auto-fix, simplify, skip, retry)
 */

import { createInterface } from 'readline';
import type { Task } from '../types/index.js';

export interface FailureDiagnosis {
  type: 'validation' | 'runtime' | 'ai_timeout' | 'ai_empty' | 'unknown';
  title: string;
  humanReadable: string;
  technicalDetail: string;
  suggestions: RecoveryOption[];
}

export interface RecoveryOption {
  id: number;
  label: string;
  description: string;
  action: 'auto_fix' | 'simplify' | 'skip' | 'show_log' | 'retry';
}

export type RecoveryMode = 'auto' | 'skip' | 'interactive';

// ─────────────────────────────────────────────────────────────────────────────
// Failure analysis
// ─────────────────────────────────────────────────────────────────────────────

export function analyzeFailure(task: Task, error: string): FailureDiagnosis {
  const lower = error.toLowerCase();

  // Code quality / validation failures
  if (
    lower.includes('代码质量检查') ||
    lower.includes('validation failed') ||
    lower.includes('stub') ||
    lower.includes('todo') ||
    lower.includes('empty') ||
    lower.includes('空函数') ||
    lower.includes('placeholder')
  ) {
    return {
      type: 'validation',
      title: `任务「${task.title}」代码不完整`,
      humanReadable:
        'AI 生成的代码有未完成的部分（空函数、TODO 注释、或者占位符）。' +
        '这通常是因为 AI 在生成长代码时遗漏了某些函数的实现。',
      technicalDetail: error,
      suggestions: [
        {
          id: 1,
          label: '自动修复',
          description: 'AI 会根据错误日志重写代码，预计消耗约 500-1000 tokens',
          action: 'auto_fix',
        },
        {
          id: 2,
          label: '简化需求',
          description: '去掉复杂功能，只保留核心逻辑，降低 AI 出错概率',
          action: 'simplify',
        },
        {
          id: 3,
          label: '跳过此任务',
          description: '继续执行后续任务，此任务留空',
          action: 'skip',
        },
        {
          id: 4,
          label: '查看详细日志',
          description: '显示完整的错误信息和技术细节',
          action: 'show_log',
        },
      ],
    };
  }

  // Runtime errors (JS/TS crashes)
  if (
    lower.includes('运行验证') ||
    lower.includes('runtime') ||
    lower.includes('referenceerror') ||
    lower.includes('typeerror') ||
    lower.includes('syntaxerror') ||
    lower.includes('崩溃') ||
    lower.includes('cannot read') ||
    lower.includes('is not defined') ||
    lower.includes('unexpected token')
  ) {
    return {
      type: 'runtime',
      title: `任务「${task.title}」运行时崩溃`,
      humanReadable:
        '代码在运行时崩溃了。可能是变量名写错、函数调用方式不对、' +
        '或者某个库没有正确导入。',
      technicalDetail: error,
      suggestions: [
        {
          id: 1,
          label: '自动修复',
          description: 'AI 会分析错误日志并修复问题，预计消耗约 500-1000 tokens',
          action: 'auto_fix',
        },
        {
          id: 2,
          label: '降级为简单版本',
          description: '去掉可能导致问题的复杂功能，生成更稳定的代码',
          action: 'simplify',
        },
        {
          id: 3,
          label: '跳过此任务',
          description: '继续执行后续任务',
          action: 'skip',
        },
        {
          id: 4,
          label: '查看详细日志',
          description: '显示完整的错误堆栈',
          action: 'show_log',
        },
      ],
    };
  }

  // AI timeout / network errors
  if (
    lower.includes('超时') ||
    lower.includes('timeout') ||
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('socket hang up') ||
    lower.includes('连接中断')
  ) {
    return {
      type: 'ai_timeout',
      title: `任务「${task.title}」AI 响应超时`,
      humanReadable:
        'AI 服务商响应太慢或连接中断。' +
        '这可能是网络问题、服务商负载过高、或者你的请求太复杂。',
      technicalDetail: error,
      suggestions: [
        {
          id: 1,
          label: '重试',
          description: '再次发送相同的请求',
          action: 'retry',
        },
        {
          id: 2,
          label: '简化需求',
          description: '把任务拆得更小，让 AI 更容易完成',
          action: 'simplify',
        },
        {
          id: 3,
          label: '跳过此任务',
          description: '继续执行后续任务',
          action: 'skip',
        },
      ],
    };
  }

  // Empty / no output
  if (
    lower.includes('空输出') ||
    lower.includes('empty') ||
    lower.includes('未生成任何文件') ||
    lower.includes('no files') ||
    lower.includes('返回空')
  ) {
    return {
      type: 'ai_empty',
      title: `任务「${task.title}」AI 返回空内容`,
      humanReadable:
        'AI 没有返回任何代码。' +
        '这通常是因为 API 超时、服务商限制、或者 prompt 过长被截断。',
      technicalDetail: error,
      suggestions: [
        {
          id: 1,
          label: '重试',
          description: '再次发送请求',
          action: 'retry',
        },
        {
          id: 2,
          label: '切换到 Mock 模式',
          description: '使用本地 mock 数据快速生成代码（用于测试）',
          action: 'auto_fix',
        },
        {
          id: 3,
          label: '跳过此任务',
          description: '继续执行后续任务',
          action: 'skip',
        },
      ],
    };
  }

  // Default / unknown
  return {
    type: 'unknown',
    title: `任务「${task.title}」执行失败`,
    humanReadable:
      '遇到了一个未知错误。可能是配置问题、网络问题、' +
      '或者代码生成过程中的意外情况。',
    technicalDetail: error,
    suggestions: [
      {
        id: 1,
        label: '重试',
        description: '再次尝试执行此任务',
        action: 'retry',
      },
      {
        id: 2,
        label: '跳过此任务',
        description: '继续执行后续任务',
        action: 'skip',
      },
      {
        id: 3,
        label: '查看详细日志',
        description: '显示完整错误信息',
        action: 'show_log',
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu formatting
// ─────────────────────────────────────────────────────────────────────────────

export function formatRecoveryMenu(diagnosis: FailureDiagnosis): string {
  const lines = [
    ``,
    `❌ ${diagnosis.title}`,
    ``,
    `🔍 诊断：${diagnosis.humanReadable}`,
    ``,
    `请选择恢复方式：`,
  ];
  for (const opt of diagnosis.suggestions) {
    lines.push(`  ${opt.id}. ${opt.label} — ${opt.description}`);
  }
  lines.push(``);
  lines.push(`输入 1-${diagnosis.suggestions.length}：`);
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive wizard
// ─────────────────────────────────────────────────────────────────────────────

export async function runRecoveryWizard(
  diagnosis: FailureDiagnosis,
  recoveryMode: RecoveryMode,
  autoYes: boolean
): Promise<{ action: string; message: string; choice?: number }> {
  // Auto mode or --yes flag: pick the first viable auto-fix/retry option
  if (autoYes || recoveryMode === 'auto') {
    const firstAuto = diagnosis.suggestions.find(
      (s) => s.action === 'auto_fix' || s.action === 'retry'
    );
    if (firstAuto) {
      return {
        action: firstAuto.action,
        message: `自动选择：${firstAuto.label}（--yes / recovery-mode=auto）`,
        choice: firstAuto.id,
      };
    }
    // fallback to retry
    return {
      action: 'retry',
      message: '自动选择：重试（--yes / recovery-mode=auto）',
      choice: 1,
    };
  }

  // Skip mode
  if (recoveryMode === 'skip') {
    return {
      action: 'skip',
      message: '已跳过失败任务（recovery-mode=skip）',
    };
  }

  // Interactive mode
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const menu = formatRecoveryMenu(diagnosis);
  console.log(menu);

  const answer = await new Promise<string>((resolve) => {
    rl.question('', resolve);
  });
  rl.close();

  const choice = parseInt(answer.trim(), 10);
  const option = diagnosis.suggestions.find((s) => s.id === choice);

  if (!option) {
    console.log('⚠️  无效选择，默认跳过此任务。');
    return { action: 'skip', message: '无效选择，默认跳过', choice };
  }

  if (option.action === 'show_log') {
    console.log(`\n📋 详细错误日志：\n${diagnosis.technicalDetail}\n`);
    // Show menu again
    return runRecoveryWizard(diagnosis, recoveryMode, autoYes);
  }

  return { action: option.action, message: `选择：${option.label}`, choice };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders for recovery actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a simplified task description for the retry-after-failure path.
 */
export function buildSimplifiedDescription(originalDescription: string, error: string): string {
  return (
    `SIMPLIFIED VERSION (previous attempt failed):\n\n` +
    `Original request:\n${originalDescription}\n\n` +
    `Failure reason:\n${error.slice(0, 300)}\n\n` +
    `INSTRUCTION: Please implement a MINIMAL working version. ` +
    `Remove all complex features, edge cases, and optional functionality. ` +
    `Focus ONLY on the core requirement. Keep the code simple, robust, and fully working.`
  );
}
