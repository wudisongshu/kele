/**
 * Marketing Engine — generates ready-to-use marketing assets and channel plans.
 *
 * Independent developers fail because "nobody knows their product exists".
 * This engine auto-generates:
 * - Copy (Chinese + English) for every major platform
 * - Headlines for A/B testing
 * - Screenshot/recording scripts
 * - Video trailer scripts (15s / 30s / 60s)
 * - SEO keywords and meta descriptions
 * - Channel-specific posting schedules
 *
 * Everything is deterministic (zero AI cost) based on project metadata.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Project } from '../types/index.js';

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

export interface CopyVariant {
  platform: string;
  language: 'zh' | 'en';
  headline: string;
  body: string;
  hashtags: string[];
  cta: string; // call-to-action
}

export interface HeadlineOption {
  id: string;
  text: string;
  angle: string; // e.g. "痛点型", "好奇型"
}

export interface ScreenshotScript {
  title: string;
  description: string;
  idealDuration: string; // e.g. "3-5秒"
  keyVisual: string;
}

export interface VideoScript {
  duration: number; // seconds
  scenes: { time: string; visual: string; audio: string; text: string }[];
  musicSuggestion: string;
}

export interface ChannelRecommendation {
  id: string;
  name: string;
  language: 'zh' | 'en' | 'both';
  bestTime: string;
  estimatedReach: string;
  effort: 'low' | 'medium' | 'high';
  format: string; // e.g. "图文帖子", "短视频", "讨论串"
  specificTips: string[];
}

export interface SEOBundle {
  title: string;
  metaDescription: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  landingPageHeadline: string;
  landingPageSubhead: string;
  landingPageCta: string;
}

export interface MarketingAssets {
  copy: CopyVariant[];
  headlines: HeadlineOption[];
  screenshots: ScreenshotScript[];
  videos: VideoScript[];
  seo: SEOBundle;
}

export interface PostScheduleItem {
  day: number;
  channel: string;
  time: string;
  contentType: string;
  notes: string;
}

/* ──────────────────────────────────────────────
   Headline Generation
   ────────────────────────────────────────────── */

function generateHeadlines(project: Project): HeadlineOption[] {
  const name = project.name;
  const type = project.idea.type;
  const raw = project.idea.rawText;

  const extractFeature = (text: string): string => {
    const features = ['像素', 'Roguelike', '肉鸽', '多人', 'PVP', '物理', 'AI', 'AR', 'VR', '区块链', '创意', '教育', '健身', '禅', '合成', '放置', '挂机', '卡牌', '策略', '解谜', '竞速', '模拟', '经营', '音游', '节奏'];
    for (const f of features) if (text.includes(f)) return f;
    return '';
  };

  const feature = extractFeature(raw);
  const featurePrefix = feature ? `${feature}·` : '';

  const templates: Record<string, HeadlineOption[]> = {
    game: [
      { id: 'h1', text: `🎮 ${featurePrefix}${name} — 上线第一天就停不下来`, angle: '好奇型' },
      { id: 'h2', text: `凌晨 3 点还在玩 ${name}，这游戏有毒`, angle: '社交证明型' },
      { id: 'h3', text: `独立开发者花了 ${project.idea.complexity === 'simple' ? '1 周' : project.idea.complexity === 'medium' ? '1 个月' : '3 个月'} 做 ${name}，现在每天 ${project.idea.monetization === 'wechat-miniprogram' || project.idea.monetization === 'douyin' ? '¥' : '$'}50+`, angle: '结果型' },
      { id: 'h4', text: `${name}：一款让你忘记时间的${feature || '休闲'}游戏`, angle: '情感型' },
      { id: 'h5', text: `为什么 ${name} 的次日留存高达 40%？`, angle: '数据型' },
    ],
    tool: [
      { id: 'h1', text: `⚡ ${name} — 让效率提升 10 倍的小工具`, angle: '结果型' },
      { id: 'h2', text: `受够了繁琐操作？${name} 一键搞定`, angle: '痛点型' },
      { id: 'h3', text: `开源免费｜${name} 帮我每天省下 2 小时`, angle: '社交证明型' },
      { id: 'h4', text: `Notion 太贵？试试 ${name}`, angle: '对比型' },
      { id: 'h5', text: `${name} 的 3 个隐藏功能，90% 的人不知道`, angle: '好奇型' },
    ],
    bot: [
      { id: 'h1', text: `🤖 ${name} — 你的 24 小时在线助手`, angle: '功能型' },
      { id: 'h2', text: `这个 Discord Bot 让我的服务器活跃了 3 倍`, angle: '结果型' },
      { id: 'h3', text: `0 代码部署 ${name}，5 分钟上线`, angle: '易用型' },
      { id: 'h4', text: `${name} 能做什么？比你想的多 10 倍`, angle: '好奇型' },
      { id: 'h5', text: `开源 Bot ${name}，已有 1000+ 服务器在用`, angle: '社交证明型' },
    ],
    music: [
      { id: 'h1', text: `🎵 ${name} — 原创音乐，免费可商用`, angle: '价值型' },
      { id: 'h2', text: `深夜写代码时，我在听 ${name}`, angle: '情感型' },
      { id: 'h3', text: `${name} 已收录 ${Math.floor(Math.random() * 20 + 5)} 首原创曲目`, angle: '数据型' },
      { id: 'h4', text: `独立音乐人的新专辑 ${name}，欢迎试听`, angle: '邀请型' },
      { id: 'h5', text: `用 ${name} 做 BGM，你的视频会更有质感`, angle: '场景型' },
    ],
    content: [
      { id: 'h1', text: `📖 ${name} — 我花了 3 个月整理的实战经验`, angle: '投入型' },
      { id: 'h2', text: `${name}：一篇改变你认知的长文`, angle: '好奇型' },
      { id: 'h3', text: `为什么 ${name} 被转发 5000 次？`, angle: '社交证明型' },
      { id: 'h4', text: `${name}｜从 0 到 1 的完整复盘`, angle: '结果型' },
      { id: 'h5', text: `看完 ${name}，我重新思考了这个问题`, angle: '情感型' },
    ],
    unknown: [
      { id: 'h1', text: `🚀 ${name} — 一个新玩意儿`, angle: '好奇型' },
      { id: 'h2', text: `独立开发者的新作品 ${name}`, angle: '身份型' },
      { id: 'h3', text: `${name} 上线啦，欢迎体验`, angle: '邀请型' },
      { id: 'h4', text: `为什么我做 ${name}？`, angle: '故事型' },
      { id: 'h5', text: `${name} 的 5 个亮点`, angle: '清单型' },
    ],
  };

  return templates[type] || templates['unknown'];
}

