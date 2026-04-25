/**
 * Analyzer — use AI to break a complex product idea into page requirements.
 *
 * Limits to max 5 pages to avoid over-complexity.
 */

import type { AIAdapter } from '../ai/provider.js';
import type { PageRequirement } from './types.js';

const MAX_PAGES = 5;

export async function analyzeRequirements(
  provider: AIAdapter,
  userPrompt: string,
): Promise<PageRequirement[]> {
  const analysisPrompt = buildAnalysisPrompt(userPrompt);
  const raw = await provider.execute(analysisPrompt);
  return parseAnalysis(raw, userPrompt);
}

function buildAnalysisPrompt(userPrompt: string): string {
  return `你是一个产品经理，擅长将产品需求拆分为独立的页面清单。

用户需求：${userPrompt}

请分析这个需求，将其拆分为 2-${MAX_PAGES} 个独立的 HTML 页面。
每个页面应该是一个完整的、可独立运行的单文件 HTML 页面。

返回格式必须是纯 JSON 数组，不要包含 markdown 代码块或其他说明：
[
  { "name": "页面中文名", "description": "该页面的核心功能和包含的模块", "icon": "emoji" },
  ...
]

要求：
1. 最多 ${MAX_PAGES} 个页面
2. 每个页面有明确的功能边界
3. 第一个页面是首页/入口
4. 页面名称简洁（2-4 个字）
5. icon 用 emoji 表示
6. 只返回 JSON 数组，不要其他文字`;
}

function parseAnalysis(raw: string, fallbackPrompt: string): PageRequirement[] {
  let jsonStr = raw.trim();

  // Strip markdown code block if present
  const codeMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr) as unknown[];
    if (!Array.isArray(parsed)) return [];

    const reqs: PageRequirement[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const name = (item as Record<string, unknown>).name;
      const desc = (item as Record<string, unknown>).description;
      const icon = (item as Record<string, unknown>).icon;
      if (typeof name === 'string' && typeof desc === 'string') {
        reqs.push({
          name: name.trim(),
          description: desc.trim(),
          icon: typeof icon === 'string' ? icon.trim() : '📄',
        });
      }
    }

    return reqs.slice(0, MAX_PAGES);
  } catch {
    // Fallback: return a single-page product
    return [{ name: '首页', description: fallbackPrompt, icon: '📄' }];
  }
}
