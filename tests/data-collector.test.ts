import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  collectAdRevenue,
  collectUserMetrics,
  collectStoreMetrics,
  collectAllMetrics,
  generateMockMetrics,
  calculateTrend,
  formatWeeklyReport,
  type ProjectMetrics,
} from '../src/core/data-collector.js';

describe('DataCollector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kele-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('collectAdRevenue', () => {
    it('should parse JSON revenue file', () => {
      writeFileSync(join(tempDir, 'revenue.json'), JSON.stringify({
        revenue: 125.50,
        impressions: 5000,
        clicks: 120,
      }));
      const result = collectAdRevenue(tempDir);
      expect(result.revenue).toBe(125.50);
      expect(result.impressions).toBe(5000);
      expect(result.clicks).toBe(120);
    });

    it('should parse JSON array revenue file', () => {
      writeFileSync(join(tempDir, 'adsense-report.json'), JSON.stringify([
        { date: '2024-01-01', revenue: 10, impressions: 1000, clicks: 20 },
        { date: '2024-01-02', revenue: 15, impressions: 1500, clicks: 30 },
      ]));
      const result = collectAdRevenue(tempDir);
      expect(result.revenue).toBe(25);
      expect(result.impressions).toBe(2500);
      expect(result.clicks).toBe(50);
    });

    it('should parse CSV revenue file', () => {
      const csv = 'date,revenue,impressions,clicks\n2024-01-01,10.5,1000,20\n2024-01-02,20.5,2000,40';
      writeFileSync(join(tempDir, 'ad-revenue.csv'), csv);
      const result = collectAdRevenue(tempDir);
      expect(result.revenue).toBe(31);
      expect(result.impressions).toBe(3000);
      expect(result.clicks).toBe(60);
    });

    it('should return zero when no files exist', () => {
      const result = collectAdRevenue(tempDir);
      expect(result.revenue).toBe(0);
      expect(result.impressions).toBe(0);
      expect(result.clicks).toBe(0);
      expect(result.records).toEqual([]);
    });

    it('should parse AdSense-style rows format', () => {
      writeFileSync(join(tempDir, 'adsense-report.json'), JSON.stringify({
        rows: [
          { cells: ['2024-01-01', '1000', '20', '10.5'] },
          { cells: ['2024-01-02', '2000', '40', '20.5'] },
        ],
      }));
      const result = collectAdRevenue(tempDir);
      expect(result.revenue).toBe(31);
    });
  });

  describe('collectUserMetrics', () => {
    it('should parse analytics JSON', () => {
      writeFileSync(join(tempDir, 'analytics.json'), JSON.stringify({
        dau: 340,
        retention_day1: 28,
        retention_day7: 8,
        avg_session: 3.5,
      }));
      const result = collectUserMetrics(tempDir);
      expect(result.dau).toBe(340);
      expect(result.retention_day1).toBe(28);
      expect(result.retention_day7).toBe(8);
      expect(result.avg_session).toBe(3.5);
    });

    it('should parse analytics array', () => {
      writeFileSync(join(tempDir, 'ga4-report.json'), JSON.stringify([
        { date: '2024-01-01', dau: 300, retention1: 25, retention7: 7, avgSession: 3 },
        { date: '2024-01-02', dau: 340, retention1: 28, retention7: 8, avgSession: 3.5 },
      ]));
      const result = collectUserMetrics(tempDir);
      expect(result.dau).toBe(340);
      expect(result.retention_day1).toBe(28);
    });

    it('should return zero for missing files', () => {
      const result = collectUserMetrics(tempDir);
      expect(result.dau).toBe(0);
      expect(result.records).toEqual([]);
    });
  });

  describe('collectStoreMetrics', () => {
    it('should parse store stats for itch.io', () => {
      writeFileSync(join(tempDir, 'itch-stats.json'), JSON.stringify({
        rating: 4.2,
        reviews: 150,
        downloads: 1200,
      }));
      const result = collectStoreMetrics('itchio', tempDir);
      expect(result.rating).toBe(4.2);
      expect(result.reviews).toBe(150);
      expect(result.downloads).toBe(1200);
    });

    it('should parse generic store-stats.json', () => {
      writeFileSync(join(tempDir, 'store-stats.json'), JSON.stringify({
        rating: 3.8,
        review_count: 80,
        sales: 500,
      }));
      const result = collectStoreMetrics('unknown', tempDir);
      expect(result.rating).toBe(3.8);
      expect(result.reviews).toBe(80);
      expect(result.downloads).toBe(500);
    });

    it('should return zero for missing files', () => {
      const result = collectStoreMetrics('steam', tempDir);
      expect(result.rating).toBe(0);
      expect(result.reviews).toBe(0);
    });
  });

  describe('collectAllMetrics', () => {
    it('should combine all real data sources', () => {
      writeFileSync(join(tempDir, 'revenue.json'), JSON.stringify({ revenue: 50, impressions: 3000, clicks: 60 }));
      writeFileSync(join(tempDir, 'analytics.json'), JSON.stringify({ dau: 500, retention_day1: 35, retention_day7: 10, avg_session: 4 }));
      writeFileSync(join(tempDir, 'store-stats.json'), JSON.stringify({ rating: 4.5, reviews: 200, downloads: 1000 }));

      const result = collectAllMetrics(tempDir, 'web', false);
      expect(result.revenue).toBe(50);
      expect(result.dau).toBe(500);
      expect(result.retention_day1).toBe(35);
      expect(result.rating).toBe(4.5);
      expect(result.source).toBe('file');
    });

    it('should fall back to mock when no files exist', () => {
      const result = collectAllMetrics(tempDir, 'web', false);
      expect(result.source).toBe('mock');
      expect(result.revenue).toBeGreaterThan(0);
      expect(result.dau).toBeGreaterThan(0);
    });

    it('should use mock when useMock is true', () => {
      writeFileSync(join(tempDir, 'revenue.json'), JSON.stringify({ revenue: 999 }));
      const result = collectAllMetrics(tempDir, 'web', true);
      expect(result.source).toBe('mock');
      expect(result.revenue).not.toBe(999);
    });
  });

  describe('generateMockMetrics', () => {
    it('should generate deterministic metrics with same seed', () => {
      const m1 = generateMockMetrics('test-seed');
      const m2 = generateMockMetrics('test-seed');
      expect(m1).toEqual(m2);
    });

    it('should generate different metrics with different seeds', () => {
      const m1 = generateMockMetrics('seed-a');
      const m2 = generateMockMetrics('seed-b');
      expect(m1.dau).not.toBe(m2.dau);
    });

    it('should return valid metric ranges', () => {
      const m = generateMockMetrics('test');
      expect(m.revenue).toBeGreaterThanOrEqual(5);
      expect(m.dau).toBeGreaterThanOrEqual(100);
      expect(m.retention_day1).toBeGreaterThanOrEqual(20);
      expect(m.retention_day1).toBeLessThanOrEqual(60);
      expect(m.rating).toBeGreaterThanOrEqual(3.0);
      expect(m.rating).toBeLessThanOrEqual(5.0);
    });
  });

  describe('calculateTrend', () => {
    it('should calculate percentage changes', () => {
      const current: ProjectMetrics = {
        revenue: 110, dau: 220, retention_day1: 30, retention_day7: 10,
        avg_session: 3, rating: 4.2, reviews: 100, collectedAt: '', source: 'mock',
      };
      const previous: ProjectMetrics = {
        revenue: 100, dau: 200, retention_day1: 25, retention_day7: 8,
        avg_session: 2, rating: 4.0, reviews: 80, collectedAt: '', source: 'mock',
      };
      const trend = calculateTrend(current, previous);
      expect(trend.revenue).toBe(10); // +10%
      expect(trend.dau).toBe(10); // +10%
      expect(trend.retention_day1).toBe(5); // +5 points
      expect(trend.avg_session).toBe(50); // +50%
      expect(trend.rating).toBe(0.2); // +0.2
    });

    it('should return zero trend when no previous metrics', () => {
      const current: ProjectMetrics = {
        revenue: 100, dau: 200, retention_day1: 30, retention_day7: 10,
        avg_session: 3, rating: 4.0, reviews: 50, collectedAt: '', source: 'mock',
      };
      const trend = calculateTrend(current, undefined);
      expect(trend.revenue).toBe(0);
      expect(trend.dau).toBe(0);
    });

    it('should handle zero previous values', () => {
      const current: ProjectMetrics = {
        revenue: 100, dau: 200, retention_day1: 30, retention_day7: 10,
        avg_session: 3, rating: 4.0, reviews: 50, collectedAt: '', source: 'mock',
      };
      const previous: ProjectMetrics = {
        revenue: 0, dau: 0, retention_day1: 0, retention_day7: 0,
        avg_session: 0, rating: 0, reviews: 0, collectedAt: '', source: 'mock',
      };
      const trend = calculateTrend(current, previous);
      expect(trend.revenue).toBe(0); // avoid div by zero
    });
  });

  describe('formatWeeklyReport', () => {
    it('should include all major sections', () => {
      const history = {
        current: generateMockMetrics('report-test'),
        trend: { revenue: 23, dau: 5, retention_day1: -2, avg_session: 10, rating: 0.1 },
      };
      const report = formatWeeklyReport(history);
      expect(report).toContain('📈 数据周报');
      expect(report).toContain('💰 收益');
      expect(report).toContain('👥 DAU');
      expect(report).toContain('🔄 次日留存');
      expect(report).toContain('⭐ 评分');
      expect(report).toContain('💬 评论数');
    });

    it('should show warning for low retention', () => {
      const metrics = generateMockMetrics('low-retention');
      metrics.retention_day1 = 20;
      const history = {
        current: metrics,
        trend: { revenue: 0, dau: 0, retention_day1: -5, avg_session: 0, rating: 0 },
      };
      const report = formatWeeklyReport(history);
      expect(report).toContain('需优化');
    });

    it('should show positive trend indicators', () => {
      const history = {
        current: generateMockMetrics('positive-trend'),
        trend: { revenue: 50, dau: 30, retention_day1: 10, avg_session: 20, rating: 0.5 },
      };
      const report = formatWeeklyReport(history);
      expect(report).toContain('📈');
    });
  });
});