/* ──────────────────────────────────────────────
   Copy Generation (per platform)
   ────────────────────────────────────────────── */

function generateTwitterCopy(project: Project): CopyVariant[] {
  const name = project.name;
  const type = project.idea.type;
  const isGame = type === 'game';
  const isTool = type === 'tool';

  return [
    {
      platform: 'Twitter/X',
      language: 'en',
      headline: `🚀 Just launched ${name}!`,
      body: isGame
        ? `After ${project.idea.complexity === 'simple' ? '1 week' : project.idea.complexity === 'medium' ? '1 month' : '3 months'} of solo dev, ${name} is live.\n\nIt's a ${project.idea.rawText.slice(0, 40)} that you can play right in your browser.\n\nNo install. No signup. Just play.\n\nWhat do you think? 👇`
        : isTool
          ? `Tired of complicated tools? Meet ${name}.\n\n${project.idea.rawText.slice(0, 50)}\n\n• Free to use\n• Open source\n• Zero config setup\n\nTry it and let me know what features you need next. 🛠️`
          : `Introducing ${name} — my latest project.\n\n${project.idea.rawText.slice(0, 50)}\n\nBuilt with curiosity and coffee. ☕\n\nLink below. Feedback welcome!`,
      hashtags: isGame ? ['#indiedev', '#gamedev', '#indiegame', '#screenshotsaturday'] : isTool ? ['#buildinpublic', '#indiehackers', '#opensource'] : ['#buildinpublic', '#indiedev'],
      cta: 'Play now / Try it free →',
    },
    {
      platform: 'Twitter/X',
      language: 'zh',
      headline: `🚀 ${name} 上线了！`,
      body: isGame
        ? `花了 ${project.idea.complexity === 'simple' ? '1 周' : project.idea.complexity === 'medium' ? '1 个月' : '3 个月'} 独自开发的 ${name} 终于上线了！\n\n打开浏览器就能玩，不用下载，不用注册。\n\n试玩一下，告诉我你的想法 👇`
        : `做了一款小工具 ${name}，希望能帮到你。\n\n• 完全免费\n• 开源\n• 无需配置\n\n试用链接在下面，欢迎提建议！`,
      hashtags: isGame ? ['#独立游戏', '#IndieGameDev', '#游戏开发'] : ['#独立开发', '#buildinpublic'],
      cta: '立即试玩 / 免费使用 →',
    },
  ];
}

function generateRedditCopy(project: Project): CopyVariant[] {
  const name = project.name;
  const isGame = project.idea.type === 'game';

  return [
    {
      platform: 'Reddit',
      language: 'en',
      headline: `[Showoff Saturday] I made ${name} — a ${isGame ? 'browser game' : 'web tool'}`,
      body: `Hey r/${isGame ? 'gamedev' : 'webdev'},\n\nI've been working on **${name}** for the past ${project.idea.complexity === 'simple' ? 'week' : project.idea.complexity === 'medium' ? 'month' : 'few months'} as a solo dev.\n\n**What it is:** ${project.idea.rawText.slice(0, 80)}\n\n**Tech stack:** HTML5 + Canvas + vanilla JS (kept it simple)\n\n**Link:** [Play here]\n\n**What I'm looking for:** Honest feedback on the core loop. Does it hook you in the first 60 seconds?\n\nThanks for checking it out!`,
      hashtags: [],
      cta: 'Play and leave feedback →',
    },
  ];
}

