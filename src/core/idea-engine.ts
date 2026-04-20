import { randomUUID } from 'crypto';
import type { CreativeType, MonetizationChannel, Complexity, Idea, ParseResult } from '../types/index.js';

/**
 * Keyword-based rule engine for parsing user ideas.
 * Zero AI cost — fast, deterministic, extensible.
 */

const TYPE_KEYWORDS: Record<CreativeType, string[]> = {
  game: [
    // English game terms
    'game', 'snake', 'tetris', 'puzzle', 'match-3', 'match 3', 'match3',
    'breakout', 'arkanoid', 'platformer', 'shooter', 'racing', 'arcade',
    'roguelike', 'roguelite', 'dungeon', 'tower defense', 'td',
    'card game', 'board game', 'word game', 'quiz', 'trivia',
    'endless runner', 'runner', 'jump', 'flappy', 'doodle',
    '2048', 'sudoku', 'chess', 'minesweeper', 'solitaire',
    'typing', 'rhythm', 'guitar hero', 'bejeweled', 'bubble shooter',
    'pinball', 'pool', 'billiards', 'bowling', 'golf', 'soccer', 'football',
    'basketball', 'volleyball', 'tennis', 'hockey', 'boxing', 'wrestling',
    'fishing', 'hunting', 'driving', 'parking', 'drift', 'flight',
    'space', 'alien', 'zombie', 'ninja', 'samurai', 'knight', 'pirate',
    'pokemon', 'mario', 'sonic', 'zelda', 'minecraft', 'fortnite',
    'puzzle bobble', 'columns', 'hexagon', 'hexa', 'block', 'brick',
    'pong', 'asteroids', 'invaders', 'galaga', 'pacman', 'pac-man',
    // Chinese game terms
    '游戏', '塔防', '跑酷', 'rpg', 'slg', '休闲', '益智', '卡牌', '射击', '策略', '冒险', '解谜', '格斗', '竞速', '模拟', '经营', '养成', '消除', '合成', '放置', '挂机', '对战', 'moba', 'fps',
    '打砖块', '贪吃蛇', '俄罗斯方块', '消消乐', '连连看', '飞机大战', '坦克大战',
    '斗地主', '麻将', '扑克', '象棋', '围棋', '五子棋', '军棋', '跳棋',
    '弹球', '台球', '保龄球', '高尔夫', '足球', '篮球', '网球',
    '节奏', '音游', '音乐游戏', '跳舞', '跑酷', '飞行', '赛车',
  ],
  music: ['音乐', '歌曲', '歌', '作曲', '编曲', '专辑', '歌手', '乐队', '旋律', 'beat', '混音', '音效', '配乐', '单曲', 'ep', 'music', 'song', 'album'],
  content: ['文章', '博客', '视频', '播客', '公众号', '内容', '写作', '小说', '专栏', '教程', '指南', 'vlog', '短视频', '直播', 'up主', 'blog', 'article', 'video', 'content'],
  tool: ['工具', '助手', '计算器', '记账', '翻译', '词典', '日历', '提醒', '待办', '笔记', '浏览器', '编辑器', '播放器', '下载器', '转换器', 'tool', 'app', 'calculator', 'translator', 'tracker', 'generator', 'converter', 'formatter', 'parser', 'scraper', 'ai assistant'],
  bot: ['机器人', 'bot', 'chatbot', 'discord', 'telegram', 'slack', 'qq机器人', '飞书机器人'],
  unknown: [],
};

/**
 * Monetization keywords with weights.
 * Platform-specific names (微信, 抖音, Steam) have higher weight than generic terms (小程序, app, web).
 */
const MONETIZATION_KEYWORDS: Record<MonetizationChannel, Array<{ word: string; weight: number }>> = {
  'wechat-miniprogram': [
    { word: '微信', weight: 3 },
    { word: 'miniprogram', weight: 3 },
    { word: 'wechat', weight: 3 },
    { word: '微信支付', weight: 2 },
    { word: '公众号', weight: 2 },
    { word: '小程序', weight: 1 },
  ],
  douyin: [
    { word: '抖音', weight: 3 },
    { word: 'douyin', weight: 3 },
    { word: 'tiktok', weight: 3 },
    { word: '抖店', weight: 2 },
    { word: '巨量', weight: 2 },
    { word: 'dy', weight: 1 },
  ],
  steam: [
    { word: 'steam', weight: 3 },
    { word: 'epic', weight: 3 },
    { word: 'gog', weight: 3 },
    { word: 'itch', weight: 3 },
    { word: '桌面端', weight: 2 },
    { word: '单机', weight: 1 },
    { word: 'pc', weight: 1 },
  ],
  web: [
    { word: 'h5', weight: 3 },
    { word: 'online', weight: 2 },
    { word: '网页', weight: 2 },
    { word: '网站', weight: 2 },
    { word: 'web', weight: 1 },
    { word: '浏览器', weight: 1 },
    { word: '线上', weight: 1 },
    { word: '互联网', weight: 1 },
  ],
  'app-store': [
    { word: 'ios', weight: 3 },
    { word: 'iphone', weight: 3 },
    { word: 'ipad', weight: 3 },
    { word: '苹果', weight: 3 },
    { word: 'appstore', weight: 3 },
    { word: '应用商店', weight: 2 },
    { word: 'app', weight: 1 },
  ],
  'google-play': [
    { word: 'android', weight: 3 },
    { word: '安卓', weight: 3 },
    { word: 'googleplay', weight: 3 },
    { word: 'play商店', weight: 3 },
    { word: 'apk', weight: 2 },
    { word: 'google', weight: 1 },
  ],
  unknown: [],
};

