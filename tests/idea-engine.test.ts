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

  it('should detect Android Google Play', () => {
    const result = parseIdea('做一个Android游戏上架Google Play');
    expect(result.success).toBe(true);
    expect(result.idea!.monetization).toBe('google-play');
  });

  it('should detect Discord bot', () => {
    const result = parseIdea('做一个Discord机器人');
    expect(result.success).toBe(true);
    expect(result.idea!.monetization).toBe('discord-bot');
  });

  it('should detect Telegram bot', () => {
    const result = parseIdea('做一个Telegram机器人');
    expect(result.success).toBe(true);
    expect(result.idea!.monetization).toBe('telegram-bot');
  });

  it('should detect GitHub Sponsors', () => {
    const result = parseIdea('做一个开源工具接受GitHub赞助');
    expect(result.success).toBe(true);
    expect(result.idea!.monetization).toBe('github-sponsors');
  });

  it('should detect itchio', () => {
    const result = parseIdea('做一个独立游戏发布到itch.io');
    expect(result.success).toBe(true);
    expect(result.idea!.monetization).toBe('itchio');
  });

  it('should detect medium complexity', () => {
    const result = parseIdea('做一个塔防游戏有5种塔和10个关卡');
    expect(result.success).toBe(true);
    expect(result.idea!.complexity).toBe('medium');
  });

  it('should detect simple complexity', () => {
    const result = parseIdea('做一个简单的计算器');
    expect(result.success).toBe(true);
    expect(result.idea!.complexity).toBe('simple');
  });

  it('should detect complex complexity', () => {
    const result = parseIdea('做一个大型MMORPG游戏有100个关卡多人在线聊天系统');
    expect(result.success).toBe(true);
    expect(result.idea!.complexity).toBe('complex');
  });

  it('should generate keywords from input', () => {
    const result = parseIdea('做一个蛇蛇大作战游戏');
    expect(result.success).toBe(true);
    expect(result.idea!.keywords.length).toBeGreaterThan(0);
  });
});