function generateDouyinCopy(project: Project): CopyVariant[] {
  const name = project.name;
  const isGame = project.idea.type === 'game';

  return [
    {
      platform: '抖音/小红书',
      language: 'zh',
      headline: `挑战：${project.idea.complexity === 'simple' ? '7天' : '30天'}做出${name}`,
      body: isGame
        ? `Day 1：脑子里只有一个想法\nDay 3：核心玩法跑起来了\nDay 7：${name} 正式上线！\n\n打开就能玩，不用下载\n评论区告诉我你能玩到第几关 👇\n\n#独立游戏 #${name} #小游戏 #开发者日常`
        : `从零到上线只花了 ${project.idea.complexity === 'simple' ? '7 天' : '30 天'}\n\n这就是 ${name}\n\n• 完全免费\n• 无需注册\n• 打开即用\n\n觉得有用的话点个❤️，我会继续更新功能\n\n#独立开发 #效率工具 #${name}`,
      hashtags: isGame ? ['#独立游戏', '#小游戏', '#开发者日常'] : ['#独立开发', '#效率工具'],
      cta: '点击链接试玩 / 收藏备用 →',
    },
    {
      platform: '抖音/小红书',
      language: 'zh',
      headline: `凌晨 3 点还在玩 ${name}，这游戏有毒`,
      body: `本来只想试玩 5 分钟\n结果一抬头天亮了…\n\n${name} 的魔力：\n1️⃣ 打开即玩，零门槛\n2️⃣ 每局 3-5 分钟，碎片时间神器\n3️⃣ 越玩越上头\n\n你能撑到第几关？评论区见 👇`,
      hashtags: ['#上头小游戏', '#独立游戏', '#熬夜必备'],
      cta: '点击试玩 →',
    },
  ];
}

function generateProductHuntCopy(project: Project): CopyVariant[] {
  const name = project.name;
  const isTool = project.idea.type === 'tool';

  return [
    {
      platform: 'Product Hunt',
      language: 'en',
      headline: `${name} — ${isTool ? 'the tool that saves you 2 hours a day' : 'a fresh take on ' + project.idea.type}`,
      body: `**What is ${name}?**\n${project.idea.rawText.slice(0, 100)}\n\n**Key features:**\n• Simple, no-bloat interface\n• Works offline (PWA)\n• Free forever, open source\n\n**Why I built it:**\nI was frustrated with existing solutions being too complex or too expensive. ${name} is my answer — minimal, fast, and actually useful.\n\n**What's next:**\nBased on your feedback, I'll prioritize the most requested features.`,
      hashtags: ['#productivity', '#opensource', '#pwa'],
      cta: 'Upvote and try it →',
    },
  ];
}

function generateHackerNewsCopy(project: Project): CopyVariant[] {
  const name = project.name;

  return [
    {
      platform: 'Hacker News',
      language: 'en',
      headline: `Show HN: ${name} — ${project.idea.rawText.slice(0, 60)}`,
      body: `Hi HN,\n\nI built ${name} over the past ${project.idea.complexity === 'simple' ? 'week' : project.idea.complexity === 'medium' ? 'month' : 'few months'}.\n\n**Problem:** Existing tools are either too heavy or too expensive.\n**Solution:** ${name} — dead simple, open source, and free.\n\n**Stack:** TypeScript, Vite, vanilla everything. No framework bloat.\n\n**Live demo:** [link]\n**Source:** [GitHub]\n\nWould love your technical feedback. What's the first thing you'd change?`,
      hashtags: [],
      cta: 'Check it out →',
    },
  ];
}

function generateWechatCopy(project: Project): CopyVariant[] {
  const name = project.name;

  return [
    {
      platform: '微信公众号/朋友圈',
      language: 'zh',
      headline: `推荐一个我独立开发的小项目：${name}`,
      body: `大家好，我是独立开发者。\n\n最近花了 ${project.idea.complexity === 'simple' ? '一周' : project.idea.complexity === 'medium' ? '一个月' : '几个月'} 时间做了一个叫 **${name}** 的项目。\n\n${project.idea.rawText.slice(0, 60)}\n\n为什么要做这个项目？\n因为市面上的同类产品要么太复杂，要么太贵。我想做一款简单、直接、好用的工具。\n\n目前完全免费，欢迎大家试用并给我反馈。\n\n如果这篇文章对你有帮助，欢迎转发给需要的朋友。`,
      hashtags: [],
      cta: '点击阅读原文体验 →',
    },
  ];
}

function generateBilibiliCopy(project: Project): CopyVariant[] {
  const name = project.name;
  const isGame = project.idea.type === 'game';

  return [
    {
      platform: 'Bilibili',
      language: 'zh',
      headline: `【独立开发】${project.idea.complexity === 'simple' ? '7天' : '30天'}做出${name}｜全记录`,
      body: isGame
        ? `这期视频记录了我从零开始开发 ${name} 的全过程。\n\n包括：\n• 核心玩法设计\n• 美术风格选择\n• 遇到的坑和解决方案\n• 上线后的数据\n\n游戏已经上线，欢迎试玩！\n\n如果你觉得这期视频有帮助，一键三连就是对我最大的支持 🙏`
        : `记录一下 ${name} 的开发过程。\n\n从想法到上线，每一步都踩了不少坑。\n希望这个视频能帮到有同样想法的你。\n\n项目已开源，链接在简介。`,
      hashtags: ['#独立开发', '#编程', isGame ? '#独立游戏' : '#开源'],
      cta: '试玩链接在简介 →',
    },
  ];
}

