/**
 * Optimization Engine — turns post-deploy metrics into actionable tasks.
 *
 * Reads data from the Data Collector, compares against thresholds,
 * and generates specific optimization tasks with estimated impact.
 *
 * Thresholds (all empirically grounded):
 * - retention_day1 < 30% → onboarding is broken
 * - avg_session < 2min → content is too shallow
 * - rating < 4.0 → users are unhappy with specific issues
 * - revenue/dau < $0.05 → monetization is underperforming
 * - retention_day7 < 8% → no long-term hooks
 * - ad CTR < 1% → ad placement is invisible
 */

import type { ProjectMetrics, MetricsHistory } from './data-collector.js';
import type { Project, Task } from '../types/index.js';

export interface OptimizationTask {
  id: string;
  title: string;
  description: string;
  triggerMetric: string;
  currentValue: number;
  threshold: number;
  estimatedImpact: string; // e.g. "预计提升留存 10%"
  estimatedImpactPercent: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'retention' | 'engagement' | 'monetization' | 'quality' | 'virality';
  suggestedFiles: string[]; // which files to modify
}

export interface OptimizationPlan {
  metrics: ProjectMetrics;
  trends: MetricsHistory['trend'];
  tasks: OptimizationTask[];
  summary: string;
}

/* ──────────────────────────────────────────────
   Threshold Definitions
   ────────────────────────────────────────────── */

interface ThresholdRule {
  metric: keyof ProjectMetrics;
  condition: 'lt' | 'gt';
  threshold: number;
  taskGenerator: (value: number, project: Project) => OptimizationTask;
}

function makeTask(
  title: string,
  description: string,
  triggerMetric: string,
  currentValue: number,
  threshold: number,
  impact: string,
  impactPct: number,
  priority: OptimizationTask['priority'],
  category: OptimizationTask['category'],
  files: string[],
): OptimizationTask {
  return {
    id: `opt-${triggerMetric}-${Date.now()}`,
    title,
    description,
    triggerMetric,
    currentValue,
    threshold,
    estimatedImpact: impact,
    estimatedImpactPercent: impactPct,
    priority,
    category,
    suggestedFiles: files,
  };
}

