/**
 * Game Playability Scorer — objective scoring based on static code analysis.
 *
 * Analyzes game source code to detect:
 * - Variety of game entities (enemies, towers, collectibles)
 * - Progression systems (waves, levels, upgrades)
 * - Economy systems (currency, shops)
 * - Input feedback and visual polish
 *
 * Returns a 0-100 score with per-category breakdown and actionable suggestions.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { debugLog } from '../debug.js';

export interface PlayabilityCategory {
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  details: string[];
}

export interface PlayabilityScore {
  total: number;
  categories: PlayabilityCategory[];
  suggestions: string[];
  verdict: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  gameType: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Game type detection
// ─────────────────────────────────────────────────────────────────────────────

export function detectGameType(code: string, ideaText?: string): string {
  const text = (ideaText || '') + ' ' + code;
  const lower = text.toLowerCase();

  if (lower.includes('塔防') || lower.includes('tower defense') || lower.includes('tower') && lower.includes('enemy')) {
    return 'tower-defense';
  }
  if (lower.includes('平台') || lower.includes('platform') || lower.includes('跳跃') || lower.includes('jump') && lower.includes('run')) {
    return 'platformer';
  }
  if (lower.includes('赛车') || lower.includes('racing') || lower.includes('car') || lower.includes('drive') || lower.includes('race')) {
    return 'racing';
  }
  if (lower.includes('消除') || lower.includes('match') || lower.includes('三消') || lower.includes('puzzle')) {
    return 'puzzle';
  }
  if (lower.includes('射击') || lower.includes('shooter') || lower.includes('bullet') || lower.includes('space')) {
    return 'shooter';
  }
  return 'generic';
}

// ─────────────────────────────────────────────────────────────────────────────
// Code extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractGameCode(gameDir: string): string {
  const parts: string[] = [];
  const htmlPath = join(gameDir, 'index.html');
  if (existsSync(htmlPath)) {
    parts.push(readFileSync(htmlPath, 'utf-8'));
  }

  function collect(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          collect(join(dir, entry.name));
        } else if (entry.isFile() && /\.(js|ts|jsx|tsx)$/.test(entry.name)) {
          parts.push(readFileSync(join(dir, entry.name), 'utf-8'));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`Game playability readdir failed: ${dir}`, msg);
    }
  }
  collect(gameDir);
  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Detection helpers
// ─────────────────────────────────────────────────────────────────────────────

function countMatches(code: string, patterns: RegExp[]): number {
  let count = 0;
  const seen = new Set<string>();
  for (const p of patterns) {
    const matches = code.match(p);
    if (matches) {
      for (const m of matches) {
        const key = m.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!seen.has(key)) {
          seen.add(key);
          count++;
        }
      }
    }
  }
  return count;
}

function hasPattern(code: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(code));
}

// ─────────────────────────────────────────────────────────────────────────────
// Category scorers (return { score, maxScore, details })
// ─────────────────────────────────────────────────────────────────────────────

const TOWER_DEFENSE_CATEGORIES = [
  {
    name: '防御塔多样性',
    weight: 20,
    detect: (code: string) => {
      const patterns = [
        /tower\w*/gi, /turret\w*/gi, /防御塔/g, /炮塔/g, /箭塔/g,
        /class\s+\w*[tT]ower/g, /class\s+\w*[tT]urret/g,
        /createTower/g, /placeTower/g, /buildTower/g,
      ];
      const count = countMatches(code, patterns);
      const score = Math.min(20, count * 5);
      return {
        score,
        details: [`检测到 ${count} 种防御塔相关定义`],
      };
    },
  },
  {
    name: '敌人类型多样性',
    weight: 20,
    detect: (code: string) => {
      const patterns = [
        /enemy\w*/gi, /mob\w*/gi, /monster\w*/gi, /creep\w*/gi,
        /敌人/g, /怪物/g, /僵尸/g, /小兵/g,
        /class\s+\w*[eE]nemy/g, /class\s+\w*[mM]ob/g,
      ];
      const count = countMatches(code, patterns);
      const score = Math.min(20, count * 5);
      return {
        score,
        details: [`检测到 ${count} 种敌人相关定义`],
      };
    },
  },
  {
    name: '波次与关卡设计',
    weight: 15,
    detect: (code: string) => {
      const hasWave = hasPattern(code, [/wave\w*/gi, /round\w*/gi, /波次/g, /波数/g, /waveNumber/g]);
      const hasLevel = hasPattern(code, [/level\w*/gi, /stage\w*/gi, /关卡/g, /关卡/g]);
      const hasSpawn = hasPattern(code, [/spawn\w*/gi, /spawnEnemy/g, /生成敌人/g, /出兵/g]);
      const score = (hasWave ? 7 : 0) + (hasLevel ? 5 : 0) + (hasSpawn ? 3 : 0);
      return {
        score,
        details: [
          hasWave ? '✅ 有波次系统' : '❌ 缺少波次系统',
          hasLevel ? '✅ 有关卡设计' : '❌ 缺少关卡设计',
          hasSpawn ? '✅ 有敌人生成逻辑' : '❌ 缺少敌人生成',
        ],
      };
    },
  },
  {
    name: '经济与升级系统',
    weight: 15,
    detect: (code: string) => {
      const hasCurrency = hasPattern(code, [/gold\w*/gi, /coin\w*/gi, /money\w*/gi, /currency/gi, /金币/g, /金钱/g, /积分/g]);
      const hasUpgrade = hasPattern(code, [/upgrade\w*/gi, /levelUp/gi, /enhance/gi, /升级/g, /强化/g, /shop/gi, /商店/g]);
      const score = (hasCurrency ? 8 : 0) + (hasUpgrade ? 7 : 0);
      return {
        score,
        details: [
          hasCurrency ? '✅ 有货币/积分系统' : '❌ 缺少货币系统',
          hasUpgrade ? '✅ 有升级/商店系统' : '❌ 缺少升级系统',
        ],
      };
    },
  },
  {
    name: '操作与交互流畅度',
    weight: 15,
    detect: (code: string) => {
      const hasClick = hasPattern(code, [/click/gi, /mousedown/gi, /pointerdown/gi, /触摸/g]);
      const hasDrag = hasPattern(code, [/drag/gi, /mousemove/gi, /touchmove/gi, /拖拽/g]);
      const hasKeyboard = hasPattern(code, [/keydown/gi, /keyup/gi, /键盘/g]);
      const score = (hasClick ? 5 : 0) + (hasDrag ? 5 : 0) + (hasKeyboard ? 5 : 0);
      return {
        score,
        details: [
          hasClick ? '✅ 支持点击/触摸' : '❌ 缺少点击交互',
          hasDrag ? '✅ 支持拖拽' : '❌ 缺少拖拽交互',
          hasKeyboard ? '✅ 支持键盘' : '❌ 缺少键盘交互',
        ],
      };
    },
  },
  {
    name: '视觉与反馈',
    weight: 15,
    detect: (code: string) => {
      const hasParticle = hasPattern(code, [/particle/gi, /effect/gi, /explosion/gi, /粒子/g, /特效/g, /爆炸/g]);
      const hasAnimation = hasPattern(code, [/animation/gi, /animate/gi, /tween/gi, /动画/g, /渐变/g]);
      const hasHealthBar = hasPattern(code, [/healthbar/gi, /health.*bar/gi, /hp.*bar/gi, /血条/g, /生命条/g]);
      const score = (hasParticle ? 5 : 0) + (hasAnimation ? 5 : 0) + (hasHealthBar ? 5 : 0);
      return {
        score,
        details: [
          hasParticle ? '✅ 有粒子/特效' : '❌ 缺少粒子特效',
          hasAnimation ? '✅ 有动画系统' : '❌ 缺少动画',
          hasHealthBar ? '✅ 有血条显示' : '❌ 缺少血条',
        ],
      };
    },
  },
];