function generateDiscordCopy(project: Project): CopyVariant[] {
  const name = project.name;

  return [
    {
      platform: 'Discord',
      language: 'en',
      headline: `Introducing ${name}`,
      body: `Hey everyone! 👋\n\nI just launched **${name}** and wanted to share it with this amazing community.\n\n**What it does:** ${project.idea.rawText.slice(0, 80)}\n\n**Why you might like it:**\n• Free and open source\n• No signup required\n• Works on mobile and desktop\n\nWould love to hear what you think! Feel free to drop feedback here or open an issue on GitHub.`,
      hashtags: [],
      cta: 'Try it out →',
    },
  ];
}

/* ──────────────────────────────────────────────
   Screenshot Scripts
   ────────────────────────────────────────────── */

function generateScreenshotScripts(project: Project): ScreenshotScript[] {
  const isGame = project.idea.type === 'game';
  const isTool = project.idea.type === 'tool';

  if (isGame) {
    return [
      { title: '封面图：标题 + 核心玩法画面', description: '展示游戏 logo 和正在进行的精彩画面，色彩鲜艳，动作感强', idealDuration: '静态图', keyVisual: '游戏标题 + 角色/塔/车在画面中央，背景有粒子特效' },
      { title: '玩法展示：核心循环 3 秒动图', description: '录制 3-5 秒的核心玩法片段，展示最爽快的操作瞬间', idealDuration: '3-5秒', keyVisual: '玩家输入 → 即时反馈（爆炸/得分/升级）' },
      { title: '特色系统：区别于竞品的机制', description: '展示你的独特卖点，如"合成系统""英雄技能""物理效果"', idealDuration: '3-5秒', keyVisual: '特写独特机制的操作过程' },
      { title: '成就感画面：高分/通关/解锁', description: '展示玩家获得奖励的瞬间，数字跳动、特效绽放', idealDuration: '2-3秒', keyVisual: '大大的"LEVEL CLEAR" + 金币/星星飞入' },
      { title: '移动端适配：竖屏/横屏展示', description: '展示游戏在手机上的实际运行效果', idealDuration: '静态图', keyVisual: '手机 mockup 中展示游戏，一手触控操作' },
    ];
  }

  if (isTool) {
    return [
      { title: '封面图：Before/After 对比', description: '左侧展示"使用前的混乱"，右侧展示"使用后的整洁"', idealDuration: '静态图', keyVisual: '对比鲜明的左右分屏' },
      { title: '核心功能：一键操作演示', description: '展示最关键的功能如何在 3 步内完成', idealDuration: '5-8秒', keyVisual: '鼠标点击 → 结果即时呈现' },
      { title: '数据展示：仪表盘/统计页', description: '如果有数据可视化，展示最漂亮的图表', idealDuration: '静态图', keyVisual: '色彩协调的图表 + 关键数字高亮' },
      { title: '移动端：响应式适配', description: '展示在手机上的使用体验', idealDuration: '静态图', keyVisual: '手机 mockup 展示工具界面' },
      { title: '社交证明：用户量/评分/下载', description: '如果有数据，展示"已有 X 用户使用"等', idealDuration: '静态图', keyVisual: '大数字 + 五星评分' },
    ];
  }

  return [
    { title: '封面图：产品名称 + 核心价值', description: '清晰展示产品名称和一句话价值主张', idealDuration: '静态图', keyVisual: '产品界面 + 大标题' },
    { title: '功能展示：核心操作过程', description: '展示用户完成一次核心操作的流程', idealDuration: '5-10秒', keyVisual: '操作录屏 + 关键步骤标注' },
    { title: '差异化：与竞品的对比', description: '展示你的产品比现有方案好在哪里', idealDuration: '静态图', keyVisual: '对比表格或 Before/After' },
    { title: '使用场景：真实用户环境', description: '展示产品在真实场景中的使用', idealDuration: '静态图', keyVisual: 'mockup + 真实场景背景' },
    { title: 'CTA 图：引导下载/使用', description: '最后一张图明确告诉用户下一步做什么', idealDuration: '静态图', keyVisual: '"立即体验"按钮 + 二维码/链接' },
  ];
}

/* ──────────────────────────────────────────────
   Video Scripts
   ────────────────────────────────────────────── */

