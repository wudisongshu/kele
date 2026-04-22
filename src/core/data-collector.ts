/**
 * Data Collector — gathers post-deploy metrics from local files and mock APIs.
 *
 * When a project is deployed, kele needs to track:
 * - Revenue (ads, IAP, downloads)
 * - User engagement (DAU, retention, session length)
 * - Store performance (rating, reviews, sales)
 *
 * Current implementation reads from local files (mock mode).
 * Real API integrations (AdSense API, GA4, Steamworks, etc.) will be added
 * in future iterations when platform credentials are configured.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { debugLog } from '../debug.js';

export interface ProjectMetrics {
  revenue: number; // USD or local currency
  dau: number;
  retention_day1: number; // 0-100
  retention_day7: number; // 0-100
  avg_session: number; // minutes
  rating: number; // 0-5
  reviews: number; // count
  downloads?: number; // total downloads/sales
  adImpressions?: number;
  adClicks?: number;
  collectedAt: string; // ISO timestamp
  source: string; // 'mock' | 'file' | 'api'
}

export interface MetricsHistory {
  current: ProjectMetrics;
  previous?: ProjectMetrics; // 7 days ago for comparison
  trend: {
    revenue: number; // percentage change
    dau: number;
    retention_day1: number;
    avg_session: number;
    rating: number;
  };
}

/* ──────────────────────────────────────────────
   Ad Revenue Collection
   ────────────────────────────────────────────── */

interface AdRevenueRecord {
  date: string;
  revenue: number;
  currency: string;
  impressions: number;
  clicks: number;
}

function parseCsvRevenue(content: string): AdRevenueRecord[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const revenueIdx = headers.findIndex((h) => h.includes('revenue') || h.includes('earnings'));
  const impressionsIdx = headers.findIndex((h) => h.includes('impression'));
  const clicksIdx = headers.findIndex((h) => h.includes('click'));

  const records: AdRevenueRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 2) continue;
    records.push({
      date: dateIdx >= 0 ? cols[dateIdx].trim() : '',
      revenue: revenueIdx >= 0 ? parseFloat(cols[revenueIdx]) || 0 : 0,
      currency: 'USD',
      impressions: impressionsIdx >= 0 ? parseInt(cols[impressionsIdx]) || 0 : 0,
      clicks: clicksIdx >= 0 ? parseInt(cols[clicksIdx]) || 0 : 0,
    });
  }
  return records;
}

function parseJsonRevenue(data: unknown): AdRevenueRecord[] {
  if (Array.isArray(data)) {
    return data.map((item) => ({
      date: String(item.date || item.day || ''),
      revenue: parseFloat(item.revenue || item.earnings || 0) || 0,
      currency: String(item.currency || 'USD'),
      impressions: parseInt(item.impressions || 0) || 0,
      clicks: parseInt(item.clicks || 0) || 0,
    }));
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // AdSense-style { rows: [{ cells: [...] }] }
    if (Array.isArray(obj.rows)) {
      return obj.rows.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        const cells = Array.isArray(r.cells) ? r.cells : [];
        return {
          date: String(cells[0] || ''),
          revenue: parseFloat(String(cells[cells.length - 1] || 0)) || 0,
          currency: 'USD',
          impressions: parseInt(String(cells[1] || 0)) || 0,
          clicks: parseInt(String(cells[2] || 0)) || 0,
        };
      });
    }
    // Simple { revenue: 123, impressions: 456 }
    if ('revenue' in obj) {
      return [{
        date: String(obj.date || new Date().toISOString().slice(0, 10)),
        revenue: parseFloat(String(obj.revenue)) || 0,
        currency: String(obj.currency || 'USD'),
        impressions: parseInt(String(obj.impressions || 0)) || 0,
        clicks: parseInt(String(obj.clicks || 0)) || 0,
      }];
    }
  }
  return [];
}

/**
 * Collect ad revenue from local report files.
 * Looks for: adsense-report.json, ad-revenue.csv, revenue.json
 */