const THRESHOLD_RULES: ThresholdRule[] = [
  {
    metric: 'retention_day1',
    condition: 'lt',
    threshold: 30,
    taskGenerator: (value, project) => {
      const isGame = project.idea.type === 'game';
      return makeTask(
        isGame ? '优化新手引导（前 3 关通过率目标 95%）' : '优化首次使用体验（降低激活门槛）',
        isGame
          ? '当前次日留存仅 ' + value + '%，说明大量用户在首次游玩后流失。建议：(1) 第一关必须在 30 秒内完成，立即给予正反馈；(2) 第 2 关引入第一个"成就感时刻"（解锁新内容/获得奖励）；(3) 首次死亡后提供免费复活机会，避免挫败感；(4) 添加进度保存，即开即玩。'
          : '当前次日留存仅 ' + value + '%。建议：(1) 首次打开后 10 秒内展示核心价值；(2) 提供一键模板/示例，降低冷启动难度；(3) 添加交互式引导高亮核心按钮；(4) 首次操作成功后给予即时反馈。',
        'retention_day1',
        value,
        30,
        '预计提升次日留存 8-15%',
        12,
        'critical',
        'retention',
        isGame ? ['src/game.js', 'index.html', 'src/tutorial.js'] : ['src/onboarding.js', 'index.html'],
      );
    },
  },
  {
    metric: 'retention_day7',
    condition: 'lt',
    threshold: 8,
    taskGenerator: (value, project) => {
      const isGame = project.idea.type === 'game';
      return makeTask(
        isGame ? '增加长期留存钩子（每日任务 + 成就系统）' : '增加用户回访动力（通知 + 数据更新）',
        isGame
          ? '7 日留存仅 ' + value + '%，缺乏让玩家每天回来的理由。建议：(1) 添加每日登录奖励（连续 7 天奖励递增）；(2) 设计每日挑战/限时关卡；(3) 添加成就系统和收集要素；(4) 推送通知提醒"今日任务未完成"。'
          : '7 日留存仅 ' + value + '%。建议：(1) 添加每日/每周数据摘要邮件/通知；(2) 设计进度追踪和里程碑提醒；(3) 引入社交对比（好友动态）；(4) 定期推送新功能或内容更新。',
        'retention_day7',
        value,
        8,
        '预计提升 7 日留存 5-10%',
        8,
        'high',
        'retention',
        isGame ? ['src/daily.js', 'src/achievements.js'] : ['src/notifications.js', 'src/digest.js'],
      );
    },
  },
  {
    metric: 'avg_session',
    condition: 'lt',
    threshold: 2,
    taskGenerator: (value, project) => {
      const isGame = project.idea.type === 'game';
      return makeTask(
        isGame ? '增加游戏深度（新机制/新关卡/新角色）' : '增加功能深度（高级特性/批量操作）',
        isGame
          ? '平均游玩时长仅 ' + value + ' 分钟，内容消耗过快。建议：(1) 增加第 4 种核心机制（如塔防新增英雄技能系统）；(2) 设计"再玩一局"的沉没成本（如未完成的关卡进度保留）；(3) 添加无尽/挑战模式作为主线通关后的内容；(4) 引入 Meta 进度（如基地升级、角色养成）。'
          : '平均使用时长仅 ' + value + ' 分钟。建议：(1) 添加快捷操作和批量处理功能；(2) 增加数据可视化仪表盘，让用户"探索"自己的数据；(3) 引入高级设置/自定义选项；(4) 添加模板市场或社区分享功能。',
        'avg_session',
        value,
        2,
        '预计提升平均时长 20-35%',
        25,
        'high',
        'engagement',
        isGame ? ['src/levels.js', 'src/heroes.js', 'src/endless.js'] : ['src/dashboard.js', 'src/bulk-actions.js'],
      );
    },
  },
  {
    metric: 'rating',
    condition: 'lt',
    threshold: 4.0,
    taskGenerator: (value, _project) => makeTask(
      '修复用户反馈 Top 3 问题（提升评分至 4.0+）',
      '当前评分 ' + value + '，用户有明显不满。建议：(1) 检查评论区高频关键词（crash/卡顿/广告太多/看不懂）；(2) 修复导致 1-2 星评价的最常见问题；(3) 对于广告相关投诉，降低展示频率或增加"去广告"付费选项；(4) 更新后主动邀请满意用户评分，稀释低分。',
      'rating',
      value,
      4.0,
      '预计提升评分 0.3-0.5',
      0.4,
      'high',
      'quality',
      ['src/bugfix.js', 'src/ads.js', 'src/rating-prompt.js'],
    ),
  },
  {
    metric: 'revenue',
    condition: 'lt',
    threshold: 0,
    taskGenerator: (value, project) => {
      const isGame = project.idea.type === 'game';
        return makeTask(
        '调整变现策略（提升 ARPU）',
        '当前收益表现不佳。建议：(1) 在自然的游戏断点增加广告触发（关卡完成/复活/返回主菜单）；(2) 添加 IAP 首充礼包（¥1-6 超低价）；(3) 引入 Battle Pass / 赛季通行证系统；(4) A/B 测试广告频率，找到收益与留存的最佳平衡点。',
        'revenue_per_dau',
        value,
        0.05,
        '预计提升 ARPU 30-50%',
        40,
        'medium',
        'monetization',
        isGame ? ['src/ads.js', 'src/iap.js', 'src/battle-pass.js'] : ['src/pricing.js', 'src/subscription.js'],
      );
    },
  },
];

/* ──────────────────────────────────────────────
   Revenue Efficiency Check
   ────────────────────────────────────────────── */

