import { describe, it, expect } from 'vitest';
import { parseIdea } from '../src/core/idea-engine.js';

describe('IdeaEngine', () => {
  it('should parse a game idea for WeChat mini-program', () => {
    const result = parseIdea('我要做一个塔防游戏并部署到微信小程序赚钱');

    expect(result.success).toBe(true);
    expect(result.idea).toBeDefined();
    expect(result.idea!.type).toBe('game');
    expect(result.idea!.monetization).toBe('wechat-miniprogram');
    expect(result.idea!.keywords).toContain('塔防');
    expect(result.idea!.keywords).toContain('游戏');
  });

  it('should parse a music idea for web', () => {
    const result = parseIdea('帮我写一首歌发布到网站');

    expect(result.success).toBe(true);
    expect(result.idea!.type).toBe('music');
    expect(result.idea!.monetization).toBe('web');
  });

  it('should parse a tool idea for Douyin', () => {
    const result = parseIdea('做一个记账工具小程序上传到抖音');

    expect(result.success).toBe(true);
    expect(result.idea!.type).toBe('tool');
    expect(result.idea!.monetization).toBe('douyin');
  });

  it('should detect simple complexity', () => {
    const result = parseIdea('我要做一个小游戏');

    expect(result.success).toBe(true);
    expect(result.idea!.complexity).toBe('simple');
  });

  it('should detect complex complexity', () => {
    const result = parseIdea('我要做一个大型3D多人联网游戏');

    expect(result.success).toBe(true);
    expect(result.idea!.complexity).toBe('complex');
  });

  it('should return error for empty input', () => {
    const result = parseIdea('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('想法不能为空');
  });

  it('should detect Steam monetization', () => {
    const result = parseIdea('开发一个PC单机游戏上架Steam');

    expect(result.success).toBe(true);
    expect(result.idea!.type).toBe('game');
    expect(result.idea!.monetization).toBe('steam');
  });

  it('should detect iOS app store', () => {
    const result = parseIdea('做一个iOS记账App');

    expect(result.success).toBe(true);
    expect(result.idea!.monetization).toBe('app-store');
  });
});
