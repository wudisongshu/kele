import type { Idea, MonetizationRoute } from '../types/index.js';
import { hasPlatformCredentials } from '../platform-credentials.js';
import { getDefaultPlatform } from '../config/index.js';

/**
 * Monetization Router — recommends the best monetization path for an idea.
 *
 * Zero AI cost. Rule-driven. Ranks all viable platforms by:
 * - User intent (did they explicitly name a platform?)
 * - Barrier to entry (资质 requirements, costs)
 * - Speed to revenue (time to go live)
 * - Current credentials (already configured?)
 */

interface PlatformRule {
  id: string;
  label: string;
  requirements: string[];
  estimatedDays: number;
  effort: 'low' | 'medium' | 'high';
  autoDeployable: boolean;
  needsSoftWareCopyright: boolean;
  baseScore: number;
  keywordMatches: string[];
  revenueModel: string;
  payoutMethod: string;
  estimatedRevenue: string;
}

const PLATFORM_RULES: PlatformRule[] = [
  {
    id: 'web',
    label: 'H5 网页版',
    requirements: ['域名', '托管平台（Vercel/Cloudflare Pages/阿里云COS）'],
    estimatedDays: 1,
    effort: 'low',
    autoDeployable: true,
    needsSoftWareCopyright: false,
    baseScore: 25,
    keywordMatches: ['网页', 'h5', 'web', 'online', '网站', '浏览器', '线上'],
    revenueModel: '广告变现（Google AdSense / 百度联盟）+ 订阅/付费（Patreon/Ko-fi/Stripe）+ 内购（数字商品）',
    payoutMethod: '电汇至银行卡（AdSense 满 $100 自动打款）/ Stripe/PayPal',
    estimatedRevenue: '日活 1000 ≈ $3-10/天（广告）+ 订阅收入（如有Premium功能）',
  },
  {
    id: 'google-play',
    label: 'Google Play',
    requirements: ['Google Play 开发者账号（$25 一次性）', 'Google 账号', '隐私政策页面'],
    estimatedDays: 7,
    effort: 'medium',
    autoDeployable: true,
    needsSoftWareCopyright: false,
    baseScore: 15,
    keywordMatches: ['android', '安卓', 'googleplay', 'play商店', 'apk', 'google'],
    revenueModel: '广告（AdMob）+ 内购 + 付费下载',
    payoutMethod: '电汇至银行卡（Google Play 满 $1 自动打款）',
    estimatedRevenue: '日活 1000 ≈ $10-50/天（广告+内购）',
  },
  {
    id: 'app-store',
    label: 'App Store（国际版）',
    requirements: ['Apple Developer 账号（$99/年）', 'Apple ID', '隐私政策页面'],
    estimatedDays: 7,
    effort: 'medium',
    autoDeployable: false,
    needsSoftWareCopyright: false,
    baseScore: 10,
    keywordMatches: ['ios', 'iphone', 'ipad', '苹果', 'appstore', '应用商店', 'app'],
    revenueModel: '广告（AdMob）+ 内购 + 付费下载',
    payoutMethod: '电汇至银行卡（Apple 满 $10 自动打款）',
    estimatedRevenue: '日活 1000 ≈ $15-60/天（iOS 用户付费意愿高）',
  },
  {
    id: 'steam',
    label: 'Steam',
    requirements: ['Steamworks 账号', 'Steam Direct 费用（$100/游戏）', '游戏截图+预告片'],
    estimatedDays: 14,
    effort: 'high',
    autoDeployable: false,
    needsSoftWareCopyright: false,
    baseScore: 10,
    keywordMatches: ['steam', 'epic', 'gog', 'itch', '桌面端', '单机', 'pc'],
    revenueModel: '付费下载（一次性购买）',
    payoutMethod: 'Steam 钱包提现至 PayPal / 银行',
    estimatedRevenue: '销量 1000 份 × $5 ≈ $3500（Steam 抽成 30%）',
  },
  {
    id: 'wechat-miniprogram',
    label: '微信小程序',
    requirements: ['微信小程序账号', '微信认证（300元/年，企业）', 'ICP备案', '软著证书', '自审自查报告'],
    estimatedDays: 45,
    effort: 'high',
    autoDeployable: true,
    needsSoftWareCopyright: true,
    baseScore: 0,
    keywordMatches: ['微信', 'miniprogram', 'wechat', '微信支付', '公众号', '小程序'],
    revenueModel: '微信广告（激励视频、插屏广告、Banner）',
    payoutMethod: '自动打款至对公银行账户（企业）或个人银行卡',
    estimatedRevenue: '日活 1000 ≈ ¥30-100/天（eCPM 较高）',
  },
  {
    id: 'douyin',
    label: '抖音小游戏',
    requirements: ['抖音开发者账号', '软著证书', '自审查报告', 'ICP备案（国内服务器）'],
    estimatedDays: 45,
    effort: 'high',
    autoDeployable: false,
    needsSoftWareCopyright: true,
    baseScore: 0,
    keywordMatches: ['抖音', 'douyin', 'tiktok', '抖店', '巨量', 'dy'],
    revenueModel: '穿山甲广告（激励视频、插屏广告）',
    payoutMethod: '自动打款至对公银行账户',
    estimatedRevenue: '日活 1000 ≈ ¥50-200/天（抖音 eCPM 业内最高）',
  },
  {
    id: 'discord-bot',
    label: 'Discord Bot',
    requirements: ['Discord 账号', 'Discord Developer Portal 应用', '服务器托管（VPS/云函数）'],
    estimatedDays: 3,
    effort: 'low',
    autoDeployable: true,
    needsSoftWareCopyright: false,
    baseScore: 15,
    keywordMatches: ['discord', 'bot', '机器人', '服务器', 'server'],
    revenueModel: 'Premium 功能订阅（Patreon/内置订阅）+ 捐赠',
    payoutMethod: 'Patreon / Stripe / PayPal',
    estimatedRevenue: '1000 服务器 ≈ $50-200/月（Premium 订阅）',
  },
  {
    id: 'telegram-bot',
    label: 'Telegram Bot',
    requirements: ['Telegram 账号', 'BotFather 创建 bot', '服务器托管'],
    estimatedDays: 2,
    effort: 'low',
    autoDeployable: true,
    needsSoftWareCopyright: false,
    baseScore: 15,
    keywordMatches: ['telegram', 'tg', 'bot', '机器人'],
    revenueModel: '广告（Telegram Ads）+ Premium 功能 + 捐赠',
    payoutMethod: 'TON 钱包 / Stripe / PayPal',
    estimatedRevenue: '1000 用户 ≈ $20-100/月',
  },
  {
    id: 'itchio',
    label: 'itch.io',
    requirements: ['itch.io 账号（免费）', '游戏截图', '游戏描述'],
    estimatedDays: 1,
    effort: 'low',
    autoDeployable: false,
    needsSoftWareCopyright: false,
    baseScore: 20,
    keywordMatches: ['itch', '独立游戏', 'indie', 'gamejam', 'jam'],
    revenueModel: '付费下载 / 自愿付费（Pay What You Want）',
    payoutMethod: 'PayPal / Stripe（itch.io 抽成可自定义，默认 10%）',
    estimatedRevenue: '销量 100 份 × $5 ≈ $450（itch.io 抽成 10%）',
  },
  {
    id: 'github-sponsors',
    label: 'GitHub Sponsors',
    requirements: ['GitHub 账号', '开源项目仓库'],
    estimatedDays: 1,
    effort: 'low',
    autoDeployable: true,
    needsSoftWareCopyright: false,
    baseScore: 10,
    keywordMatches: ['opensource', '开源', 'github', 'sponsor', '赞助', '捐赠'],
    revenueModel: '月度赞助（GitHub Sponsors）+ 一次性捐赠',
    payoutMethod: '银行转账（GitHub 零抽成）',
    estimatedRevenue: '100 赞助者 × $5/月 ≈ $500/月',
  },
];