function checkRevenueEfficiency(metrics: ProjectMetrics, tasks: OptimizationTask[]): OptimizationTask[] {
  const dau = metrics.dau || 1;
  const revenuePerDau = metrics.revenue / dau;

  if (revenuePerDau < 0.05 && metrics.revenue > 0) {
    tasks.push(makeTask(
      '调整广告频率或增加付费点（ARPU 过低）',
      `当前 ARPU 仅 $${revenuePerDau.toFixed(4)}/用户，远低于健康水平（$0.05+）。建议：(1) 增加激励视频广告位（复活/双倍奖励）；(2) 添加"去广告"终身会员（$2.99）；(3) 在关卡间插入插屏广告（间隔 ≥ 30 秒）；(4) 测试不同 eCPM 的广告网络。`,
      'revenue_per_dau',
      revenuePerDau,
      0.05,
      '预计提升 ARPU 30-50%',
      40,
      'high',
      'monetization',
      ['src/ads.js', 'src/iap.js', 'index.html'],
    ));
  }

  // Check ad CTR if we have impressions and clicks
  if (metrics.adImpressions && metrics.adImpressions > 0 && metrics.adClicks !== undefined) {
    const ctr = metrics.adClicks / metrics.adImpressions;
    if (ctr < 0.01) {
      tasks.push(makeTask(
        '优化广告位可见性（CTR 过低）',
        `当前广告 CTR 仅 ${(ctr * 100).toFixed(2)}%，说明广告位不够显眼或时机不对。建议：(1) 将 Banner 广告移至游戏主界面底部常驻区域；(2) 激励视频按钮设计得更突出（动画/高对比色）；(3) 在玩家"渴望奖励"的时刻弹出广告（如关卡失败后的复活）；(4) 避免广告与游戏元素重叠。`,
        'ad_ctr',
        ctr,
        0.01,
        '预计提升 CTR 50-100%',
        75,
        'medium',
        'monetization',
        ['index.html', 'src/ads.js', 'src/ui.js'],
      ));
    }
  }

  return tasks;
}

/* ──────────────────────────────────────────────
   Bonus Opportunities (things that are good but could be better)
   ────────────────────────────────────────────── */

function addBonusOpportunities(metrics: ProjectMetrics, tasks: OptimizationTask[], project: Project): OptimizationTask[] {
  const isGame = project.idea.type === 'game';

  // High DAU but low revenue = monetization opportunity
  if (metrics.dau > 500 && metrics.revenue / metrics.dau < 0.03) {
    tasks.push(makeTask(
      '高流量低变现：引入订阅或 Premium 功能',
      `DAU 已达 ${metrics.dau}，但变现效率低。建议：(1) 添加 Premium 订阅（$2.99/月，去广告+独占内容）；(2) 引入限时礼包/闪购活动；(3) 与内容创作者合作推广，扩大流量池。`,
      'high_dau_low_revenue',
      metrics.revenue / metrics.dau,
      0.03,
      '预计月收入提升 2-5 倍',
      300,
      'medium',
      'monetization',
      ['src/subscription.js', 'src/iap.js'],
    ));
  }

  // Good retention but no viral mechanics = growth opportunity
  if (metrics.retention_day1 > 35 && isGame) {
    tasks.push(makeTask(
      '添加病毒传播机制（利用高留存做增长）',
      '次日留存优秀（' + metrics.retention_day1 + '%），产品已具备口碑传播基础。建议：(1) 添加"邀请好友得奖励"双向激励；(2) 设计可分享的成就截图/关卡完成卡片；(3) 添加排行榜和好友对战；(4) 集成社交平台的分享 SDK。',
      'virality_opportunity',
      metrics.retention_day1,
      35,
      '预计 K 因子提升 0.1-0.2',
      15,
      'low',
      'virality',
      ['src/share.js', 'src/leaderboard.js', 'src/friends.js'],
    ));
  }

  // Long sessions but low retention = entry barrier issue
  if (metrics.avg_session > 5 && metrics.retention_day1 < 25) {
    tasks.push(makeTask(
      '核心体验好但入口门槛高（时长高留存低）',
      `平均时长 ${metrics.avg_session} 分钟说明核心体验优秀，但次日留存仅 ${metrics.retention_day1}% 说明首次体验有问题。建议：(1) 简化注册/登录流程（游客模式优先）；(2) 首次启动直接进游戏，设置后置；(3) 添加"继续上次进度"的明显入口。`,
      'session_high_retention_low',
      metrics.retention_day1,
      25,
      '预计提升次日留存 10-15%',
      12,
      'high',
      'retention',
      ['index.html', 'src/auth.js', 'src/save-load.js'],
    ));
  }

  return tasks;
}

