import { describe, it, expect } from 'vitest';
import {
  generateOptimizationTasks,
  buildOptimizationPlan,
  formatOptimizationPlan,
  tasksToExecutableTasks,
  type OptimizationTask,
} from '../src/core/optimization-engine.js';
import type { Project, ProjectMetrics, MetricsHistory } from '../src/core/data-collector.js';

function makeProject(type: 'game' | 'tool' = 'game'): Project {
  return {
    id: 'test-project',
    name: 'Test Project',
    idea: {
      id: 'idea-1',
      rawText: 'test game',
      type,
      monetization: 'web',
      complexity: 'simple',
      keywords: [],
      createdAt: new Date().toISOString(),
    },
    subProjects: [],
    tasks: [],
    status: 'completed',
    rootDir: '/tmp/test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeHistory(metrics: Partial<ProjectMetrics>): MetricsHistory {
  const defaults: ProjectMetrics = {
    revenue: 50,
    dau: 500,
    retention_day1: 40,
    retention_day7: 12,
    avg_session: 4,
    rating: 4.2,
    reviews: 100,
    collectedAt: new Date().toISOString(),
    source: 'mock',
  };
  return {
    current: { ...defaults, ...metrics },
    trend: { revenue: 0, dau: 0, retention_day1: 0, avg_session: 0, rating: 0 },
  };
}

describe('OptimizationEngine', () => {
  describe('generateOptimizationTasks', () => {
    it('should generate onboarding task when retention_day1 < 30%', () => {
      const history = makeHistory({ retention_day1: 25 });
      const tasks = generateOptimizationTasks(history, makeProject());
      const onboarding = tasks.find((t) => t.triggerMetric === 'retention_day1');
      expect(onboarding).toBeDefined();
      expect(onboarding!.priority).toBe('critical');
      expect(onboarding!.title).toContain('新手引导');
      expect(onboarding!.estimatedImpact).toContain('留存');
    });

    it('should generate depth task when avg_session < 2min', () => {
      const history = makeHistory({ avg_session: 1.5 });
      const tasks = generateOptimizationTasks(history, makeProject());
      const depth = tasks.find((t) => t.triggerMetric === 'avg_session');
      expect(depth).toBeDefined();
      expect(depth!.priority).toBe('high');
      expect(depth!.title).toContain('深度');
      expect(depth!.estimatedImpact).toContain('时长');
    });

    it('should generate rating fix task when rating < 4.0', () => {
      const history = makeHistory({ rating: 3.5 });
      const tasks = generateOptimizationTasks(history, makeProject());
      const ratingTask = tasks.find((t) => t.triggerMetric === 'rating');
      expect(ratingTask).toBeDefined();
      expect(ratingTask!.priority).toBe('high');
      expect(ratingTask!.title).toContain('评分');
    });

    it('should generate monetization task when revenue/dau < $0.05', () => {
      const history = makeHistory({ revenue: 10, dau: 500 }); // $0.02 per DAU
      const tasks = generateOptimizationTasks(history, makeProject());
      const monTask = tasks.find((t) => t.triggerMetric === 'revenue_per_dau');
      expect(monTask).toBeDefined();
      expect(monTask!.category).toBe('monetization');
      expect(monTask!.estimatedImpact).toContain('ARPU');
    });

    it('should generate retention_day7 task when < 8%', () => {
      const history = makeHistory({ retention_day7: 5 });
      const tasks = generateOptimizationTasks(history, makeProject());
      const task = tasks.find((t) => t.triggerMetric === 'retention_day7');
      expect(task).toBeDefined();
      expect(task!.title).toContain('留存钩子');
    });

    it('should generate ad CTR task when CTR < 1%', () => {
      const history = makeHistory({ adImpressions: 10000, adClicks: 50 }); // 0.5% CTR
      const tasks = generateOptimizationTasks(history, makeProject());
      const ctrTask = tasks.find((t) => t.triggerMetric === 'ad_ctr');
      expect(ctrTask).toBeDefined();
      expect(ctrTask!.title).toContain('CTR');
    });

    it('should generate virality task for high retention games', () => {
      const history = makeHistory({ retention_day1: 40 });
      const tasks = generateOptimizationTasks(history, makeProject());
      const viral = tasks.find((t) => t.triggerMetric === 'virality_opportunity');
      expect(viral).toBeDefined();
      expect(viral!.category).toBe('virality');
    });

    it('should generate high-dau monetization task', () => {
      const history = makeHistory({ dau: 1000, revenue: 10 });
      const tasks = generateOptimizationTasks(history, makeProject());
      const task = tasks.find((t) => t.triggerMetric === 'high_dau_low_revenue');
      expect(task).toBeDefined();
      expect(task!.title).toContain('高流量低变现');
    });

    it('should sort tasks by priority (critical first)', () => {
      const history = makeHistory({
        retention_day1: 25, // critical
        avg_session: 1.5,   // high
        rating: 3.5,        // high
      });
      const tasks = generateOptimizationTasks(history, makeProject());
      expect(tasks[0].priority).toBe('critical');
      // All remaining should be high or lower
      const nonCritical = tasks.slice(1);
      expect(nonCritical.every((t) => t.priority !== 'critical')).toBe(true);
    });

    it('should return empty tasks when all metrics are healthy', () => {
      const history = makeHistory({
        retention_day1: 35, // at threshold, not > 35 (avoids virality bonus)
        retention_day7: 15,
        avg_session: 6,
        rating: 4.5,
        revenue: 100,
        dau: 500, // $0.20 per DAU
      });
      const tasks = generateOptimizationTasks(history, makeProject());
      expect(tasks.length).toBe(0);
    });

    it('should adapt task wording for non-game projects', () => {
      const history = makeHistory({ retention_day1: 25 });
      const tasks = generateOptimizationTasks(history, makeProject('tool'));
      const task = tasks.find((t) => t.triggerMetric === 'retention_day1');
      expect(task).toBeDefined();
      expect(task!.title).toContain('首次使用体验');
      expect(task!.title).not.toContain('关卡');
    });
  });

  describe('buildOptimizationPlan', () => {
    it('should include summary with critical count', () => {
      const history = makeHistory({ retention_day1: 20 });
      const plan = buildOptimizationPlan(history, makeProject());
      expect(plan.tasks.length).toBeGreaterThan(0);
      expect(plan.summary).toContain('严重');
    });

    it('should have positive summary when healthy', () => {
      const history = makeHistory({ retention_day1: 32, avg_session: 3, rating: 4.5, revenue: 100, dau: 500 });
      const plan = buildOptimizationPlan(history, makeProject());
      expect(plan.tasks.length).toBe(0);
      expect(plan.summary).toContain('健康');
    });
  });

  describe('formatOptimizationPlan', () => {
    it('should format tasks with emojis', () => {
      const history = makeHistory({ retention_day1: 20 });
      const plan = buildOptimizationPlan(history, makeProject());
      const formatted = formatOptimizationPlan(plan);
      expect(formatted).toContain('🎯 自动生成的优化任务');
      expect(formatted).toContain('🔴');
      expect(formatted).toContain('触发指标');
      expect(formatted).toContain('预估影响');
    });

    it('should show healthy message when no tasks', () => {
      const history = makeHistory({ retention_day1: 32, avg_session: 3, rating: 4.2, revenue: 100, dau: 500 });
      const plan = buildOptimizationPlan(history, makeProject());
      const formatted = formatOptimizationPlan(plan);
      expect(formatted).toContain('所有指标健康');
    });
  });

  describe('tasksToExecutableTasks', () => {
    it('should convert optimization tasks to executable tasks', () => {
      const optTasks: OptimizationTask[] = [
        {
          id: 'opt-1',
          title: 'Fix onboarding',
          description: 'desc',
          triggerMetric: 'retention_day1',
          currentValue: 20,
          threshold: 30,
          estimatedImpact: '+10%',
          estimatedImpactPercent: 10,
          priority: 'critical',
          category: 'retention',
          suggestedFiles: ['a.js'],
        },
      ];
      const execTasks = tasksToExecutableTasks(optTasks, 'sp-1');
      expect(execTasks.length).toBe(1);
      expect(execTasks[0].subProjectId).toBe('sp-1');
      expect(execTasks[0].status).toBe('pending');
      expect(execTasks[0].complexity).toBe('complex');
      expect(execTasks[0].description).toContain('预估影响');
    });

    it('should map priority to complexity correctly', () => {
      const optTasks: OptimizationTask[] = [
        { id: '1', title: 'T1', description: '', triggerMetric: '', currentValue: 0, threshold: 0, estimatedImpact: '', estimatedImpactPercent: 0, priority: 'high', category: 'retention', suggestedFiles: [] },
        { id: '2', title: 'T2', description: '', triggerMetric: '', currentValue: 0, threshold: 0, estimatedImpact: '', estimatedImpactPercent: 0, priority: 'medium', category: 'engagement', suggestedFiles: [] },
        { id: '3', title: 'T3', description: '', triggerMetric: '', currentValue: 0, threshold: 0, estimatedImpact: '', estimatedImpactPercent: 0, priority: 'low', category: 'quality', suggestedFiles: [] },
      ];
      const execTasks = tasksToExecutableTasks(optTasks, 'sp-1');
      expect(execTasks[0].complexity).toBe('medium');
      expect(execTasks[1].complexity).toBe('simple');
      expect(execTasks[2].complexity).toBe('simple');
    });
  });
});