export function collectAdRevenue(projectDir: string): { revenue: number; impressions: number; clicks: number; records: AdRevenueRecord[] } {
  const possibleFiles = ['adsense-report.json', 'ad-revenue.csv', 'revenue.json', 'ad-report.json', 'monetization.json'];

  for (const filename of possibleFiles) {
    const filepath = join(projectDir, filename);
    if (!existsSync(filepath)) continue;

    try {
      const content = readFileSync(filepath, 'utf-8');
      if (filename.endsWith('.csv')) {
        const records = parseCsvRevenue(content);
        const totalRevenue = records.reduce((sum, r) => sum + r.revenue, 0);
        const totalImpressions = records.reduce((sum, r) => sum + r.impressions, 0);
        const totalClicks = records.reduce((sum, r) => sum + r.clicks, 0);
        return { revenue: totalRevenue, impressions: totalImpressions, clicks: totalClicks, records };
      }

      const data = JSON.parse(content);
      const records = parseJsonRevenue(data);
      const totalRevenue = records.reduce((sum, r) => sum + r.revenue, 0);
      const totalImpressions = records.reduce((sum, r) => sum + r.impressions, 0);
      const totalClicks = records.reduce((sum, r) => sum + r.clicks, 0);
      return { revenue: totalRevenue, impressions: totalImpressions, clicks: totalClicks, records };
    } catch {
      continue;
    }
  }

  // No report file found — return zero
  return { revenue: 0, impressions: 0, clicks: 0, records: [] };
}

/* ──────────────────────────────────────────────
   User Metrics Collection
   ────────────────────────────────────────────── */

interface UserMetricsRecord {
  date: string;
  dau: number;
  retention_day1: number;
  retention_day7: number;
  avg_session_minutes: number;
  newUsers: number;
}

function parseUserMetrics(data: unknown): UserMetricsRecord[] {
  if (Array.isArray(data)) {
    return data.map((item) => ({
      date: String(item.date || item.day || ''),
      dau: parseInt(item.dau || item.activeUsers || 0) || 0,
      retention_day1: parseFloat(item.retention_day1 || item.retention1 || 0) || 0,
      retention_day7: parseFloat(item.retention_day7 || item.retention7 || 0) || 0,
      avg_session_minutes: parseFloat(item.avg_session || item.avgSession || item.sessionDuration || 0) || 0,
      newUsers: parseInt(item.newUsers || item.new_users || 0) || 0,
    }));
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if ('dau' in obj || 'activeUsers' in obj) {
      return [{
        date: String(obj.date || new Date().toISOString().slice(0, 10)),
        dau: parseInt(String(obj.dau || obj.activeUsers || 0)) || 0,
        retention_day1: parseFloat(String(obj.retention_day1 || obj.retention1 || 0)) || 0,
        retention_day7: parseFloat(String(obj.retention_day7 || obj.retention7 || 0)) || 0,
        avg_session_minutes: parseFloat(String(obj.avg_session || obj.avgSession || obj.sessionDuration || 0)) || 0,
        newUsers: parseInt(String(obj.newUsers || obj.new_users || 0)) || 0,
      }];
    }
  }
  return [];
}

/**
 * Collect user engagement metrics from local analytics files.
 * Looks for: analytics.json, ga4-report.json, metrics.json, user-stats.json
 */
export function collectUserMetrics(projectDir: string): { dau: number; retention_day1: number; retention_day7: number; avg_session: number; records: UserMetricsRecord[] } {
  const possibleFiles = ['analytics.json', 'ga4-report.json', 'metrics.json', 'user-stats.json', 'engagement.json'];

  for (const filename of possibleFiles) {
    const filepath = join(projectDir, filename);
    if (!existsSync(filepath)) continue;

    try {
      const data = JSON.parse(readFileSync(filepath, 'utf-8'));
      const records = parseUserMetrics(data);
      if (records.length === 0) continue;

      // Use the latest record as current
      const latest = records[records.length - 1];
      return {
        dau: latest.dau,
        retention_day1: latest.retention_day1,
        retention_day7: latest.retention_day7,
        avg_session: latest.avg_session_minutes,
        records,
      };
    } catch {
      continue;
    }
  }

  return { dau: 0, retention_day1: 0, retention_day7: 0, avg_session: 0, records: [] };
}

