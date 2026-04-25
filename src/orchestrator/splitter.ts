/**
 * Splitter — break page requirements into independent generation tasks.
 */

import type { PageRequirement, GenerationTask } from './types.js';

export function splitIntoTasks(requirements: PageRequirement[]): GenerationTask[] {
  return requirements.map((req) => ({
    taskId: slugify(req.name),
    name: req.name,
    description: req.description,
    prompt: buildPagePrompt(req, requirements),
    outputFile: getPageFileName(req.name),
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
7. 所有 CSS 必须内嵌在 style 标签中，不要引用任何外部 CDN 资源（如 tailwindcss CDN、Google Fonts），确保离线可用

注意：
- 页面顶部需要有返回首页的导航链接
- 如果有数据需要跨页面共享，使用 localStorage（key 前缀为 kele_）
- 页面标题使用 <title>${req.name}</title>`;
}

const PAGE_FILE_MAP: Record<string, string> = {
  '首页': 'index.html',
  '主页': 'index.html',
  '游戏首页': 'index.html',
  '单人挑战': 'practice.html',
  '练习': 'practice.html',
  '练习场': 'practice.html',
  '练习模式': 'practice.html',
  '双人对战': 'match.html',
  '对战': 'match.html',
  '对战模式': 'match.html',
  '双人模式': 'match.html',
  '竞技对战': 'match.html',
  '规则说明': 'rules.html',
  '规则': 'rules.html',
  '教程': 'rules.html',
  '规则馆': 'rules.html',
  '战绩统计': 'records.html',
  '战绩': 'records.html',
  '统计': 'records.html',
  '战绩中心': 'records.html',
  '排行榜': 'records.html',
  '设置': 'settings.html',
  '购物车': 'cart.html',
  '结算': 'checkout.html',
  '商品列表': 'products.html',
  '商品': 'products.html',
  '列表': 'list.html',
  '关于': 'about.html',
  '联系我们': 'contact.html',
  '登录': 'login.html',
  '注册': 'register.html',
  '个人中心': 'profile.html',
  '搜索': 'search.html',
  '详情': 'detail.html',
  '评论': 'reviews.html',
  '收藏': 'favorites.html',
  '订单': 'orders.html',
  '支付': 'payment.html',
  '分类': 'categories.html',
  '标签': 'tags.html',
  '归档': 'archive.html',
  '文章': 'posts.html',
  '博客': 'blog.html',
  '作品': 'works.html',
  '项目': 'projects.html',
  '技能': 'skills.html',
  '经历': 'experience.html',
  '教育': 'education.html',
  '证书': 'certificates.html',
};

function getPageFileName(name: string): string {
  const trimmed = name.trim();
  if (PAGE_FILE_MAP[trimmed]) {
    return PAGE_FILE_MAP[trimmed];
  }
  // Fallback: kebab-case with .html suffix
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    || 'page';
  return `${slug}.html`;
}

function slugify(name: string): string {
  // Keep for taskId generation
  const trimmed = name.trim();
  if (PAGE_FILE_MAP[trimmed]) {
    return PAGE_FILE_MAP[trimmed].replace('.html', '');
  }
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    || 'page';
}
