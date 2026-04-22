import type { AIAdapter } from '../adapters/base.js';
import { debugLog } from '../debug.js';

/**
 * Intent Engine — turns natural language into structured actions.
 *
 * Core philosophy: users should talk to kele like a human assistant.
 * No commands to memorize. Just say what you want.
 *
 * Examples:
 * - "做一个塔防游戏" → CREATE
 * - "上次那个消消乐改成动物主题" → UPGRADE
 * - "项目进度怎么样了" → QUERY
 * - "配置 DeepSeek key" → CONFIG
 * - "这个游戏怎么赚钱" → CHAT
 */

export type UserIntent =
  | { type: 'CREATE'; idea: string }
  | { type: 'UPGRADE'; projectQuery: string; taskQuery: string | null; request: string }
  | { type: 'QUERY'; query: string }
  | { type: 'CONFIG'; configType: 'provider' | 'secrets' | 'unknown'; action: string }
  | { type: 'RUN'; projectQuery?: string }
  | { type: 'RESUME'; projectQuery?: string }
  | { type: 'DELETE'; projectQuery: string }
  | { type: 'CHAT'; message: string }
  | { type: 'MODIFY'; request: string }
  | { type: 'ADD'; request: string }
  | { type: 'QUESTION'; question: string }
  | { type: 'DEPLOY'; platform?: string };

const INTENT_PROMPT = `You are an intent classification assistant for "kele" — an AI tool that turns ideas into products.

Analyze the user's input and determine their intent. Return ONLY a JSON object.

Intent types:
- CREATE: User wants to create a new project/product (contains a new idea, concept, or feature request)
- UPGRADE: User wants to modify/improve an existing project (mentions "last time", "previous", "existing", "change", "add", "modify", "upgrade", or references a past project by name)
- QUERY: User wants to check status, list projects, or get information (mentions "progress", "status", "list", "show", "how is", "where is")
- CONFIG: User wants to configure settings, API keys, or credentials (mentions "config", "setup", "key", "provider", "secret", "account")
- RUN: User wants to run or preview a project locally (mentions "run", "start", "preview", "launch", "启动", "运行", "打开", "预览")
- RESUME: User wants to continue/resume an interrupted project (mentions "continue", "resume", "接着", "继续", "接着干", "接着做", "go on", "resume")
- DELETE: User wants to delete a project (mentions "delete", "remove", "删掉", "删除", "移除")
- MODIFY: User wants to modify/change an existing feature in the CURRENT project (mentions "change", "改成", "换成", "改", "修改", "调整", "优化", "fix", "修复", "rename", "重命名"). This is for the active project in chat mode.
- ADD: User wants to add a new feature to the CURRENT project (mentions "add", "加", "新增", "加一个", "加個", "append", "insert"). This is for the active project in chat mode.
- QUESTION: User asks a technical or monetization question without wanting code changes (mentions "how to", "怎么", "如何", "why", "什么是", "?", "？"). Pure Q&A.
- DEPLOY: User wants to deploy the current project (mentions "deploy", "发布", "部署", "上线", "publish", "push to")
- CHAT: General conversation, questions, or casual chat

Rules:
1. If the input mentions a past project ("上次那个", "之前的", "my game", "the todo app"), it's UPGRADE.
2. If the input is clearly a new idea with no reference to past work, it's CREATE.
3. If the input is a question about how something works or general advice, it's CHAT.
4. Extract projectName if the user references a specific project.
5. For UPGRADE, extract the specific change request in "details".

Return JSON:
{
  "intent": "CREATE|UPGRADE|QUERY|CONFIG|RUN|RESUME|DELETE|MODIFY|ADD|QUESTION|DEPLOY|CHAT",
  "projectName": "project name if referenced, else null",
  "details": "the specific request or idea"
}`;

/**
 * Parse user input into a structured intent using AI.
 */
import { debugLog } from '../debug.js';
import { safeJsonParse } from './json-utils.js';