const COMPLEXITY_KEYWORDS: Record<Complexity, string[]> = {
  simple: ['简单', '小游戏', '单页面', '轻量', '迷你', 'mini', '极简', '基础', '入门'],
  complex: ['复杂', '大型', '多人', '联网', '3d', 'mmo', '开放世界', '重度', '硬核', '高品质', '高清', '元宇宙', 'vr', 'ar'],
  medium: [],
};

const STOP_WORDS = new Set([
  '我', '要', '做', '一个', '并且', '帮我', '部署', '赚钱', '的', '是', '在', '有', '和', '了', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '能', '去', '你', '会', '着', '没有', '看', '好', '自己', '这',
]);

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((count, kw) => {
    const regex = new RegExp(kw.toLowerCase(), 'g');
    const matches = lower.match(regex);
    return count + (matches ? matches.length : 0);
  }, 0);
}

function countWeightedMatches(text: string, keywords: Array<{ word: string; weight: number }>): number {
  const lower = text.toLowerCase();
  return keywords.reduce((score, { word, weight }) => {
    const regex = new RegExp(word.toLowerCase(), 'g');
    const matches = lower.match(regex);
    return score + (matches ? matches.length * weight : 0);
  }, 0);
}

function detectByKeywords(text: string, keywordMap: Record<string, string[]>): string {
  let bestKey = 'unknown';
  let bestScore = 0;

  for (const [key, keywords] of Object.entries(keywordMap)) {
    if (key === 'unknown') continue;
    const score = countMatches(text, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}

function detectMonetization(text: string): MonetizationChannel {
  let bestKey: MonetizationChannel = 'unknown';
  let bestScore = 0;

  for (const [key, keywords] of Object.entries(MONETIZATION_KEYWORDS)) {
    if (key === 'unknown') continue;
    const score = countWeightedMatches(text, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key as MonetizationChannel;
    }
  }

  return bestKey;
}

function extractKeywords(text: string): string[] {
  // Extract keywords by matching against all known keyword tables.
  // This is more accurate for Chinese than naive splitting.
  const allKeywords = new Set<string>();

  // Collect type keywords
  for (const keywords of Object.values(TYPE_KEYWORDS)) {
    keywords.forEach((k) => allKeywords.add(k));
  }

  // Collect monetization keywords
  for (const entries of Object.values(MONETIZATION_KEYWORDS)) {
    entries.forEach((e) => allKeywords.add(e.word));
  }

  // Collect complexity keywords
  for (const keywords of Object.values(COMPLEXITY_KEYWORDS)) {
    keywords.forEach((k) => allKeywords.add(k));
  }

  // Find matches in text
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const kw of allKeywords) {
    if (lower.includes(kw.toLowerCase()) && !STOP_WORDS.has(kw) && kw.length >= 2) {
      found.push(kw);
    }
  }

  // Deduplicate and sort by length (longer first to avoid sub-match issues)
  const seen = new Set<string>();
  return found
    .filter((k) => {
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.length - a.length);
}

export function parseIdea(rawText: string): ParseResult {
  if (!rawText || rawText.trim().length === 0) {
    return { success: false, error: '想法不能为空' };
  }

  const text = rawText.trim();

  const type = detectByKeywords(text, TYPE_KEYWORDS) as CreativeType;
  const monetization = detectMonetization(text);

  // Complexity: check explicit keywords first, then default based on type
  let complexity: Complexity = 'medium';
  const simpleScore = countMatches(text, COMPLEXITY_KEYWORDS.simple);
  const complexScore = countMatches(text, COMPLEXITY_KEYWORDS.complex);

  if (simpleScore > 0 || complexScore > 0) {
    complexity = simpleScore >= complexScore ? 'simple' : 'complex';
  }

  const keywords = extractKeywords(text);

  const idea: Idea = {
    id: randomUUID(),
    rawText: text,
    type,
    monetization,
    complexity,
    keywords,
    createdAt: new Date().toISOString(),
  };

  return { success: true, idea };
}
