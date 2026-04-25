import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { splitIntoTasks } from '../../src/orchestrator/splitter.js';
import { assembleProduct } from '../../src/orchestrator/assembler.js';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { GeneratedPage } from '../../src/orchestrator/types.js';

describe('Unit: Orchestrator', () => {
  describe('splitter', () => {
    it('splits requirements into tasks', () => {
      const reqs = [
        { name: '首页', description: '导航和推荐', icon: '🏠' },
        { name: '商品列表', description: '分类筛选', icon: '📦' },
      ];
      const tasks = splitIntoTasks(reqs);
      expect(tasks).toHaveLength(2);
      expect(tasks[0].name).toBe('首页');
      expect(tasks[0].outputFile).toMatch(/\.html$/);
      expect(tasks[0].standalone).toBe(true);
      expect(tasks[1].name).toBe('商品列表');
    });

    it('includes sibling pages in prompt', () => {
      const reqs = [
        { name: '首页', description: '入口' },
        { name: '关于', description: '介绍' },
      ];
      const tasks = splitIntoTasks(reqs);
      expect(tasks[0].prompt).toContain('首页');
      expect(tasks[0].prompt).toContain('关于');
    });

    it('maps common page names to canonical file names', () => {
      const reqs = [
        { name: '首页', description: '入口' },
        { name: '练习', description: '练习模式' },
        { name: '对战', description: '双人对战' },
        { name: '规则', description: '规则说明' },
        { name: '战绩', description: '战绩统计' },
      ];
      const tasks = splitIntoTasks(reqs);
      expect(tasks[0].outputFile).toBe('index.html');
      expect(tasks[1].outputFile).toBe('practice.html');
      expect(tasks[2].outputFile).toBe('match.html');
      expect(tasks[3].outputFile).toBe('rules.html');
      expect(tasks[4].outputFile).toBe('records.html');
    });

    it('includes CDN restriction in prompt', () => {
      const reqs = [{ name: '首页', description: '入口' }];
      const tasks = splitIntoTasks(reqs);
      expect(tasks[0].prompt).toContain('不要引用任何外部 CDN 资源');
    });
  });

  describe('assembler', () => {
    let testDir: string;

    beforeEach(() => {
      testDir = mkdtempSync(join(tmpdir(), 'kele-orch-'));
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('creates index.html with navigation cards', () => {
      const pages = [
        { name: '首页', fileName: 'shou-ye.html', description: '入口', icon: '🏠', title: '首页' },
        { name: '关于', fileName: 'guan-yu.html', description: '介绍', icon: 'ℹ️', title: '关于' },
      ];

      assembleProduct(testDir, pages, '测试产品');

      const indexPath = join(testDir, 'index.html');
      expect(existsSync(indexPath)).toBe(true);

      const html = readFileSync(indexPath, 'utf-8');
      expect(html).toContain('测试产品');
      expect(html).toContain('shou-ye.html');
      expect(html).toContain('guan-yu.html');
      expect(html).toContain('🏠');
      expect(html).toContain('ℹ️');
    });

    it('generates data-bridge.js', () => {
      const pages = [
        { name: '首页', fileName: 'index.html', description: '', icon: '', title: '' },
      ];

      assembleProduct(testDir, pages, '测试');

      const bridgePath = join(testDir, 'data-bridge.js');
      expect(existsSync(bridgePath)).toBe(true);
      const bridge = readFileSync(bridgePath, 'utf-8');
      expect(bridge).toContain('KeleData');
      expect(bridge).toContain('localStorage');
    });

    it('injects navigation into sub-pages', () => {
      const pagePath = join(testDir, 'sub.html');
      writeFileSync(pagePath, '<!DOCTYPE html><html><body>hello</body></html>', 'utf-8');

      const pages = [
        { name: '子页', fileName: 'sub.html', description: '', icon: '', title: '' },
      ];

      assembleProduct(testDir, pages, '测试');

      const html = readFileSync(pagePath, 'utf-8');
      expect(html).toContain('返回首页');
    });

    it('fixes navigation links to match actual file names', () => {
      // Simulate pages with various internal link styles
      const matchPath = join(testDir, 'match.html');
      writeFileSync(matchPath, `<!DOCTYPE html>
<html><body>
<a href="practice.html">练习</a>
<a href="./rules.html">规则</a>
<a href="records.html">战绩</a>
</body></html>`, 'utf-8');

      const practicePath = join(testDir, 'practice.html');
      writeFileSync(practicePath, `<!DOCTYPE html>
<html><body>
<a href="match.html">对战</a>
</body></html>`, 'utf-8');

      const rulesPath = join(testDir, 'rules.html');
      writeFileSync(rulesPath, `<!DOCTYPE html>
<html><body>
<a href="match.html">对战</a>
</body></html>`, 'utf-8');

      const pages: GeneratedPage[] = [
        { name: '对战', fileName: 'match.html', description: '双人对战', icon: '🎮', title: '对战' },
        { name: '练习', fileName: 'practice.html', description: '练习模式', icon: '🎯', title: '练习' },
        { name: '规则', fileName: 'rules.html', description: '规则说明', icon: '📜', title: '规则' },
        { name: '战绩', fileName: 'records.html', description: '战绩统计', icon: '🏆', title: '战绩' },
      ];

      assembleProduct(testDir, pages, '测试产品');

      const matchHtml = readFileSync(matchPath, 'utf-8');
      // Links to existing pages should be preserved (or corrected if mismatched)
      expect(matchHtml).toContain('href="practice.html"');
      expect(matchHtml).toContain('href="./rules.html"');
      expect(matchHtml).toContain('href="records.html"');

      const practiceHtml = readFileSync(practicePath, 'utf-8');
      expect(practiceHtml).toContain('href="match.html"');
    });

    it('escapes HTML in product name and descriptions', () => {
      const pages: GeneratedPage[] = [
        { name: '首页', fileName: 'index.html', description: '<script>alert(1)</script>', icon: '🏠', title: '首页' },
      ];

      assembleProduct(testDir, pages, 'Test <Product>');

      const indexPath = join(testDir, 'index.html');
      const html = readFileSync(indexPath, 'utf-8');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('Test &lt;Product&gt;');
    });
  });
});
