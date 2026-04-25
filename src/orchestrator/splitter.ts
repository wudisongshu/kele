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

const NAME_TO_FILE: Record<string, string> = {
  '首页': 'home',
  '主页': 'home',
  '单人挑战': 'single-player',
  '单人': 'single',
  '练习': 'practice',
  '双人对战': 'duel',
  '对战': 'battle',
  '双人': 'multiplayer',
  '规则说明': 'rules',
  '规则': 'rules',
  '说明': 'guide',
  '教程': 'tutorial',
  '战绩统计': 'stats',
  '战绩': 'stats',
  '统计': 'statistics',
  '排行榜': 'leaderboard',
  '设置': 'settings',
  '购物车': 'cart',
  '结算': 'checkout',
  '商品列表': 'products',
  '商品': 'products',
  '列表': 'list',
  '关于': 'about',
  '联系我们': 'contact',
  '登录': 'login',
  '注册': 'register',
  '个人中心': 'profile',
  '搜索': 'search',
  '详情': 'detail',
  '评论': 'reviews',
  '收藏': 'favorites',
  '订单': 'orders',
  '支付': 'payment',
  '分类': 'categories',
  '标签': 'tags',
  '归档': 'archive',
  '文章': 'posts',
  '博客': 'blog',
  '作品': 'works',
  '项目': 'projects',
  '技能': 'skills',
  '经历': 'experience',
  '教育': 'education',
  '证书': 'certificates',
};

function slugify(name: string): string {
  // Direct mapping for common Chinese page names
  if (NAME_TO_FILE[name]) return NAME_TO_FILE[name];

  // For English or mixed names: clean and kebab-case
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    || 'page';
}