function generateVideoScripts(project: Project): VideoScript[] {
  const isGame = project.idea.type === 'game';
  const name = project.name;

  const game15s: VideoScript = {
    duration: 15,
    scenes: [
      { time: '0-3s', visual: '黑屏 → 游戏 logo 闪现', audio: '节奏感强的电子音效', text: `${name}` },
      { time: '3-8s', visual: '核心玩法快节奏剪辑（3-4 个镜头）', audio: '音效 + 轻快节奏', text: '打开即玩' },
      { time: '8-12s', visual: '最爽快的得分/通关瞬间', audio: '高潮音效', text: '停不下来' },
      { time: '12-15s', visual: '二维码/链接 + CTA', audio: '结尾音效', text: '立即试玩' },
    ],
    musicSuggestion: '快节奏电子音乐（120-140 BPM），免版权库：Epidemic Sound "Neon Drive" 类',
  };

  const game30s: VideoScript = {
    duration: 30,
    scenes: [
      { time: '0-3s', visual: 'Hook："你能在 30 秒内爱上这款游戏吗？"', audio: '悬念音效', text: '挑战：30 秒爱上这款游戏' },
      { time: '3-10s', visual: '玩法展示：从新手到第一次成功', audio: '轻快节奏', text: '简单上手' },
      { time: '10-18s', visual: '深度展示：高级技巧/隐藏内容', audio: '节奏加强', text: '越玩越深' },
      { time: '18-25s', visual: '社交元素/排行榜/分享', audio: '高潮', text: '和好友一起' },
      { time: '25-30s', visual: 'CTA + 下载链接/二维码', audio: '结尾 branding', text: `${name} — 免费试玩` },
    ],
    musicSuggestion: '渐强型电子音乐，前 5 秒安静，中段节奏爆发',
  };

  const game60s: VideoScript = {
    duration: 60,
    scenes: [
      { time: '0-5s', visual: '开发者出镜/画外音："我是 XXX，花了 X 时间做这款游戏"', audio: '温暖/真诚的背景音乐', text: '一个独立开发者的故事' },
      { time: '5-15s', visual: '早期原型 → 成品对比', audio: '音乐渐强', text: '从想法到现实' },
      { time: '15-30s', visual: '完整玩法循环展示', audio: '游戏原声', text: '核心玩法' },
      { time: '30-45s', visual: '玩家反馈/评论截图（如有）', audio: '音乐持续', text: '玩家怎么说' },
      { time: '45-55s', visual: '未来更新路线图', audio: '期待感音乐', text: '还有更多…' },
      { time: '55-60s', visual: 'CTA + 所有平台链接', audio: '结尾 branding', text: '现在就玩' },
    ],
    musicSuggestion: '叙事型电子音乐，有情感起伏，类似《Celeste》OST 风格',
  };

  const tool15s: VideoScript = {
    duration: 15,
    scenes: [
      { time: '0-3s', visual: '痛点展示：混乱的桌面/繁琐的操作', audio: '紧张音效', text: '受够了？' },
      { time: '3-10s', visual: `${name} 一键解决（加速播放）`, audio: '解决音效', text: `${name} 一键搞定` },
      { time: '10-15s', visual: '整洁的结果 + CTA', audio: '愉悦结尾', text: '免费使用' },
    ],
    musicSuggestion: '轻快科技感的免版权音乐',
  };

  const tool30s: VideoScript = {
    duration: 30,
    scenes: [
      { time: '0-5s', visual: '问题陈述：每天花 2 小时做 XX？', audio: '疑惑/困扰', text: '每天花 2 小时？' },
      { time: '5-12s', visual: `${name} 核心功能演示`, audio: '轻快', text: `试试 ${name}` },
      { time: '12-20s', visual: '3 个功能亮点快速展示', audio: '节奏加快', text: '3 个你需要的功能' },
      { time: '20-25s', visual: '用户 testimonial（文字即可）', audio: '温暖', text: '"省了我每天 1 小时"' },
      { time: '25-30s', visual: 'CTA + 链接', audio: '结尾', text: '免费开始使用' },
    ],
    musicSuggestion: '轻快的 lo-fi 或科技感动画 BGM',
  };

  const tool60s: VideoScript = {
    duration: 60,
    scenes: [
      { time: '0-8s', visual: '开发者介绍 + 做这款工具的动机', audio: '真诚/叙事', text: '为什么我做 ${name}' },
      { time: '8-20s', visual: '完整功能 walkthrough', audio: '轻快', text: '它能做什么' },
      { time: '20-35s', visual: '真实使用场景（录屏 + 场景标注）', audio: '持续', text: '真实场景' },
      { time: '35-50s', visual: '与竞品对比（表格/分屏）', audio: '自信', text: '为什么选它' },
      { time: '50-60s', visual: 'CTA + 开源链接 + 邀请贡献', audio: '结尾', text: '开源免费，欢迎 Star' },
    ],
    musicSuggestion: '叙事型轻音乐，类似 Vlog BGM',
  };

  return isGame ? [game15s, game30s, game60s] : [tool15s, tool30s, tool60s];
}

/* ──────────────────────────────────────────────
   SEO Generation
   ────────────────────────────────────────────── */

function generateSEO(project: Project): SEOBundle {
  const name = project.name;
  const type = project.idea.type;
  const raw = project.idea.rawText;

  const typeLabels: Record<string, string> = {
    game: '游戏',
    tool: '工具',
    bot: '机器人',
    music: '音乐',
    content: '内容',
    unknown: '项目',
  };

  const label = typeLabels[type] || '项目';

  // Extract keywords from raw text
  const allKeywords = [
    name, label, '独立开发', '开源', '免费', '在线', '浏览器',
    ...raw.split(/[\s，,、]+/).filter((w) => w.length >= 2 && w.length <= 8),
  ];
  const uniqueKeywords = [...new Set(allKeywords)].slice(0, 12);

  return {
    title: `${name} — 免费${label} | 独立开发者作品`,
    metaDescription: `${raw.slice(0, 80)}。由独立开发者打造的免费${label}，无需下载，打开即用。`,
    keywords: uniqueKeywords,
    ogTitle: `${name} — 你值得一试的${label}`,
    ogDescription: `${raw.slice(0, 100)}`,
    landingPageHeadline: `${name}：${raw.slice(0, 30)}`,
    landingPageSubhead: '由独立开发者精心打造，免费、开源、无需注册',
    landingPageCta: type === 'game' ? '立即开玩' : type === 'tool' ? '免费使用' : '立即体验',
  };
}

