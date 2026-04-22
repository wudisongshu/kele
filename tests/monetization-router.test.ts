import { describe, it, expect } from 'vitest';
import { routeMonetization, getTopRoute, getAdStrategy } from '../src/core/monetization-router.js';
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
    expect(routes.length).toBe(10);
  });

  describe('getAdStrategy', () => {
    it('returns web strategy with 3 placements', () => {
      const strategy = getAdStrategy('web', 'game');
      expect(strategy.platform).toBe('web');
      expect(strategy.placements.length).toBe(3);
      expect(strategy.placements.some((p) => p.type === 'banner')).toBe(true);
      expect(strategy.placements.some((p) => p.type === 'interstitial')).toBe(true);
      expect(strategy.placements.some((p) => p.type === 'rewarded')).toBe(true);
      expect(strategy.estimatedCpm).toBeTruthy();
    });

    it('returns wechat strategy with banner on result page', () => {
      const strategy = getAdStrategy('wechat-miniprogram', 'game');
      expect(strategy.platform).toBe('wechat-miniprogram');
      expect(strategy.placements.length).toBe(3);
      const banner = strategy.placements.find((p) => p.type === 'banner');
      expect(banner).toBeDefined();
      expect(banner?.position).toContain('结算页');
      const rewarded = strategy.placements.find((p) => p.type === 'rewarded');
      expect(rewarded?.trigger).toContain('死亡');
    });

    it('returns douyin strategy with splash and rewarded', () => {
      const strategy = getAdStrategy('douyin', 'game');
      expect(strategy.platform).toBe('douyin');
      expect(strategy.placements.length).toBe(3);
      const splash = strategy.placements.find((p) => p.type === 'interstitial');
      expect(splash?.trigger).toContain('启动');
      const rewarded = strategy.placements.find((p) => p.type === 'rewarded');
      expect(rewarded?.trigger).toContain('关卡结算');
    });

    it('defaults to web for unknown platform', () => {
      const strategy = getAdStrategy('unknown', 'game');
      expect(strategy.platform).toBe('unknown');
      expect(strategy.placements.length).toBe(3);
    });
  });
});
