import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { splitIntoTasks } from '../../src/orchestrator/splitter.js';
import { assembleProduct } from '../../src/orchestrator/assembler.js';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

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
  });
});