/* ──────────────────────────────────────────────
   Store Metrics Collection
   ────────────────────────────────────────────── */

interface StoreMetrics {
  rating: number;
  reviews: number;
  downloads: number;
  platform: string;
}

function parseStoreMetrics(data: unknown, platform: string): StoreMetrics {
  if (typeof data !== 'object' || data === null) {
    return { rating: 0, reviews: 0, downloads: 0, platform };
  }
  const obj = data as Record<string, unknown>;
  return {
    rating: parseFloat(String(obj.rating || obj.average_rating || obj.score || 0)) || 0,
    reviews: parseInt(String(obj.reviews || obj.review_count || obj.total_reviews || 0)) || 0,
    downloads: parseInt(String(obj.downloads || obj.sales || obj.units || 0)) || 0,
    platform,
  };
}

/**
 * Collect store/platform metrics from local files.
 * Looks for: store-stats.json, itch-stats.json, steam-report.json, app-store.json
 */
export function collectStoreMetrics(platform: string, projectDir: string): StoreMetrics {
  const platformFileMap: Record<string, string[]> = {
    'itchio': ['itch-stats.json', 'store-stats.json'],
    'steam': ['steam-report.json', 'store-stats.json'],
    'app-store': ['app-store.json', 'store-stats.json'],
    'google-play': ['play-store.json', 'store-stats.json'],
    'wechat-miniprogram': ['wechat-stats.json', 'store-stats.json'],
    'douyin': ['douyin-stats.json', 'store-stats.json'],
    'web': ['web-stats.json', 'store-stats.json'],
    'unknown': ['store-stats.json'],
  };

  const files = platformFileMap[platform] || platformFileMap['unknown'];

  for (const filename of files) {
    const filepath = join(projectDir, filename);
    if (!existsSync(filepath)) continue;

    try {
      const data = JSON.parse(readFileSync(filepath, 'utf-8'));
      return parseStoreMetrics(data, platform);
    } catch {
      continue;
    }
  }

  return { rating: 0, reviews: 0, downloads: 0, platform };
}

/* ──────────────────────────────────────────────
   Mock Data Generation (for testing and fallback)
   ────────────────────────────────────────────── */

