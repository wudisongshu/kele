import { describe, it, expect } from 'vitest';
import { incubate } from '../src/core/incubator.js';
import type { Idea } from '../src/types/index.js';

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'test-idea',
    rawText: 'test',
    type: 'unknown',
    monetization: 'unknown',
    complexity: 'medium',
    keywords: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Incubator', () => {
  it('should always include project-setup as first sub-project', () => {
    const idea = makeIdea({ type: 'game', monetization: 'wechat-miniprogram' });
    const result = incubate(idea, '/tmp/test-game');

    expect(result.success).toBe(true);
    expect(result.subProjects!.length).toBeGreaterThan(0);
    expect(result.subProjects![0].id).toBe('project-setup');
    expect(result.subProjects![0].targetDir).toBe('/tmp/test-game/project-setup');
  });

  it('should generate game-dev + wechat pipeline for game + wechat', () => {
    const idea = makeIdea({ type: 'game', monetization: 'wechat-miniprogram' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toContain('game-dev');
    expect(ids).toContain('game-test');
    expect(ids).toContain('wechat-config');
    expect(ids).toContain('wechat-deploy');
    expect(ids).toContain('wechat-submit');
  });

  it('should generate music + web pipeline for music + web', () => {
    const idea = makeIdea({ type: 'music', monetization: 'web' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toContain('music-production');
    expect(ids).toContain('web-deploy');
    expect(ids).toContain('web-monetize');
  });

  it('should generate tool + douyin pipeline for tool + douyin', () => {
    const idea = makeIdea({ type: 'tool', monetization: 'douyin' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toContain('tool-dev');
    expect(ids).toContain('tool-test');
    expect(ids).toContain('douyin-config');
    expect(ids).toContain('douyin-deploy');
    expect(ids).toContain('douyin-submit');
  });

  it('should set correct dependencies for wechat pipeline', () => {
    const idea = makeIdea({ type: 'game', monetization: 'wechat-miniprogram' });
    const result = incubate(idea, '/tmp/test');

    const map = new Map(result.subProjects!.map((sp) => [sp.id, sp]));

    expect(map.get('project-setup')!.dependencies).toEqual([]);
    expect(map.get('game-dev')!.dependencies).toContain('project-setup');
    expect(map.get('game-test')!.dependencies).toContain('game-dev');
    expect(map.get('wechat-deploy')!.dependencies).toContain('wechat-config');
    expect(map.get('wechat-submit')!.dependencies).toContain('wechat-deploy');
  });

  it('should generate steam pipeline for steam monetization', () => {
    const idea = makeIdea({ type: 'game', monetization: 'steam' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toContain('steam-build');
    expect(ids).toContain('steam-config');
    expect(ids).toContain('steam-submit');
  });

  it('should generate app-store pipeline for ios', () => {
    const idea = makeIdea({ type: 'tool', monetization: 'app-store' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toContain('ios-build');
    expect(ids).toContain('app-store-config');
    expect(ids).toContain('app-store-submit');
  });
});