const PLATFORMER_CATEGORIES = [
  {
    name: '关卡设计',
    weight: 25,
    detect: (code: string) => {
      const patterns = [
        /platform\w*/gi, /ground\w*/gi, /block\w*/gi, /brick\w*/gi,
        /平台/g, /地面/g, /砖块/g, /跳板/g, /弹簧/g,
      ];
      const count = countMatches(code, patterns);
      const hasMoving = hasPattern(code, [/moving.*platform/gi, /滑动平台/g, /移动平台/g]);
      const score = Math.min(25, count * 3 + (hasMoving ? 5 : 0));
      return {
        score,
        details: [`检测到 ${count} 种平台/关卡元素`, hasMoving ? '✅ 有移动平台' : '❌ 缺少移动平台'],
      };
    },
  },
  {
    name: '物理手感',
    weight: 25,
    detect: (code: string) => {
      const hasGravity = hasPattern(code, [/gravity/gi, /重力/g, /gravit/g]);
      const hasJump = hasPattern(code, [/jump/gi, /跳跃/g, /弹跳/g, /二段跳/g]);
      const hasVelocity = hasPattern(code, [/velocity/gi, /speed/gi, /速度/g, /加速度/g, /friction/gi, /摩擦/g]);
      const score = (hasGravity ? 10 : 0) + (hasJump ? 8 : 0) + (hasVelocity ? 7 : 0);
      return {
        score,
        details: [
          hasGravity ? '✅ 有重力系统' : '❌ 缺少重力',
          hasJump ? '✅ 有跳跃机制' : '❌ 缺少跳跃',
          hasVelocity ? '✅ 有速度/摩擦参数' : '❌ 缺少物理参数',
        ],
      };
    },
  },
  {
    name: '敌人与障碍多样性',
    weight: 20,
    detect: (code: string) => {
      const patterns = [/enemy\w*/gi, /trap\w*/gi, /spike\w*/gi, /pit\w*/gi, /敌人/g, /陷阱/g, /尖刺/g, /坑/g];
      const count = countMatches(code, patterns);
      const score = Math.min(20, count * 5);
      return {
        score,
        details: [`检测到 ${count} 种敌人/障碍定义`],
      };
    },
  },
  {
    name: '收集品系统',
    weight: 15,
    detect: (code: string) => {
      const patterns = [/coin\w*/gi, /gem\w*/gi, /star\w*/gi, /collectible/gi, /金币/g, /宝石/g, /星星/g, /收集/g];
      const count = countMatches(code, patterns);
      const score = Math.min(15, count * 5);
      return {
        score,
        details: [`检测到 ${count} 种收集品`],
      };
    },
  },
  {
    name: '死亡与重生机制',
    weight: 15,
    detect: (code: string) => {
      const hasDeath = hasPattern(code, [/death/gi, /die\b/gi, /kill/gi, /死亡/g, /死亡/g]);
      const hasRespawn = hasPattern(code, [/respawn/gi, /restart/gi, /checkpoint/gi, /重生/g, /复活/g, /检查点/g]);
      const hasLives = hasPattern(code, [/lives/gi, /life\b/gi, /heart/gi, /命/g, /生命/g, /爱心/g]);
      const score = (hasDeath ? 5 : 0) + (hasRespawn ? 6 : 0) + (hasLives ? 4 : 0);
      return {
        score,
        details: [
          hasDeath ? '✅ 有死亡判定' : '❌ 缺少死亡判定',
          hasRespawn ? '✅ 有重生/检查点' : '❌ 缺少重生机制',
          hasLives ? '✅ 有生命数系统' : '❌ 缺少生命数',
        ],
      };
    },
  },
];