export async function parseIntent(userInput: string, adapter: AIAdapter): Promise<UserIntent> {
  try {
    const prompt = `${INTENT_PROMPT}\n\nUser input: "${userInput}"`;
    debugLog('Intent Engine Prompt', prompt);
    const response = await adapter.execute(prompt);

    // Extract JSON from response using robust parser
    const parsedResult = safeJsonParse<{
      intent: string;
      projectName?: string | null;
      details?: string;
    }>(response);

    if (!parsedResult.data) {
      debugLog('Intent Engine Parse Error', parsedResult.error || 'Unknown error');
      return heuristicParse(userInput);
    }

    const parsed = parsedResult.data;

    const details = parsed.details || userInput;

    switch (parsed.intent) {
      case 'CREATE':
        return { type: 'CREATE', idea: details };

      case 'UPGRADE':
        return {
          type: 'UPGRADE',
          projectQuery: parsed.projectName || details,
          taskQuery: null,
          request: details,
        };

      case 'QUERY':
        return { type: 'QUERY', query: details };

      case 'CONFIG':
        return {
          type: 'CONFIG',
          configType: detectConfigType(details),
          action: details,
        };

      case 'RUN':
        return { type: 'RUN', projectQuery: parsed.projectName || undefined };

      case 'MODIFY':
        return { type: 'MODIFY', request: details };

      case 'ADD':
        return { type: 'ADD', request: details };

      case 'QUESTION':
        return { type: 'QUESTION', question: details };

      case 'DEPLOY':
        return { type: 'DEPLOY', platform: parsed.projectName || undefined };

      case 'RESUME':
        return { type: 'RESUME', projectQuery: parsed.projectName || undefined };

      case 'DELETE':
        return { type: 'DELETE', projectQuery: parsed.projectName || details };

      case 'CHAT':
      default:
        return { type: 'CHAT', message: userInput };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog('Intent engine AI parse failed, falling back to heuristic', msg);
    // Fallback: if AI fails, use heuristic parsing
    return heuristicParse(userInput);
  }
}

function detectConfigType(action: string): 'provider' | 'secrets' | 'unknown' {
  const lower = action.toLowerCase();
  if (lower.includes('secret') || lower.includes('credential') || lower.includes('账号') || lower.includes('密码')) {
    return 'secrets';
  }
  if (lower.includes('provider') || lower.includes('key') || lower.includes('api') || lower.includes('配置')) {
    return 'provider';
  }
  return 'unknown';
}

/**
 * Heuristic fallback when AI parsing fails.
 */
function heuristicParse(input: string): UserIntent {
  const lower = input.toLowerCase();

  // DELETE signals
  const deleteSignals = ['delete', 'remove', '删掉', '删除', '移除'];
  const isDelete = deleteSignals.some((s) => lower.includes(s.toLowerCase()));

  // RESUME signals
  const resumeSignals = ['continue', 'resume', '接着', '继续', '接着干', '接着做', 'go on', '恢复', '继续执行'];
  const isResume = resumeSignals.some((s) => lower.includes(s.toLowerCase()));

  // DEPLOY signals
  const deploySignals = ['deploy', '发布', '部署', '上线', 'publish', 'push to', '推送到'];
  const isDeploy = deploySignals.some((s) => lower.includes(s.toLowerCase()));

  // RUN signals
  const runSignals = ['run', 'start', 'preview', 'launch', '启动', '运行', '打开', '预览'];
  const isRun = runSignals.some((s) => lower.includes(s.toLowerCase()));

  // QUERY signals
  const querySignals = ['progress', 'status', 'list', 'show', 'how is', 'where is', '进度', '状态', '在哪', '列表'];
  const isQuery = querySignals.some((s) => lower.includes(s.toLowerCase()));

  // CONFIG signals
  const configSignals = ['config', 'setup', 'key', 'provider', 'secret', '配置', '设置'];
  const isConfig = configSignals.some((s) => lower.includes(s.toLowerCase()));

  // UPGRADE signals (references to existing work + general change words)
  const upgradeSignals = ['上次', '之前的', 'existing', 'previous', 'last time', 'my', 'the', '改成', 'add', 'modify', 'upgrade', '改', '加', '换成', '变成'];
  const isUpgrade = upgradeSignals.some((s) => lower.includes(s.toLowerCase()));

  if (isDelete) return { type: 'DELETE', projectQuery: input };
  if (isDeploy) return { type: 'DEPLOY' };
  if (isResume) return { type: 'RESUME', projectQuery: input };
  if (isRun) return { type: 'RUN', projectQuery: input };
  if (isQuery) return { type: 'QUERY', query: input };
  if (isConfig) return { type: 'CONFIG', configType: 'unknown', action: input };
  if (isUpgrade) return { type: 'UPGRADE', projectQuery: input, taskQuery: null, request: input };

  // Chat-mode specific intents (no project reference, explicit signals)
  const modifySignals = ['change', '修改', '调整', '优化', 'fix', '修复', 'rename', '重命名', '改为'];
  const isModify = modifySignals.some((s) => lower.includes(s.toLowerCase()));

  const addSignals = ['新增', 'append', 'insert', '添加', '加入'];
  const isAdd = addSignals.some((s) => lower.includes(s.toLowerCase()));

  const questionSignals = ['how to', '怎么', '如何', 'why', '什么是', '为什么', 'explain'];
  const isQuestion = questionSignals.some((s) => lower.includes(s.toLowerCase()));

  if (isModify) return { type: 'MODIFY', request: input };
  if (isAdd) return { type: 'ADD', request: input };
  if (isQuestion) return { type: 'QUESTION', question: input };

  // Default to CREATE for anything that looks like an idea
  return { type: 'CREATE', idea: input };
}