/**
 * Calculate the recommendation score for each platform.
 */
export function routeMonetization(idea: Idea): MonetizationRoute[] {
  const routes: MonetizationRoute[] = [];
  const lowerText = idea.rawText.toLowerCase();
  const defaultPlatform = getDefaultPlatform();

  for (const rule of PLATFORM_RULES) {
    let score = rule.baseScore;

    // 0. Default platform from config → big boost (user's preferred platform)
    if (defaultPlatform && rule.id === defaultPlatform) {
      score += 35;
    }

    // 1. Explicit platform mention → big boost
    const explicitMatch = rule.keywordMatches.some((kw) => lowerText.includes(kw.toLowerCase()));
    if (explicitMatch) {
      score += 30;
    }

    // 2. Credentials already configured → boost
    if (hasPlatformCredentials(rule.id)) {
      score += 20;
    }

    // 3. Soft著 barrier penalty for individual developers
    if (rule.needsSoftWareCopyright) {
      score -= 40;
    }

    // 4. Speed bonus — faster to revenue = higher score
    if (rule.estimatedDays <= 1) score += 10;
    else if (rule.estimatedDays <= 7) score += 5;

    // 5. Effort bonus — less manual work = higher score
    if (rule.effort === 'low') score += 5;

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine missing requirements
    const missing: string[] = [];
    if (rule.needsSoftWareCopyright) {
      missing.push('软著证书（AI代码需人工改造后才能申请）');
    }
    if (!hasPlatformCredentials(rule.id)) {
      missing.push(...rule.requirements);
    }

    // Build reason string
    let reason = '';
    if (explicitMatch) {
      reason = '用户明确指定该平台';
    } else if (score >= 80) {
      reason = '零资质门槛，最快变现路径';
    } else if (score >= 60) {
      reason = '国际平台，不需要软著';
    } else if (score >= 40) {
      reason = '可行，但需要额外准备';
    } else {
      reason = '资质门槛较高，建议先走 H5 验证后再申请';
    }

    routes.push({
      platform: rule.id,
      platformLabel: rule.label,
      score,
      reason,
      requirements: rule.requirements,
      missingRequirements: missing,
      estimatedDays: rule.estimatedDays,
      effort: rule.effort,
      autoDeployable: rule.autoDeployable,
      needsSoftWareCopyright: rule.needsSoftWareCopyright,
      revenueModel: rule.revenueModel,
      payoutMethod: rule.payoutMethod,
      estimatedRevenue: rule.estimatedRevenue,
    });
  }

  // Sort by score descending
  return routes.sort((a, b) => b.score - a.score);
}