const RACING_CATEGORIES = [
  {
    name: '操控响应',
    weight: 25,
    detect: (code: string) => {
      const hasSteer = hasPattern(code, [/steer/gi, /turn/gi, /left/gi, /right/gi, /转向/g, /转弯/g]);
      const hasAccel = hasPattern(code, [/accelerat/gi, /speed\b/gi, /throttle/gi, /加速/g, /油门/g]);
      const hasBrake = hasPattern(code, [/brake/gi, /drift/gi, /刹车/g, /漂移/g]);
      const score = (hasSteer ? 10 : 0) + (hasAccel ? 8 : 0) + (hasBrake ? 7 : 0);
      return {
        score,
        details: [
          hasSteer ? '✅ 有转向控制' : '❌ 缺少转向',
          hasAccel ? '✅ 有加速控制' : '❌ 缺少加速',
          hasBrake ? '✅ 有刹车/漂移' : '❌ 缺少刹车',
        ],
      };
    },
  },
  {
    name: '障碍物多样性',
    weight: 20,
    detect: (code: string) => {
      const patterns = [/obstacle/gi, /barrier/gi, /roadblock/gi, /traffic/gi, /障碍物/g, /路障/g, /车辆/g];
      const count = countMatches(code, patterns);
      const score = Math.min(20, count * 5);
      return {
        score,
        details: [`检测到 ${count} 种障碍物`],
      };
    },
  },
  {
    name: '速度感',
    weight: 20,
    detect: (code: string) => {
      const hasSpeed = hasPattern(code, [/speed\b/gi, /velocity/gi, /mph/gi, /kmh/gi, /速度/g, /时速/g]);
      const hasBoost = hasPattern(code, [/boost/gi, /nitro/gi, /turbo/gi, /加速带/g, /氮气/g]);
      const hasCamera = hasPattern(code, [/camera/gi, /scroll/gi, /parallax/gi, /视角/g, /滚动/g, /视差/g]);
      const score = (hasSpeed ? 8 : 0) + (hasBoost ? 6 : 0) + (hasCamera ? 6 : 0);
      return {
        score,
        details: [
          hasSpeed ? '✅ 有速度显示' : '❌ 缺少速度显示',
          hasBoost ? '✅ 有加速道具' : '❌ 缺少加速道具',
          hasCamera ? '✅ 有摄像机/视差' : '❌ 缺少摄像机效果',
        ],
      };
    },
  },
  {
    name: '道具系统',
    weight: 20,
    detect: (code: string) => {
      const patterns = [/item\w*/gi, /powerup/gi, /power-up/gi, /mystery/gi, /道具/g, /能量/g, /磁铁/g, /护盾/g];
      const count = countMatches(code, patterns);
      const score = Math.min(20, count * 5);
      return {
        score,
        details: [`检测到 ${count} 种道具`],
      };
    },
  },
  {
    name: '进度保存',
    weight: 15,
    detect: (code: string) => {
      const hasSave = hasPattern(code, [/localStorage/gi, /save\b/gi, /storage/gi, /保存/g, /存储/g]);
      const hasBest = hasPattern(code, [/best.*time/gi, /highscore/gi, /record/gi, /最佳/g, /纪录/g, /排行榜/g]);
      const hasUnlock = hasPattern(code, [/unlock/gi, /achievement/gi, /解锁/g, /成就/g]);
      const score = (hasSave ? 6 : 0) + (hasBest ? 5 : 0) + (hasUnlock ? 4 : 0);
      return {
        score,
        details: [
          hasSave ? '✅ 有存档系统' : '❌ 缺少存档',
          hasBest ? '✅ 有最佳纪录' : '❌ 缺少纪录系统',
          hasUnlock ? '✅ 有解锁/成就' : '❌ 缺少解锁系统',
        ],
      };
    },
  },
];

