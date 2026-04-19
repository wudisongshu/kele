import { describe, it, expect } from 'vitest';
import { routeMonetization, getTopRoute } from '../src/core/monetization-router.js';
import type { Idea } from '../src/types/index.js';

function makeIdea(rawText: string, monetization: string = 'unknown'): Idea {
  return {
    id: 'test',
    rawText,
    type: 'game',
    monetization: monetization as Idea['monetization'],
    complexity: 'medium',
    keywords: [],
    createdAt: new Date().toISOString(),
  };
}

describe('monetization-router', () => {
  it('should recommend H5 as top route for vague game idea', () => {
    const idea = makeIdea('做一个消消乐游戏赚钱');
    const routes = routeMonetization(idea);
    expect(routes[0].platform).toBe('web');
    expect(routes[0].score).toBeGreaterThan(30); // H5: 25 base + 10 speed + 5 effort = 40
  });

  it('should boost explicitly mentioned platform but penalize soft著', () => {
    const idea = makeIdea('做一个消消乐游戏部署到微信小程序');
    const routes = routeMonetization(idea);
    const wechat = routes.find((r) => r.platform === 'wechat-miniprogram');
    expect(wechat).toBeDefined();
    // WeChat gets +30 for explicit mention but -40 for soft著 = 0, which is correct
    // It should still be listed for transparency
    expect(wechat!.score).toBeGreaterThanOrEqual(0);
    // H5 should still be top because it doesn't need soft著
    expect(routes[0].platform).toBe('web');
  });

  it('should boost Google Play when mentioned', () => {
    const idea = makeIdea('做一个Android游戏上架Google Play');
    const routes = routeMonetization(idea);
    const gp = routes.find((r) => r.platform === 'google-play');
    expect(gp).toBeDefined();
    expect(gp!.score).toBeGreaterThan(40);
  });

  it('should mark platforms needing soft著 correctly', () => {
    const idea = makeIdea('做一个游戏');
    const routes = routeMonetization(idea);
    const web = routes.find((r) => r.platform === 'web');
    const wechat = routes.find((r) => r.platform === 'wechat-miniprogram');
    expect(web!.needsSoftWareCopyright).toBe(false);
    expect(wechat!.needsSoftWareCopyright).toBe(true);
  });

  it('getTopRoute should return the highest scored route', () => {
    const idea = makeIdea('做一个游戏');
    const top = getTopRoute(idea);
    expect(top.platform).toBe('web');
    expect(top.autoDeployable).toBe(true);
  });

  it('should include all platforms in results', () => {
    const idea = makeIdea('做一个游戏');
    const routes = routeMonetization(idea);
    const platforms = routes.map((r) => r.platform);
    expect(platforms).toContain('web');
    expect(platforms).toContain('google-play');
    expect(platforms).toContain('app-store');
    expect(platforms).toContain('steam');
    expect(platforms).toContain('wechat-miniprogram');
    expect(platforms).toContain('douyin');
    expect(routes.length).toBe(6);
  });
});