/* ──────────────────────────────────────────────
   Main Generation
   ────────────────────────────────────────────── */

/**
 * Generate optimization tasks based on metrics thresholds.
 */
export function generateOptimizationTasks(
  history: MetricsHistory,
  project: Project,
): OptimizationTask[] {
  const metrics = history.current;
  const tasks: OptimizationTask[] = [];

  // Threshold-based tasks
  for (const rule of THRESHOLD_RULES) {
    const value = metrics[rule.metric] as number;
    if (Number.isNaN(value)) continue;

    let triggered = false;
    if (rule.condition === 'lt' && value < rule.threshold) triggered = true;
    if (rule.condition === 'gt' && value > rule.threshold) triggered = true;

    // Special case: revenue rule checks revenue/dau ratio
    if (rule.metric === 'revenue') {
      const dau = metrics.dau || 1;
      if (value / dau < 0.05) triggered = true;
      else triggered = false;
    }

    if (triggered) {
      const task = rule.taskGenerator(value, project);
      // Override with actual dau for revenue task
      if (rule.metric === 'revenue') {
        task.currentValue = metrics.revenue / (metrics.dau || 1);
      }
      tasks.push(task);
    }
  }

  // Revenue efficiency checks
  checkRevenueEfficiency(metrics, tasks);

  // Bonus opportunities
  addBonusOpportunities(metrics, tasks, project);

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return tasks;
}

/**
 * Build a complete optimization plan with summary.
 */
export function buildOptimizationPlan(
  history: MetricsHistory,
  project: Project,
): OptimizationPlan {
  const tasks = generateOptimizationTasks(history, project);

  const criticalCount = tasks.filter((t) => t.priority === 'critical').length;
  const highCount = tasks.filter((t) => t.priority === 'high').length;

  let summary = '';
  if (criticalCount > 0) {
    summary = `发现 ${criticalCount} 个严重问题需立即处理，${highCount} 个高优先级优化项。`;
  } else if (highCount > 0) {
    summary = `产品基础健康，有 ${highCount} 个高价值优化机会。`;
  } else if (tasks.length > 0) {
    summary = `产品表现良好，发现 ${tasks.length} 个可选优化项。`;
  } else {
    summary = '产品各项数据健康，暂无需要优化的指标。继续保持！';
  }

  return {
    metrics: history.current,
    trends: history.trend,
    tasks,
    summary,
  };
}

/* ──────────────────────────────────────────────
   Formatting
   ────────────────────────────────────────────── */

export function formatOptimizationPlan(plan: OptimizationPlan): string {
  let out = '\n🎯 自动生成的优化任务\n';
  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

  if (plan.tasks.length === 0) {
    out += '✅ 所有指标健康，暂无优化任务\n';
    out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    return out;
  }

  for (let i = 0; i < plan.tasks.length; i++) {
    const t = plan.tasks[i];
    const emoji = t.priority === 'critical' ? '🔴' : t.priority === 'high' ? '🟠' : t.priority === 'medium' ? '🟡' : '🔵';
    out += `\n${emoji} ${i + 1}. ${t.title}\n`;
    out += `   触发指标: ${t.triggerMetric} = ${t.currentValue.toFixed(2)}（阈值: ${t.threshold}）\n`;
    out += `   预估影响: ${t.estimatedImpact}\n`;
    out += `   建议文件: ${t.suggestedFiles.join(', ')}\n`;
  }

  out += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  out += `📋 ${plan.summary}\n`;
  return out;
}

/**
 * Convert optimization tasks to executable Task objects.
 */
export function tasksToExecutableTasks(optTasks: OptimizationTask[], subProjectId: string): Task[] {
  const now = new Date().toISOString();
  return optTasks.map((opt, idx) => ({
    id: `opt-task-${Date.now()}-${idx}`,
    subProjectId,
    title: opt.title,
    description: `${opt.description}\n\n预估影响: ${opt.estimatedImpact}\n优先级: ${opt.priority}\n关联指标: ${opt.triggerMetric}`,
    complexity: opt.priority === 'critical' ? 'complex' : opt.priority === 'high' ? 'medium' : 'simple',
    status: 'pending' as const,
    version: 1,
    createdAt: now,
  }));
}
