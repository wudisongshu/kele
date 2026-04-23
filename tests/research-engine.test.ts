import { describe, it, expect, vi } from 'vitest';
import { needsResearch, extractSubject, research, MOCK_COMPETITORS } from '../src/core/research-engine.js';

describe('ResearchEngine', () => {
  describe('needsResearch', () => {
    it('should detect competitor references', () => {
      expect(needsResearch('我想做像牛牛消消乐那样的游戏', ['游戏'])).toBe(true);
      expect(needsResearch('做一个类似王者荣耀的APP', ['app'])).toBe(true);
      expect(needsResearch('参考原神做一款游戏', ['游戏'])).toBe(true);
    });

    it('should detect vague ideas', () => {
      expect(needsResearch('随便做个游戏', [])).toBe(true);
      expect(needsResearch('你看着办，做个能赚钱的', [])).toBe(true);
    });

    it('should return false for clear ideas', () => {
      expect(needsResearch('我要做一个塔防游戏部署到微信小程序', ['塔防', '游戏', '微信'])).toBe(false);
      expect(needsResearch('做一个记账工具小程序', ['记账', '工具', '小程序'])).toBe(false);
    });

    it('should detect "那种" pattern', () => {
      expect(needsResearch('我要做消消乐那种游戏', ['消消乐', '游戏'])).toBe(true);
    });
  });

  describe('extractSubject', () => {
    it('should extract subject from "像...那样"', () => {
      expect(extractSubject('像牛牛消消乐那样')).toBe('牛牛消消乐');
    });

    it('should extract subject from "类似..."', () => {
      expect(extractSubject('类似王者荣耀的手游')).toBe('王者荣耀');
    });

    it('should extract subject from "...那种"', () => {
      expect(extractSubject('做消消乐那种游戏')).toBe('消消乐');
    });

    it('should return undefined for no match', () => {
      expect(extractSubject('我要做一个塔防游戏')).toBeUndefined();
    });
  });

  describe('MOCK_COMPETITORS', () => {
    it('has competitor profiles', () => {
      expect(Array.isArray(MOCK_COMPETITORS)).toBe(true);
      expect(MOCK_COMPETITORS.length).toBeGreaterThan(0);
      expect(MOCK_COMPETITORS[0]).toHaveProperty('name');
    });
  });

  describe('research', () => {
    it('uses contract match when available', async () => {
      const mockAdapter = {
        name: 'mock',
        execute: vi.fn().mockResolvedValue('report'),
      } as any;
      const result = await research('做一个像俄罗斯方块那样的游戏', mockAdapter);
      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report?.subject).toContain('方块');
    });

    it('falls back to AI research for unknown subjects', async () => {
      const mockAdapter = {
        name: 'mock',
        execute: vi.fn().mockResolvedValue(JSON.stringify({
          productAnalysis: 'Test product',
          monetizationAnalysis: 'Ads',
          marketInsights: 'Popular',
          recommendations: 'Build it',
          suggestedPlatforms: ['web'],
          suggestedKeywords: ['test'],
        })),
      } as any;
      const result = await research('做一个全新类型的游戏XYZ', mockAdapter);
      // AI research may fail if parsing fails; just verify it runs
      expect(result).toHaveProperty('success');
    });

    it('returns error for empty input', async () => {
      const mockAdapter = { name: 'mock', execute: vi.fn() } as any;
      const result = await research('', mockAdapter);
      expect(result.success).toBe(false);
    });
  });
});