/* ──────────────────────────────────────────────
   Channel Selection
   ────────────────────────────────────────────── */

const CHANNEL_DATABASE: ChannelRecommendation[] = [
  { id: 'twitter', name: 'Twitter / X', language: 'both', bestTime: '周二/周四 8:00-10:00 PST', estimatedReach: '500-3,000 曝光', effort: 'low', format: '图文帖子 + GIF', specificTips: ['用 #buildinpublic 和 #indiedev 标签', '配图比纯文字效果好 3 倍', '在 Pacific Time 早上发'] },
  { id: 'reddit', name: 'Reddit', language: 'en', bestTime: '周六 10:00 PST（Showoff Saturday）', estimatedReach: '1,000-10,000 PV', effort: 'medium', format: '文字帖子 + 截图', specificTips: ['r/gamedev 的 Showoff Saturday 是最佳时机', 'r/webdev 适合工具类', '标题要谦虚，正文要详细'] },
  { id: 'producthunt', name: 'Product Hunt', language: 'en', bestTime: '周二 0:00 PST（凌晨上线）', estimatedReach: '500-5,000 PV', effort: 'high', format: '产品页 + 评论互动', specificTips: ['周二凌晨上线竞争最小', '准备 5 张高质量截图', '上线后前 2 小时回复所有评论'] },
  { id: 'hackernews', name: 'Hacker News', language: 'en', bestTime: '周二/周四 7:00 PST', estimatedReach: '1,000-20,000 PV', effort: 'medium', format: 'Show HN 帖子', specificTips: ['标题格式：Show HN: 产品名 — 一句话描述', '评论区互动是关键', '技术细节比营销话术更受欢迎'] },
  { id: 'douyin', name: '抖音', language: 'zh', bestTime: '12:00-13:00 或 18:00-20:00', estimatedReach: '1,000-50,000 播放', effort: 'high', format: '15-60 秒短视频', specificTips: ['前 3 秒必须有钩子', '带 #独立开发 #小游戏 标签', '系列视频比单支效果更好'] },
  { id: 'xiaohongshu', name: '小红书', language: 'zh', bestTime: '12:00-13:00 或 19:00-21:00', estimatedReach: '500-10,000 曝光', effort: 'medium', format: '图文笔记', specificTips: ['封面图决定 80% 点击率', '标题用 emoji 和数字', '评论区互动提升权重'] },
  { id: 'bilibili', name: 'Bilibili', language: 'zh', bestTime: '周五/周六 18:00-20:00', estimatedReach: '500-5,000 播放', effort: 'high', format: '5-10 分钟视频', specificTips: ['开发过程类视频受欢迎', '标题带"独立开发""从零开始"', '简介放试玩链接'] },
  { id: 'v2ex', name: 'V2EX', language: 'zh', bestTime: '工作日 10:00-12:00', estimatedReach: '1,000-5,000 PV', effort: 'low', format: '分享帖', specificTips: ['「创造者」节点最适合', '不要直接放链接，先介绍项目', '真诚分享比硬广效果好'] },
  { id: 'zhihu', name: '知乎', language: 'zh', bestTime: '工作日 12:00-14:00', estimatedReach: '500-3,000 阅读', effort: 'medium', format: '回答/文章', specificTips: ['回答相关问题比发文章效果好', '用"经验分享"角度，不要硬推', '文末放链接'] },
  { id: 'itchio', name: 'itch.io', language: 'en', bestTime: '周五下午（周末前）', estimatedReach: '100-1,000 浏览', effort: 'low', format: '游戏页面 + devlog', specificTips: ['完善的标签系统带来自然流量', '定期更新 devlog', '参与 game jam 获得曝光'] },
  { id: 'steam', name: 'Steam 社区', language: 'both', bestTime: '周末', estimatedReach: '视游戏质量', effort: 'medium', format: '公告 + 讨论区', specificTips: ['Coming Soon 页面尽早发布', '愿望单数量是首发关键', '定期更新开发者日志'] },
  { id: 'discord', name: 'Discord 社区', language: 'en', bestTime: '社区活跃时段（通常晚间）', estimatedReach: '100-1,000 成员看到', effort: 'low', format: '频道帖子', specificTips: ['找相关游戏的 Discord 服务器', '先参与讨论再分享', '不要一进群就发广告'] },
  { id: 'telegram', name: 'Telegram 频道', language: 'both', bestTime: '随时', estimatedReach: '视频道规模', effort: 'low', format: '频道消息', specificTips: ['找相关主题的 Telegram 频道投稿', '准备中英文双版本', '提供直接体验链接'] },
  { id: 'wechat', name: '微信公众号/朋友圈', language: 'zh', bestTime: '21:00-22:00', estimatedReach: '视粉丝量', effort: 'medium', format: '长文/图文', specificTips: ['个人开发者故事比产品介绍更吸粉', '朋友圈适合短文案 + 二维码', '引导关注比直接推广更有效'] },
];