export function generateMockMetrics(seed?: string): ProjectMetrics {
  // Deterministic mock based on seed for reproducible tests
  const hash = seed ? simpleHash(seed) : Math.floor(Math.random() * 10000);
  const base = hash % 100;

  return {
    revenue: parseFloat((5 + (base % 50)).toFixed(2)),
    dau: 100 + (base * 10),
    retention_day1: 20 + (base % 40),
    retention_day7: 5 + (base % 20),
    avg_session: 1 + (base % 8),
    rating: parseFloat((3.0 + (base % 20) / 10).toFixed(1)),
    reviews: base * 3,
    downloads: base * 50,
    adImpressions: base * 100,
    adClicks: base * 5,
    collectedAt: new Date().toISOString(),
    source: 'mock',
  };
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/* ──────────────────────────────────────────────
   Combined Collection
   ────────────────────────────────────────────── */

/**
 * Collect all available metrics for a project.
 * Falls back to mock data if no real data files exist.
 */
export function collectAllMetrics(projectDir: string, platform: string, useMock: boolean = false): ProjectMetrics {
  if (useMock) {
    return generateMockMetrics(projectDir);
  }

  const ad = collectAdRevenue(projectDir);
  const user = collectUserMetrics(projectDir);
  const store = collectStoreMetrics(platform, projectDir);

  const hasRealData = ad.records.length > 0 || user.records.length > 0 || store.reviews > 0;

  if (!hasRealData) {
    return generateMockMetrics(projectDir);
  }

  return {
    revenue: ad.revenue,
    dau: user.dau,
    retention_day1: user.retention_day1,
    retention_day7: user.retention_day7,
    avg_session: user.avg_session,
    rating: store.rating,
    reviews: store.reviews,
    downloads: store.downloads,
    adImpressions: ad.impressions,
    adClicks: ad.clicks,
    collectedAt: new Date().toISOString(),
    source: 'file',
  };
}

/**
 * Load previous metrics for trend comparison.
 * Looks for .kele/metrics-history/<project-id>.json
 */
export function loadPreviousMetrics(projectId: string): ProjectMetrics | undefined {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  const historyDir = join(home, '.kele', 'metrics-history');
  const filepath = join(historyDir, `${projectId}.json`);

  if (!existsSync(filepath)) return undefined;

  try {
    const data = JSON.parse(readFileSync(filepath, 'utf-8'));
    if (typeof data === 'object' && data !== null && 'revenue' in data) {
      return data as ProjectMetrics;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog('Metrics read error', msg);
  }
  return undefined;
}

/**
 * Save current metrics for future trend comparison.
 */
export function saveMetricsHistory(projectId: string, metrics: ProjectMetrics): void {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  const historyDir = join(home, '.kele', 'metrics-history');
  _mkdirSync(historyDir, { recursive: true });
  const filepath = join(historyDir, `${projectId}.json`);
  _writeFileSync(filepath, JSON.stringify(metrics, null, 2));
}

import { mkdirSync as _mkdirSync, writeFileSync as _writeFileSync } from 'fs';

/* ──────────────────────────────────────────────
   Trend Calculation
   ────────────────────────────────────────────── */

export function calculateTrend(current: ProjectMetrics, previous: ProjectMetrics | undefined): MetricsHistory['trend'] {
  if (!previous) {
    return { revenue: 0, dau: 0, retention_day1: 0, avg_session: 0, rating: 0 };
  }

  const pct = (curr: number, prev: number) => prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);

  return {
    revenue: pct(current.revenue, previous.revenue),
    dau: pct(current.dau, previous.dau),
    retention_day1: Math.round(current.retention_day1 - previous.retention_day1),
    avg_session: pct(current.avg_session, previous.avg_session),
    rating: Math.round((current.rating - previous.rating) * 10) / 10,
  };
}

/* ──────────────────────────────────────────────
   Weekly Report Formatting
   ────────────────────────────────────────────── */

export function formatWeeklyReport(history: MetricsHistory): string {
  const m = history.current;
  const t = history.trend;

  const revArrow = t.revenue > 0 ? '↑' : t.revenue < 0 ? '↓' : '→';
  const dauArrow = t.dau > 0 ? '↑' : t.dau < 0 ? '↓' : '→';
  const retArrow = t.retention_day1 > 0 ? '↑' : t.retention_day1 < 0 ? '↓' : '→';
  const rateArrow = t.rating > 0 ? '↑' : t.rating < 0 ? '↓' : '→';

  const revHint = t.revenue < 0 ? '（需优化）' : '';
  const retHint = m.retention_day1 < 30 ? '（↓ 需优化）' : '';

  let out = '\n📈 数据周报（过去 7 天）\n';
  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  out += `💰 收益：$${m.revenue.toFixed(2)}（${revArrow}${t.revenue}% 环比）${revHint}\n`;
  out += `👥 DAU：${m.dau}（${dauArrow}${t.dau}%）\n`;
  out += `🔄 次日留存：${m.retention_day1.toFixed(1)}%（${retArrow}${t.retention_day1}%）${retHint}\n`;
  out += `📅 7 日留存：${m.retention_day7.toFixed(1)}%\n`;
  out += `⏱️  平均时长：${m.avg_session.toFixed(1)} 分钟\n`;
  out += `⭐ 评分：${m.rating.toFixed(1)}（${rateArrow}${t.rating.toFixed(1)}）\n`;
  out += `💬 评论数：${m.reviews}\n`;
  if (m.downloads) {
    out += `⬇️  下载量：${m.downloads}\n`;
  }
  out += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  return out;
}
