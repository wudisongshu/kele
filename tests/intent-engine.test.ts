import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseIntent, type UserIntent } from '../src/core/intent-engine.js';
import type { AIAdapter } from '../src/adapters/base.js';

// Helper to create a mock adapter that returns a specific JSON response
function createMockAdapter(responseJson: object): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    execute: vi.fn().mockResolvedValue(JSON.stringify(responseJson)),
  } as AIAdapter;
}

// Helper for adapter that fails
function createFailingAdapter(): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    execute: vi.fn().mockRejectedValue(new Error('API error')),
  } as AIAdapter;
}

describe('parseIntent', () => {
  describe('AI parsing success', () => {
    it('parses CREATE intent', async () => {
      const adapter = createMockAdapter({ intent: 'CREATE', projectName: null, details: '做一个塔防游戏' });
      const result = await parseIntent('做一个塔防游戏', adapter);
      expect(result.type).toBe('CREATE');
      expect((result as any).idea).toBe('做一个塔防游戏');
    });

    it('parses UPGRADE intent with project name', async () => {
      const adapter = createMockAdapter({ intent: 'UPGRADE', projectName: 'snake-game', details: '改成动物主题' });
      const result = await parseIntent('上次那个贪吃蛇改成动物主题', adapter);
      expect(result.type).toBe('UPGRADE');
      expect((result as any).projectQuery).toBe('snake-game');
      expect((result as any).request).toBe('改成动物主题');
    });

    it('parses UPGRADE intent without project name', async () => {
      const adapter = createMockAdapter({ intent: 'UPGRADE', projectName: null, details: '加一个新功能' });
      const result = await parseIntent('加一个新功能', adapter);
      expect(result.type).toBe('UPGRADE');
      expect((result as any).projectQuery).toBe('加一个新功能');
    });

    it('parses QUERY intent', async () => {
      const adapter = createMockAdapter({ intent: 'QUERY', projectName: null, details: '项目进度怎么样了' });
      const result = await parseIntent('项目进度怎么样了', adapter);
      expect(result.type).toBe('QUERY');
      expect((result as any).query).toBe('项目进度怎么样了');
    });

    it('parses CONFIG intent with provider type', async () => {
      const adapter = createMockAdapter({ intent: 'CONFIG', projectName: null, details: '配置 DeepSeek API key' });
      const result = await parseIntent('配置 DeepSeek API key', adapter);
      expect(result.type).toBe('CONFIG');
      expect((result as any).configType).toBe('provider');
      expect((result as any).action).toBe('配置 DeepSeek API key');
    });

    it('parses CONFIG intent with secrets type', async () => {
      const adapter = createMockAdapter({ intent: 'CONFIG', projectName: null, details: '设置账号密码' });
      const result = await parseIntent('设置账号密码', adapter);
      expect(result.type).toBe('CONFIG');
      expect((result as any).configType).toBe('secrets');
    });

    it('parses RUN intent', async () => {
      const adapter = createMockAdapter({ intent: 'RUN', projectName: 'my-game', details: '运行游戏' });
      const result = await parseIntent('运行我的游戏', adapter);
      expect(result.type).toBe('RUN');
      expect((result as any).projectQuery).toBe('my-game');
    });

    it('parses RESUME intent', async () => {
      const adapter = createMockAdapter({ intent: 'RESUME', projectName: null, details: '继续' });
      const result = await parseIntent('继续', adapter);
      expect(result.type).toBe('RESUME');
    });

    it('parses DELETE intent', async () => {
      const adapter = createMockAdapter({ intent: 'DELETE', projectName: 'old-project', details: '删除旧项目' });
      const result = await parseIntent('删除旧项目', adapter);
      expect(result.type).toBe('DELETE');
      expect((result as any).projectQuery).toBe('old-project');
    });

    it('parses CHAT intent', async () => {
      const adapter = createMockAdapter({ intent: 'CHAT', projectName: null, details: '你好' });
      const result = await parseIntent('你好', adapter);
      expect(result.type).toBe('CHAT');
      expect((result as any).message).toBe('你好');
    });

    it('defaults to CHAT for unknown intent', async () => {
      const adapter = createMockAdapter({ intent: 'UNKNOWN', projectName: null, details: 'something' });
      const result = await parseIntent('something', adapter);
      expect(result.type).toBe('CHAT');
    });
  });

  describe('AI parsing failure → heuristic fallback', () => {
    it('falls back to heuristic for API error', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('做一个塔防游戏', adapter);
      // Heuristic should classify this as CREATE (no upgrade/query/config signals)
      expect(result.type).toBe('CREATE');
    });

    it('heuristic detects DELETE', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('删除我的项目', adapter);
      expect(result.type).toBe('DELETE');
    });

    it('heuristic detects RESUME', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('继续执行', adapter);
      expect(result.type).toBe('RESUME');
    });

    it('heuristic detects RUN', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('怎么运行', adapter);
      expect(result.type).toBe('RUN');
    });

    it('heuristic detects QUERY', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('进度怎么样', adapter);
      expect(result.type).toBe('QUERY');
    });

    it('heuristic detects CONFIG', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('配置一下', adapter);
      expect(result.type).toBe('CONFIG');
    });

    it('heuristic detects UPGRADE with Chinese signals', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('上次那个改成动物主题', adapter);
      expect(result.type).toBe('UPGRADE');
    });

    it('heuristic detects UPGRADE with English signals', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('add more levels to my game', adapter);
      expect(result.type).toBe('UPGRADE');
    });

    it('heuristic defaults to CREATE for new ideas', async () => {
      const adapter = createFailingAdapter();
      const result = await parseIntent('做一个记账工具', adapter);
      expect(result.type).toBe('CREATE');
      expect((result as any).idea).toBe('做一个记账工具');
    });
  });
});