function selectChannels(project: Project): ChannelRecommendation[] {
  const type = project.idea.type;
  const monetization = project.idea.monetization;

  let channelIds: string[] = [];

  // Base by creative type
  switch (type) {
    case 'game':
      channelIds = ['twitter', 'reddit', 'douyin', 'bilibili', 'xiaohongshu', 'itchio'];
      if (monetization === 'steam') channelIds.push('steam');
      if (monetization === 'wechat-miniprogram') channelIds = ['douyin', 'xiaohongshu', 'wechat'];
      if (monetization === 'douyin') channelIds = ['douyin', 'xiaohongshu', 'wechat'];
      break;
    case 'tool':
      channelIds = ['twitter', 'producthunt', 'hackernews', 'v2ex', 'zhihu', 'douyin'];
      break;
    case 'bot':
      channelIds = ['twitter', 'discord', 'telegram', 'v2ex', 'producthunt'];
      break;
    case 'music':
      channelIds = ['twitter', 'bilibili', 'xiaohongshu', 'douyin'];
      break;
    case 'content':
      channelIds = ['twitter', 'zhihu', 'wechat', 'xiaohongshu', 'hackernews'];
      break;
    default:
      channelIds = ['twitter', 'v2ex', 'douyin'];
  }

  // Monetization-based filtering
  if (monetization === 'wechat-miniprogram') {
    // Remove English-only channels for WeChat-only products
    channelIds = channelIds.filter((id) => {
      const ch = CHANNEL_DATABASE.find((c) => c.id === id);
      return ch && ch.language !== 'en';
    });
  }

  // Deduplicate and limit
  channelIds = [...new Set(channelIds)];

  return channelIds
    .map((id) => CHANNEL_DATABASE.find((c) => c.id === id)!)
    .filter(Boolean);
}

/* ──────────────────────────────────────────────
   Schedule Generation
   ────────────────────────────────────────────── */

function generateSchedule(channels: ChannelRecommendation[]): PostScheduleItem[] {
  const schedule: PostScheduleItem[] = [];
  let day = 1;

  // Day 1: Highest effort channel first (usually Product Hunt or 抖音)
  const highEffort = channels.filter((c) => c.effort === 'high');
  const mediumEffort = channels.filter((c) => c.effort === 'medium');
  const lowEffort = channels.filter((c) => c.effort === 'low');

  for (const ch of highEffort.slice(0, 2)) {
    schedule.push({
      day,
      channel: ch.name,
      time: ch.bestTime,
      contentType: ch.format,
      notes: ch.specificTips[0] || '',
    });
    day += 2; // Space out high-effort posts
  }

  for (const ch of mediumEffort) {
    schedule.push({
      day,
      channel: ch.name,
      time: ch.bestTime,
      contentType: ch.format,
      notes: ch.specificTips[0] || '',
    });
    day += 1;
  }

  for (const ch of lowEffort) {
    schedule.push({
      day,
      channel: ch.name,
      time: ch.bestTime,
      contentType: ch.format,
      notes: ch.specificTips[0] || '',
    });
    day += 1;
  }

  // Sort by day
  schedule.sort((a, b) => a.day - b.day);

  // Renumber days to be sequential
  let currentDay = 1;
  for (let i = 0; i < schedule.length; i++) {
    if (i > 0 && schedule[i].day > schedule[i - 1].day) {
      currentDay++;
    }
    schedule[i].day = currentDay;
  }

  return schedule;
}

/* ──────────────────────────────────────────────
   Main Asset Generation
   ────────────────────────────────────────────── */

export function generateAssets(project: Project): MarketingAssets {
  const copy: CopyVariant[] = [
    ...generateTwitterCopy(project),
    ...generateRedditCopy(project),
    ...generateDouyinCopy(project),
    ...generateProductHuntCopy(project),
    ...generateHackerNewsCopy(project),
    ...generateWechatCopy(project),
    ...generateBilibiliCopy(project),
    ...generateDiscordCopy(project),
  ];

  return {
    copy,
    headlines: generateHeadlines(project),
    screenshots: generateScreenshotScripts(project),
    videos: generateVideoScripts(project),
    seo: generateSEO(project),
  };
}

/* ──────────────────────────────────────────────
   File Writing
   ────────────────────────────────────────────── */

