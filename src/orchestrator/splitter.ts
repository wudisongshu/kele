/**
 * Splitter — break page requirements into independent generation tasks.
 */

import type { PageRequirement, GenerationTask } from './types.js';

export function splitIntoTasks(requirements: PageRequirement[]): GenerationTask[] {
  return requirements.map((req) => ({
    taskId: slugify(req.name),
    name: req.name,
    prompt: buildPagePrompt(req, requirements),
    outputFile: `${slugify(req.name)}.html`,
    standalone: true,
  }));
}

function buildPagePrompt(req: PageRequirement, allReqs: PageRequirement[]): string {
  const siblingPages = allReqs
    .filter((r) => r.name !== req.name)
    .map((r) => `- ${r.name}（${r.description}）`)
    .join('\n');

  return `你是一个前端开发专家。请生成一个完整的、可独立运行的 HTML5 页面。

页面名称：${req.name}
功能需求：${req.description}

这是一个多页面产品的子页面。同产品的其他页面有：
${siblingPages || '（无）'}

要求：
1. 所有代码（HTML + CSS + JavaScript）内嵌在一个 HTML 文件中
2. 使用 HTML5 和 CSS3，美观现代
3. 页面必须完整可运行，有核心功能和交互反馈
4. 支持键盘和触摸控制（如适用）
5. 代码中不允许有任何 TODO、空函数、占位符
6. 返回格式：直接返回完整的 HTML 代码字符串，不要 markdown 代码块

注意：
- 页面顶部需要有返回首页的导航链接
- 如果有数据需要跨页面共享，使用 localStorage（key 前缀为 kele_）
- 页面标题使用 <title>${req.name}</title>`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\u4e00-\u9fa5]/g, (c) => c.charCodeAt(0).toString(36).slice(0, 4));
}
