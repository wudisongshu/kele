import { describe, it, expect } from 'vitest';
import {
  findCompetitors,
  designMonetization,
  designVirality,
  generateProductPartnerReport,
  formatProductPartnerReport,
  inferCategory,
  MOCK_COMPETITORS,
} from '../src/core/product-partner.js';

describe('ProductPartner', () => {
  describe('MOCK_COMPETITORS', () => {
    it('should have at least 50 entries', () => {
      expect(MOCK_COMPETITORS.length).toBeGreaterThanOrEqual(50);
    });

    it('should have unique names', () => {
      const names = MOCK_COMPETITORS.map((c) => c.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have all required fields', () => {
      for (const c of MOCK_COMPETITORS) {
        expect(c.name).toBeTruthy();
        expect(c.category).toBeTruthy();
        expect(c.revenueModel).toBeTruthy();
        expect(Array.isArray(c.keyFeatures)).toBe(true);
        expect(Array.isArray(c.viralityMechanics)).toBe(true);
        expect(c.estimatedMonthlyRevenue).toBeTruthy();
        expect(Array.isArray(c.keywords)).toBe(true);
        expect(c.keywords.length).toBeGreaterThan(0);
      }
    });
  });

  describe('findCompetitors', () => {
    it('should find competitors for match-3 ideas', () => {
      const competitors = findCompetitors('我想做一个像消消乐那样的消除游戏');
      expect(competitors.length).toBeGreaterThan(0);
      expect(competitors.some((c) => c.category === 'match-3')).toBe(true);
    });

    it('should find competitors for tower defense ideas', () => {
      const competitors = findCompetitors('做一个塔防游戏，像植物大战僵尸');
      expect(competitors.length).toBeGreaterThan(0);
      const names = competitors.map((c) => c.name);
      expect(names.some((n) => n.includes('Plants') || n.includes('Bloons') || n.includes('Kingdom'))).toBe(true);
    });

    it('should find competitors for racing ideas', () => {
      const competitors = findCompetitors('赛车游戏，类似狂野飙车');
      expect(competitors.length).toBeGreaterThan(0);
      expect(competitors.some((c) => c.category === 'racing')).toBe(true);
    });

    it('should return at least one competitor for generic ideas', () => {
      const competitors = findCompetitors('随便做个小游戏');
      expect(competitors.length).toBeGreaterThan(0);
    });

    it('should return up to 5 competitors', () => {
      const competitors = findCompetitors('做一个像消消乐+跑酷结合的游戏');
      expect(competitors.length).toBeLessThanOrEqual(5);
    });

    it('should rank by relevance', () => {
      const competitors = findCompetitors('做一个类似 Candy Crush 的消消乐');
      expect(competitors[0].name).toBe('Candy Crush Saga');
    });
  });

  describe('inferCategory', () => {
    it('should detect match-3', () => {
      expect(inferCategory('消消乐游戏')).toBe('match-3');
      expect(inferCategory('match-3 puzzle')).toBe('match-3');
    });

    it('should detect tower-defense', () => {
      expect(inferCategory('塔防游戏')).toBe('tower-defense');
      expect(inferCategory('tower defense game')).toBe('tower-defense');
    });

    it('should detect endless-runner', () => {
      expect(inferCategory('跑酷游戏')).toBe('endless-runner');
      expect(inferCategory('endless runner')).toBe('endless-runner');
    });

    it('should detect platformer', () => {
      expect(inferCategory('平台跳跃游戏')).toBe('platformer');
      expect(inferCategory('jump platformer')).toBe('platformer');
    });

    it('should detect puzzle', () => {
      expect(inferCategory('益智解谜')).toBe('puzzle');
      expect(inferCategory('2048 game')).toBe('puzzle');
    });

    it('should detect shooter', () => {
      expect(inferCategory('射击游戏')).toBe('shooter');
      expect(inferCategory('fps shooter')).toBe('shooter');
    });

    it('should detect racing', () => {
      expect(inferCategory('赛车竞速')).toBe('racing');
      expect(inferCategory('racing game')).toBe('racing');
    });

    it('should detect card', () => {
      expect(inferCategory('卡牌对战')).toBe('card');
      expect(inferCategory('card game')).toBe('card');
    });

    it('should detect rpg', () => {
      expect(inferCategory('rpg冒险')).toBe('rpg');
      expect(inferCategory('角色扮演')).toBe('rpg');
    });

    it('should detect arcade', () => {
      expect(inferCategory('街机休闲')).toBe('arcade');
      expect(inferCategory('snake arcade')).toBe('arcade');
    });

    it('should detect tool', () => {
      expect(inferCategory('记账工具')).toBe('tool');
      expect(inferCategory('calculator app')).toBe('tool');
    });

    it('should detect bot', () => {
      expect(inferCategory('discord机器人')).toBe('bot');
      expect(inferCategory('telegram bot')).toBe('bot');
    });

    it('should return generic for unknown', () => {
      expect(inferCategory('something completely unknown')).toBe('generic');
    });
  });

  describe('designMonetization', () => {
    it('should return WeChat monetization strategy', () => {
      const strategy = designMonetization('塔防游戏', 'tower-defense', 'wechat-miniprogram');
      expect(strategy.primary).toContain('微信广告');
      expect(strategy.platformFit).toBeGreaterThanOrEqual(80);
      expect(strategy.adPlacements.length).toBeGreaterThan(0);
      expect(strategy.iapItems.length).toBeGreaterThan(0);
    });

    it('should return Douyin monetization strategy', () => {
      const strategy = designMonetization('跑酷游戏', 'endless-runner', 'douyin');
      expect(strategy.primary).toContain('穿山甲');
      expect(strategy.platformFit).toBeGreaterThanOrEqual(80);
    });

    it('should return web monetization strategy', () => {
      const strategy = designMonetization('益智游戏', 'puzzle', 'web');
      expect(strategy.primary).toContain('AdSense');
      expect(strategy.platformFit).toBeGreaterThanOrEqual(50);
    });

    it('should return Steam monetization strategy', () => {
      const strategy = designMonetization('独立游戏', 'platformer', 'steam');
      expect(strategy.primary).toContain('付费下载');
      expect(strategy.adPlacements.length).toBe(0);
    });

    it('should merge game-type specific IAP items', () => {
      const strategy = designMonetization('塔防', 'tower-defense', 'wechat-miniprogram');
      const iapTexts = strategy.iapItems.join(' ');
      expect(iapTexts).toContain('英雄');
    });

    it('should return unknown fallback for unrecognized platform', () => {
      const strategy = designMonetization('游戏', 'arcade', 'unknown-platform');
      expect(strategy.primary).toBe('广告 + IAP');
    });

    it('should have valid ARPU and LTV estimates', () => {
      const strategy = designMonetization('游戏', 'puzzle', 'app-store');
      expect(strategy.estimatedArpu).toBeTruthy();
      expect(strategy.estimatedLtv).toBeTruthy();
      expect(strategy.estimatedArpu).not.toBe('视平台而定');
    });
  });

  describe('designVirality', () => {
    it('should design virality for match-3 games', () => {
      const viral = designVirality('消消乐', 'match-3');
      expect(viral.shareTriggers.length).toBeGreaterThan(0);
      expect(viral.referralRewards.length).toBeGreaterThan(0);
      expect(viral.socialProofMechanics.length).toBeGreaterThan(0);
      expect(viral.estimatedKFactor).toBeGreaterThan(0);
      expect(viral.viralLoopDescription).toBeTruthy();
    });

    it('should boost K-factor for WeChat platform', () => {
      const viralWechat = designVirality('微信小游戏', 'arcade');
      const viralWeb = designVirality('网页游戏', 'arcade');
      expect(viralWechat.estimatedKFactor).toBeGreaterThan(viralWeb.estimatedKFactor);
    });

    it('should boost K-factor for Douyin platform', () => {
      const viralDouyin = designVirality('抖音小游戏', 'arcade');
      const viralWeb = designVirality('网页游戏', 'arcade');
      expect(viralDouyin.estimatedKFactor).toBeGreaterThan(viralWeb.estimatedKFactor);
    });

    it('should cap K-factor at 1.0', () => {
      const viral = designVirality('微信抖音社交分享 multiplayer', 'social');
      expect(viral.estimatedKFactor).toBeLessThanOrEqual(1.0);
    });

    it('should include loop description with appropriate tone', () => {
      const high = designVirality('微信社交', 'social');
      const low = designVirality('单机工具', 'tool');
      expect(high.viralLoopDescription).toContain('强病毒');
      expect(low.viralLoopDescription).toContain('弱病毒');
    });
  });

  describe('generateProductPartnerReport', () => {
    it('should generate a complete report', () => {
      const report = generateProductPartnerReport('做一个像消消乐那样的微信小游戏', 'game', 'wechat-miniprogram');
      expect(report.competitorAnalysis.length).toBeGreaterThan(0);
      expect(report.monetizationStrategy.primary).toBeTruthy();
      expect(report.viralityDesign.shareTriggers.length).toBeGreaterThan(0);
      expect(report.differentiationUsp).toBeTruthy();
      expect(report.estimatedSuccessRate).toBeGreaterThanOrEqual(10);
      expect(report.estimatedSuccessRate).toBeLessThanOrEqual(95);
      expect(report.actionableRecommendations.length).toBeGreaterThan(0);
    });

    it('should auto-detect category when not provided', () => {
      const report = generateProductPartnerReport('塔防游戏');
      expect(report.competitorAnalysis.some((c) => c.category === 'tower-defense')).toBe(true);
    });

    it('should include PWA recommendation for all reports', () => {
      const report = generateProductPartnerReport('随便做个游戏');
      const pwaRec = report.actionableRecommendations.find((r) => r.includes('PWA'));
      expect(pwaRec).toBeTruthy();
    });

    it('should generate USP with unique hints when available', () => {
      const report = generateProductPartnerReport('像素风格塔防游戏');
      expect(report.differentiationUsp).toContain('像素');
    });

    it('should handle tool ideas', () => {
      const report = generateProductPartnerReport('记账工具小程序');
      expect(report.monetizationStrategy).toBeTruthy();
      expect(report.viralityDesign).toBeTruthy();
    });
  });

  describe('formatProductPartnerReport', () => {
    it('should include all major sections', () => {
      const report = generateProductPartnerReport('消消乐游戏');
      const formatted = formatProductPartnerReport(report);
      expect(formatted).toContain('📊 产品经理报告');
      expect(formatted).toContain('🎯 竞品分析');
      expect(formatted).toContain('💰 变现策略设计');
      expect(formatted).toContain('🦠 病毒传播机制');
      expect(formatted).toContain('⭐ 差异化卖点');
      expect(formatted).toContain('📈 预估成功率');
      expect(formatted).toContain('💡 行动建议');
    });

    it('should show green emoji for high success rate', () => {
      const report = generateProductPartnerReport('超休闲微信小游戏');
      const formatted = formatProductPartnerReport(report);
      const hasGreenOrYellow = formatted.includes('🟢') || formatted.includes('🟡');
      expect(hasGreenOrYellow).toBe(true);
    });

    it('should handle empty competitor list gracefully', () => {
      const report = generateProductPartnerReport('完全全新的未知品类 xyz123');
      report.competitorAnalysis = [];
      const formatted = formatProductPartnerReport(report);
      expect(formatted).toContain('蓝海');
    });
  });
});