/**
 * Get the top recommended route.
 */
export function getTopRoute(idea: Idea): MonetizationRoute {
  return routeMonetization(idea)[0];
}

/**
 * Ad placement strategy for a given platform and game type.
 */
export interface AdPlacement {
  type: 'banner' | 'interstitial' | 'rewarded';
  position?: string;
  trigger: string;
  frequency?: string;
}

export interface AdStrategy {
  platform: string;
  gameType: string;
  placements: AdPlacement[];
  estimatedCpm: string;
}

/**
 * Get the optimal ad strategy for a platform and game type.
 * Returns specific placement, trigger, and frequency recommendations.
 */
export function getAdStrategy(platform: string, _gameType: string = 'game'): AdStrategy {
  switch (platform) {
    case 'wechat-miniprogram':
      return {
        platform,
        gameType: _gameType,
        placements: [
          { type: 'banner', position: '结算页底部', trigger: '关卡结束/游戏结束', frequency: '每局显示' },
          { type: 'rewarded', position: '复活按钮', trigger: '玩家死亡后', frequency: '每次死亡最多1次' },
          { type: 'interstitial', position: '全屏', trigger: '关卡切换间', frequency: '每3关1次' },
        ],
        estimatedCpm: '¥80-200（微信广告 eCPM 较高）',
      };

    case 'douyin':
      return {
        platform,
        gameType: _gameType,
        placements: [
          { type: 'interstitial', position: '开屏', trigger: '游戏启动', frequency: '每次启动' },
          { type: 'rewarded', position: '双倍金币', trigger: '关卡结算', frequency: '每次结算可观看' },
          { type: 'banner', position: '底部', trigger: '游戏进行中', frequency: '持续展示' },
        ],
        estimatedCpm: '¥100-300（抖音 eCPM 业内最高）',
      };

    case 'web':
    case 'unknown':
    default:
      return {
        platform: platform || 'web',
        gameType: _gameType,
        placements: [
          { type: 'banner', position: '页面底部', trigger: '游戏进行中', frequency: '持续展示' },
          { type: 'interstitial', position: '全屏覆盖', trigger: '游戏结束', frequency: '每局1次' },
          { type: 'rewarded', position: '弹窗', trigger: '每3关完成', frequency: '每3关1次' },
        ],
        estimatedCpm: '$1-5（AdSense 横幅）/ $5-15（激励视频）',
      };
  }
}

/**
 * Format routes for terminal display.
 */
export function formatRouteRecommendations(routes: MonetizationRoute[]): string {
  let output = '\n💰 推荐变现路径（按优先级排序）：\n';
  output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];

  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    const medal = medals[i] || `${i + 1}.`;
    const warning = r.needsSoftWareCopyright ? ' ⚠️需软著' : '';
    output += `\n${medal} ${r.platformLabel}（评分 ${r.score}）${warning}\n`;
    output += `   理由: ${r.reason}\n`;
    output += `   💰 收益: ${r.revenueModel}\n`;
    output += `   🏦 收款: ${r.payoutMethod}\n`;
    output += `   📊 预估: ${r.estimatedRevenue}\n`;
    output += `   📋 需要: ${r.requirements.join('、')}\n`;
    output += `   ⏱️  上线: ${r.estimatedDays} 天\n`;
    if (r.missingRequirements.length > 0) {
      output += `   ⚠️  缺失: ${r.missingRequirements.slice(0, 3).join('、')}\n`;
    }
  }

  output += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  output += '   kele 将默认选择 🥇 第一条路径执行部署任务\n';
  output += '   如需切换，可在执行前运行: kele config --platform <平台名>\n';

  return output;
}