export function writeMarketingAssets(
  _project: Project,
  assets: MarketingAssets,
  channels: ChannelRecommendation[],
  schedule: PostScheduleItem[],
  outputDir: string,
): void {
  mkdirSync(outputDir, { recursive: true });

  // 1. Copy variants
  const copyDir = join(outputDir, 'copy');
  mkdirSync(copyDir, { recursive: true });
  for (const variant of assets.copy) {
    const filename = `${variant.platform.replace(/[^a-z0-9]/gi, '_')}_${variant.language}.md`;
    const content = `# ${variant.platform} (${variant.language.toUpperCase()})\n\n## 标题\n${variant.headline}\n\n## 正文\n${variant.body}\n\n## 标签\n${variant.hashtags.join(' ')}\n\n## CTA\n${variant.cta}\n`;
    writeFileSync(join(copyDir, filename), content, 'utf-8');
  }

  // 2. Headlines
  const headlinesContent = assets.headlines.map((h) => `- [${h.angle}] ${h.text}`).join('\n');
  writeFileSync(join(outputDir, 'headlines.md'), `# A/B 测试标题候选\n\n${headlinesContent}\n`, 'utf-8');

  // 3. Screenshot scripts
  const screenshotContent = assets.screenshots.map((s, i) =>
    `## 截图 ${i + 1}: ${s.title}\n- 说明: ${s.description}\n- 理想时长: ${s.idealDuration}\n- 关键视觉: ${s.keyVisual}\n`
  ).join('\n');
  writeFileSync(join(outputDir, 'screenshot-guide.md'), `# 截图/录屏指南\n\n${screenshotContent}\n`, 'utf-8');

  // 4. Video scripts
  const videoDir = join(outputDir, 'scripts');
  mkdirSync(videoDir, { recursive: true });
  for (const script of assets.videos) {
    const filename = `video_${script.duration}s.md`;
    const scenes = script.scenes.map((s) =>
      `### ${s.time}\n- 画面: ${s.visual}\n- 音频: ${s.audio}\n- 字幕: ${s.text}\n`
    ).join('\n');
    const content = `# ${script.duration} 秒视频脚本\n\n${scenes}\n\n## 音乐建议\n${script.musicSuggestion}\n`;
    writeFileSync(join(videoDir, filename), content, 'utf-8');
  }

  // 5. SEO
  const seoContent = `# SEO 配置\n\n## 页面标题\n${assets.seo.title}\n\n## Meta Description\n${assets.seo.metaDescription}\n\n## 关键词\n${assets.seo.keywords.join(', ')}\n\n## Open Graph\n- og:title: ${assets.seo.ogTitle}\n- og:description: ${assets.seo.ogDescription}\n\n## Landing Page 文案\n### 主标题\n${assets.seo.landingPageHeadline}\n\n### 副标题\n${assets.seo.landingPageSubhead}\n\n### CTA 按钮\n${assets.seo.landingPageCta}\n`;
  writeFileSync(join(outputDir, 'seo.md'), seoContent, 'utf-8');

  // 6. Channel plan
  const channelContent = channels.map((c) =>
    `## ${c.name}\n- 语言: ${c.language}\n- 最佳时间: ${c.bestTime}\n- 预估曝光: ${c.estimatedReach}\n- 投入成本: ${c.effort}\n- 内容形式: ${c.format}\n- 具体建议:\n${c.specificTips.map((t) => `  - ${t}`).join('\n')}\n`
  ).join('\n');
  writeFileSync(join(outputDir, 'channels.md'), `# 推荐发布渠道\n\n${channelContent}\n`, 'utf-8');

  // 7. Schedule
  const scheduleContent = schedule.map((s) =>
    `### Day ${s.day}: ${s.channel}\n- 时间: ${s.time}\n- 内容类型: ${s.contentType}\n- 备注: ${s.notes}\n`
  ).join('\n');
  writeFileSync(join(outputDir, 'schedule.md'), `# 发布日历\n\n${scheduleContent}\n`, 'utf-8');
}

/* ──────────────────────────────────────────────
   Terminal Formatting
   ────────────────────────────────────────────── */

export function formatMarketingPlan(
  assets: MarketingAssets,
  channels: ChannelRecommendation[],
  schedule: PostScheduleItem[],
): string {
  const zhCopy = assets.copy.filter((c) => c.language === 'zh').length;
  const enCopy = assets.copy.filter((c) => c.language === 'en').length;

  // Estimate reach
  let totalMin = 0;
  let totalMax = 0;
  for (const ch of channels) {
    const match = ch.estimatedReach.match(/(\d+(?:,\d+)*).*?(\d+(?:,\d+)*)/);
    if (match) {
      totalMin += parseInt(match[1].replace(/,/g, ''));
      totalMax += parseInt(match[2].replace(/,/g, ''));
    }
  }

  let out = '\n📢 运营方案已生成\n';
  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  out += `📝 文案：${zhCopy} 版中文 + ${enCopy} 版英文（在 marketing/copy/）\n`;
  out += `🎬 视频脚本：${assets.videos.map((v) => `${v.duration}s`).join('/')}（在 marketing/scripts/）\n`;
  out += `📸 截图指南：${assets.screenshots.length} 张必拍角度（在 marketing/screenshot-guide.md）\n`;
  out += `🏷️  A/B 标题：${assets.headlines.length} 个候选（在 marketing/headlines.md）\n`;
  out += `🔍 SEO 配置：关键词 + Meta + Landing Page（在 marketing/seo.md）\n`;
  out += '\n📅 发布日历：\n';

  for (const s of schedule.slice(0, 6)) {
    out += `Day ${s.day}: ${s.channel}（${s.time}）\n`;
  }
  if (schedule.length > 6) {
    out += `... 还有 ${schedule.length - 6} 个渠道\n`;
  }

  out += '\n🎯 预估首周曝光：';
  if (totalMin > 0 && totalMax > 0) {
    out += `${totalMin.toLocaleString()}-${totalMax.toLocaleString()} PV\n`;
  } else {
    out += '视执行效果而定\n';
  }

  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  return out;
}

/* ──────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────── */

export function generateMarketingPlan(project: Project): {
  assets: MarketingAssets;
  channels: ChannelRecommendation[];
  schedule: PostScheduleItem[];
} {
  const assets = generateAssets(project);
  const channels = selectChannels(project);
  const schedule = generateSchedule(channels);
  return { assets, channels, schedule };
}

export { selectChannels, generateSchedule, generateSEO };
