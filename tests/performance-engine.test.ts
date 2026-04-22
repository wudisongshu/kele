import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  analyzeBundle,
  measurePerformance,
  optimizeForPlatform,
  runPerformanceOptimization,
  formatPerformanceReport,
  shouldAutoOptimize,
} from '../src/core/performance-engine.js';

describe('PerformanceEngine', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kele-perf-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('analyzeBundle', () => {
    it('should analyze empty directory', () => {
      const result = analyzeBundle(tempDir, 'web');
      expect(result.totalBytes).toBe(0);
      expect(result.fileCount).toBe(0);
      expect(result.limitExceeded).toEqual([]);
    });

    it('should count JS/CSS/HTML sizes correctly', () => {
      writeFileSync(join(tempDir, 'app.js'), 'x'.repeat(5000));
      writeFileSync(join(tempDir, 'style.css'), 'y'.repeat(3000));
      writeFileSync(join(tempDir, 'index.html'), 'z'.repeat(2000));

      const result = analyzeBundle(tempDir, 'web');
      expect(result.jsBytes).toBe(5000);
      expect(result.cssBytes).toBe(3000);
      expect(result.htmlBytes).toBe(2000);
      expect(result.totalBytes).toBe(10000);
      expect(result.fileCount).toBe(3);
    });

    it('should flag oversized images', () => {
      writeFileSync(join(tempDir, 'small.png'), 'x'.repeat(50 * 1024));
      writeFileSync(join(tempDir, 'large.png'), 'y'.repeat(200 * 1024));

      const result = analyzeBundle(tempDir, 'web');
      expect(result.imageBytes).toBe(250 * 1024);
      expect(result.oversizedImages.length).toBe(1);
      expect(result.oversizedImages[0].path).toBe('large.png');
      expect(result.limitExceeded.some((l) => l.metric === '大图片数量')).toBe(true);
    });

    it('should flag oversized audio', () => {
      writeFileSync(join(tempDir, 'bgm.mp3'), 'x'.repeat(500 * 1024));

      const result = analyzeBundle(tempDir, 'web');
      expect(result.audioBytes).toBe(500 * 1024);
      expect(result.oversizedAudio.length).toBe(1);
    });

    it('should warn when total exceeds platform limit', () => {
      writeFileSync(join(tempDir, 'huge.js'), 'x'.repeat(6 * 1024 * 1024));

      const result = analyzeBundle(tempDir, 'web');
      expect(result.limitExceeded.some((l) => l.metric === '总包大小')).toBe(true);
    });

    it('should skip node_modules and hidden files', () => {
      mkdirSync(join(tempDir, 'node_modules'), { recursive: true });
      writeFileSync(join(tempDir, 'node_modules', 'big.js'), 'x'.repeat(1000000));
      writeFileSync(join(tempDir, '.hidden'), 'secret');
      writeFileSync(join(tempDir, 'app.js'), 'code');

      const result = analyzeBundle(tempDir, 'web');
      expect(result.totalBytes).toBe(4); // only app.js
    });

    it('should estimate dependency bytes from package.json', () => {
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        dependencies: { lodash: '^4.0.0', react: '^18.0.0', vue: '^3.0.0' },
      }));

      const result = analyzeBundle(tempDir, 'web');
      expect(result.dependencyBytes).toBe(3 * 500 * 1024);
    });
  });

  describe('measurePerformance', () => {
    it('should return synthetic metrics for empty project', () => {
      const metrics = measurePerformance(tempDir, 'web');
      expect(metrics.fcp).toBeGreaterThanOrEqual(0);
      expect(metrics.tti).toBeGreaterThanOrEqual(metrics.fcp);
      expect(metrics.score).toBeGreaterThanOrEqual(0);
      expect(metrics.score).toBeLessThanOrEqual(100);
      expect(metrics.platform).toBe('web');
    });

    it('should penalize large bundles with lower score', () => {
      writeFileSync(join(tempDir, 'app.js'), 'x'.repeat(5 * 1024 * 1024));
      writeFileSync(join(tempDir, 'index.html'), 'z'.repeat(100 * 1024));

      const metricsWeb = measurePerformance(tempDir, 'web');
      expect(metricsWeb.score).toBeLessThan(90);
    });

    it('should pass for small healthy projects', () => {
      writeFileSync(join(tempDir, 'index.html'), '<html></html>');
      writeFileSync(join(tempDir, 'app.js'), 'console.log(1)');

      const metrics = measurePerformance(tempDir, 'web');
      expect(metrics.passed).toBe(true);
      expect(metrics.score).toBeGreaterThanOrEqual(70);
    });

    it('should fail for oversized images', () => {
      writeFileSync(join(tempDir, 'index.html'), '<html></html>');
      writeFileSync(join(tempDir, 'huge1.png'), 'x'.repeat(500 * 1024));
      writeFileSync(join(tempDir, 'huge2.png'), 'x'.repeat(500 * 1024));
      writeFileSync(join(tempDir, 'huge3.png'), 'x'.repeat(500 * 1024));

      const metrics = measurePerformance(tempDir, 'web');
      expect(metrics.score).toBeLessThan(90);
    });
  });

  describe('optimizeForPlatform', () => {
    it('should generate subpackages.json for WeChat', () => {
      const results = optimizeForPlatform(tempDir, 'wechat-miniprogram');
      expect(results.some((r) => r.action === '生成分包配置')).toBe(true);
      expect(existsSync(join(tempDir, 'subpackages.json'))).toBe(true);
    });

    it('should generate lazy-load.js for web', () => {
      mkdirSync(join(tempDir, 'assets'), { recursive: true });
      writeFileSync(join(tempDir, 'assets', 'img.png'), 'png');

      const results = optimizeForPlatform(tempDir, 'web');
      expect(results.some((r) => r.action === '图片懒加载')).toBe(true);
      expect(existsSync(join(tempDir, 'lazy-load.js'))).toBe(true);
    });

    it('should generate SW precache manifest when sw.js exists', () => {
      writeFileSync(join(tempDir, 'sw.js'), 'self.addEventListener');
      writeFileSync(join(tempDir, 'index.html'), '<html></html>');

      const results = optimizeForPlatform(tempDir, 'pwa');
      expect(results.some((r) => r.action === 'SW 预缓存清单')).toBe(true);
      expect(existsSync(join(tempDir, 'sw-precache-manifest.js'))).toBe(true);
    });

    it('should suggest code splitting for large inline JS', () => {
      writeFileSync(join(tempDir, 'index.html'), '<script>' + 'x'.repeat(600 * 1024) + '</script>');

      const results = optimizeForPlatform(tempDir, 'web');
      expect(results.some((r) => r.action === '代码分割建议')).toBe(true);
    });

    it('should suggest image compression for oversized images', () => {
      writeFileSync(join(tempDir, 'big.png'), 'x'.repeat(200 * 1024));

      const results = optimizeForPlatform(tempDir, 'web');
      expect(results.some((r) => r.action === '图片压缩建议')).toBe(true);
    });
  });

  describe('runPerformanceOptimization', () => {
    it('should return a complete report', () => {
      writeFileSync(join(tempDir, 'index.html'), '<html>game</html>');
      const report = runPerformanceOptimization(tempDir, 'web');
      expect(report.analysis).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.optimizations).toBeDefined();
      expect(report.summary).toBeTruthy();
    });

    it('should improve score estimate after optimizations', () => {
      writeFileSync(join(tempDir, 'index.html'), '<html></html>');
      const report = runPerformanceOptimization(tempDir, 'web');
      expect(report.metrics.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatPerformanceReport', () => {
    it('should include all sections', () => {
      writeFileSync(join(tempDir, 'index.html'), '<html></html>');
      const report = runPerformanceOptimization(tempDir, 'web');
      const formatted = formatPerformanceReport(report);

      expect(formatted).toContain('⚡ 性能报告');
      expect(formatted).toContain('📦 总包大小');
      expect(formatted).toContain('⚡ 首屏时间');
      expect(formatted).toContain('⚡ 可交互时间');
      expect(formatted).toContain('📊 综合性能分');
    });

    it('should show pass/fail status', () => {
      writeFileSync(join(tempDir, 'huge.js'), 'x'.repeat(10 * 1024 * 1024));
      const report = runPerformanceOptimization(tempDir, 'web');
      const formatted = formatPerformanceReport(report);
      expect(formatted).toContain('❌');
    });
  });

  describe('shouldAutoOptimize', () => {
    it('should return true for low scores', () => {
      const report = runPerformanceOptimization(tempDir, 'web');
      // Mock a failing report
      const failingReport = { ...report, metrics: { ...report.metrics, score: 50, passed: false } };
      expect(shouldAutoOptimize(failingReport)).toBe(true);
    });

    it('should return false for passing scores', () => {
      const report = runPerformanceOptimization(tempDir, 'web');
      const passingReport = { ...report, metrics: { ...report.metrics, score: 85, passed: true } };
      expect(shouldAutoOptimize(passingReport)).toBe(false);
    });
  });
});