const GENERIC_CATEGORIES = [
  {
    name: '实体多样性',
    weight: 25,
    detect: (code: string) => {
      const entityPatterns = [
        /class\s+\w+/g, /function\s+\w+Enemy/g, /function\s+\w+Boss/g,
        /createEnemy/g, /spawnMonster/g, /new\s+\w+\(/g,
      ];
      const count = countMatches(code, entityPatterns);
      const score = Math.min(25, count * 3);
      return {
        score,
        details: [`检测到 ${count} 个类/对象定义`],
      };
    },
  },
  {
    name: '进度与难度',
    weight: 25,
    detect: (code: string) => {
      const hasLevel = hasPattern(code, [/level\w*/gi, /stage\w*/gi, /wave\w*/gi, /round\w*/gi, /关卡/g, /波次/g]);
      const hasDifficulty = hasPattern(code, [/difficult/gi, /hard\b/gi, /easy/gi, /难度/g, /简单/g, /困难/g]);
      const score = (hasLevel ? 15 : 0) + (hasDifficulty ? 10 : 0);
      return {
        score,
        details: [
          hasLevel ? '✅ 有关卡/波次系统' : '❌ 缺少关卡系统',
          hasDifficulty ? '✅ 有难度调节' : '❌ 缺少难度设计',
        ],
      };
    },
  },
  {
    name: '经济与奖励',
    weight: 20,
    detect: (code: string) => {
      const hasCurrency = hasPattern(code, [/score\b/gi, /point/gi, /gold/gi, /coin/gi, /积分/g, /金币/g, /分数/g]);
      const hasReward = hasPattern(code, [/reward/gi, /bonus/gi, /upgrade/gi, /奖励/g, /升级/g, /强化/g]);
      const score = (hasCurrency ? 10 : 0) + (hasReward ? 10 : 0);
      return {
        score,
        details: [
          hasCurrency ? '✅ 有计分/货币系统' : '❌ 缺少计分系统',
          hasReward ? '✅ 有奖励/升级' : '❌ 缺少奖励系统',
        ],
      };
    },
  },
  {
    name: '交互反馈',
    weight: 15,
    detect: (code: string) => {
      const hasInput = hasPattern(code, [/click/gi, /keydown/gi, /touch/gi, /mouse/gi, /输入/g, /触摸/g]);
      const hasFeedback = hasPattern(code, [/shake/gi, /flash/gi, /particle/gi, /sound/gi, /audio/gi, /震动/g, /闪烁/g, /音效/g]);
      const score = (hasInput ? 8 : 0) + (hasFeedback ? 7 : 0);
      return {
        score,
        details: [
          hasInput ? '✅ 有多种输入方式' : '❌ 输入方式单一',
          hasFeedback ? '✅ 有视觉/音效反馈' : '❌ 缺少反馈',
        ],
      };
    },
  },
  {
    name: 'UI 与状态',
    weight: 15,
    detect: (code: string) => {
      const hasUI = hasPattern(code, [/hud/gi, /ui\b/gi, /menu/gi, /button/gi, /界面/g, /菜单/g, /按钮/g]);
      const hasStates = hasPattern(code, [/start.*screen/gi, /gameover/gi, /pause/gi, /开始界面/g, /结束/g, /暂停/g]);
      const score = (hasUI ? 8 : 0) + (hasStates ? 7 : 0);
      return {
        score,
        details: [
          hasUI ? '✅ 有 UI/按钮' : '❌ 缺少 UI',
          hasStates ? '✅ 有开始/结束/暂停' : '❌ 缺少游戏状态',
        ],
      };
    },
  },
];

const CATEGORY_MAP: Record<string, typeof TOWER_DEFENSE_CATEGORIES> = {
  'tower-defense': TOWER_DEFENSE_CATEGORIES,
  'platformer': PLATFORMER_CATEGORIES,
  'racing': RACING_CATEGORIES,
  'generic': GENERIC_CATEGORIES,
  'puzzle': GENERIC_CATEGORIES,
  'shooter': GENERIC_CATEGORIES,
};

// ─────────────────────────────────────────────────────────────────────────────
// Suggestion generation
// ─────────────────────────────────────────────────────────────────────────────

export function generateSuggestions(categories: PlayabilityCategory[], gameType: string): string[] {
  const suggestions: string[] = [];
  const lowCategories = categories.filter((c) => c.score < c.maxScore * 0.5);

  for (const cat of lowCategories) {
    const templates: Record<string, Record<string, string>> = {
      'tower-defense': {
        '防御塔多样性': '建议增加 2-3 种不同功能的防御塔（如减速塔、范围伤害塔）',
        '敌人类型多样性': '建议增加 2-3 种敌人（如快速小怪、高血量 Boss）',
        '波次与关卡设计': '建议设计波次递增难度，每 5 波增加一种新敌人',
        '经济与升级系统': '建议增加金币掉落和防御塔升级商店',
        '操作与交互流畅度': '建议支持拖拽放置防御塔和快捷键切换',
        '视觉与反馈': '建议增加防御塔攻击特效和敌人死亡动画',
      },
      'platformer': {
        '关卡设计': '建议增加移动平台、弹簧、传送门等关卡元素',
        '物理手感': '建议调整重力、跳跃高度和空中控制感',
        '敌人与障碍多样性': '建议增加巡逻敌人、陷阱、移动障碍',
        '收集品系统': '建议增加金币、宝石或隐藏道具',
        '死亡与重生机制': '建议增加检查点和生命数显示',
      },
      'racing': {
        '操控响应': '建议增加转向灵敏度和漂移手感',
        '障碍物多样性': '建议增加油渍、路障、对向车辆',
        '速度感': '建议增加速度表、加速带和摄像机震动',
        '道具系统': '建议增加磁铁、护盾、加速道具',
        '进度保存': '建议增加本地存档和最佳时间纪录',
      },
    };

    const typeTemplates = templates[gameType] || {};
    const msg = typeTemplates[cat.name] || `建议改进「${cat.name}」以提升游戏体验`;
    suggestions.push(msg);
  }

  if (suggestions.length === 0) {
    suggestions.push('游戏可玩性良好，可以考虑增加更多关卡或成就系统来提升留存。');
  }

  return suggestions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scoring function
// ─────────────────────────────────────────────────────────────────────────────

export function scorePlayability(gameDir: string, ideaText?: string): PlayabilityScore {
  const code = extractGameCode(gameDir);
  const gameType = detectGameType(code, ideaText);
  const categoryDefs = CATEGORY_MAP[gameType] || GENERIC_CATEGORIES;

  const categories: PlayabilityCategory[] = [];
  for (const def of categoryDefs) {
    const detected = def.detect(code);
    categories.push({
      name: def.name,
      score: detected.score,
      maxScore: def.weight,
      weight: def.weight,
      details: detected.details,
    });
  }

  const total = categories.reduce((sum, c) => sum + c.score, 0);
  const maxTotal = categories.reduce((sum, c) => sum + c.maxScore, 0);
  const normalized = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

  let verdict: PlayabilityScore['verdict'];
  if (normalized >= 80) verdict = 'excellent';
  else if (normalized >= 60) verdict = 'good';
  else if (normalized >= 40) verdict = 'needs_improvement';
  else verdict = 'poor';

  const suggestions = generateSuggestions(categories, gameType);

  return {
    total: normalized,
    categories,
    suggestions,
    verdict,
    gameType,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal formatting
// ─────────────────────────────────────────────────────────────────────────────

export function formatPlayabilityScore(score: PlayabilityScore): string {
  const verdictLabel: Record<string, string> = {
    excellent: '优秀，可直接部署 🏆',
    good: '良好 👍',
    needs_improvement: '需要改进 ⚠️',
    poor: '较差，建议重写 ❌',
  };

  const lines: string[] = [
    ``,
    `🎮 可玩性评分：${score.total}/100（${verdictLabel[score.verdict]}）`,
    `   检测到的游戏类型：${score.gameType}`,
    ``,
    `   各维度得分：`,
  ];

  for (const cat of score.categories) {
    const bar = '█'.repeat(Math.round(cat.score / cat.maxScore * 10)).padEnd(10, '░');
    lines.push(`   ${bar} ${cat.name}: ${cat.score}/${cat.maxScore}`);
    for (const detail of cat.details.slice(0, 2)) {
      lines.push(`      ${detail}`);
    }
  }

  lines.push('');
  lines.push('   💡 改进建议：');
  for (const s of score.suggestions.slice(0, 3)) {
    lines.push(`      • ${s}`);
  }
  lines.push('');

  return lines.join('\n');
}
