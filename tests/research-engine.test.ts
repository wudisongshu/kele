import { describe, it, expect } from 'vitest';
import { needsResearch, extractSubject } from '../src/core/research-engine.js';

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
});
