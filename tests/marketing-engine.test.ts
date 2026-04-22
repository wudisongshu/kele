import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  generateAssets,
  selectChannels,
  generateSEO,
  generateMarketingPlan,
  writeMarketingAssets,
  formatMarketingPlan,
} from '../src/core/marketing-engine.js';
import type { Project } from '../types/index.js';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-1',
    name: 'Pixel Defense',
    idea: {
      id: 'idea-1',
      rawText: '像素风格塔防游戏',
      type: 'game',
      monetization: 'web',
      complexity: 'medium',
      keywords: ['塔防', '像素'],
      createdAt: new Date().toISOString(),
    },
    subProjects: [],
    tasks: [],
    status: 'completed',
    rootDir: '/tmp/test-project',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('MarketingEngine', () => {
  describe('generateAssets', () => {
    it('should generate copy for multiple platforms', () => {
      const assets = generateAssets(makeProject());
      expect(assets.copy.length).toBeGreaterThan(0);

      const platforms = new Set(assets.copy.map((c) => c.platform));
      expect(platforms.has('Twitter/X')).toBe(true);
      expect(platforms.has('抖音/小红书')).toBe(true);
    });

    it('should generate both Chinese and English copy', () => {
      const assets = generateAssets(makeProject());
      const zh = assets.copy.filter((c) => c.language === 'zh');
      const en = assets.copy.filter((c) => c.language === 'en');
      expect(zh.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
    });

    it('should generate real usable copy (not placeholder)', () => {
      const assets = generateAssets(makeProject());
      for (const c of assets.copy) {
        expect(c.headline.length).toBeGreaterThan(5);
        expect(c.body.length).toBeGreaterThan(20);
        expect(c.cta.length).toBeGreaterThan(0);
      }
    });

    it('should include project name in copy', () => {
      const assets = generateAssets(makeProject({ name: 'SuperGame' }));
      const twitterEn = assets.copy.find((c) => c.platform === 'Twitter/X' && c.language === 'en');
      expect(twitterEn!.body).toContain('SuperGame');
    });

    it('should generate 5 headline options', () => {
      const assets = generateAssets(makeProject());
      expect(assets.headlines.length).toBe(5);
      for (const h of assets.headlines) {
        expect(h.text).toBeTruthy();
        expect(h.angle).toBeTruthy();
      }
    });

    it('should generate screenshot scripts for games', () => {
      const assets = generateAssets(makeProject({ idea: { ...makeProject().idea, type: 'game' } }));
      expect(assets.screenshots.length).toBe(5);
      expect(assets.screenshots[0].title).toContain('封面');
    });

    it('should generate screenshot scripts for tools', () => {
      const assets = generateAssets(makeProject({ idea: { ...makeProject().idea, type: 'tool' } }));
      expect(assets.screenshots.length).toBe(5);
      expect(assets.screenshots[0].title).toContain('封面');
    });

    it('should generate video scripts in 3 lengths', () => {
      const assets = generateAssets(makeProject());
      expect(assets.videos.length).toBe(3);
      const durations = assets.videos.map((v) => v.duration);
      expect(durations).toContain(15);
      expect(durations).toContain(30);
      expect(durations).toContain(60);
    });

    it('should include scenes in video scripts', () => {
      const assets = generateAssets(makeProject());
      for (const video of assets.videos) {
        expect(video.scenes.length).toBeGreaterThan(0);
        expect(video.musicSuggestion).toBeTruthy();
      }
    });

    it('should generate SEO bundle', () => {
      const assets = generateAssets(makeProject());
      expect(assets.seo.title).toBeTruthy();
      expect(assets.seo.metaDescription).toBeTruthy();
      expect(assets.seo.keywords.length).toBeGreaterThan(0);
      expect(assets.seo.landingPageHeadline).toBeTruthy();
      expect(assets.seo.landingPageCta).toBeTruthy();
    });

    it('should include project keywords in SEO', () => {
      const assets = generateAssets(makeProject({ name: 'MyGame', idea: { ...makeProject().idea, rawText: 'puzzle strategy game' } }));
      const seoText = assets.seo.keywords.join(' ') + assets.seo.metaDescription;
      expect(seoText.toLowerCase()).toContain('puzzle');
    });
  });

  describe('selectChannels', () => {
    it('should recommend game channels for game projects', () => {
      const channels = selectChannels(makeProject({ idea: { ...makeProject().idea, type: 'game' } }));
      const ids = channels.map((c) => c.id);
      expect(ids).toContain('twitter');
      expect(ids).toContain('reddit');
      expect(ids).toContain('douyin');
    });

    it('should recommend tool channels for tool projects', () => {
      const channels = selectChannels(makeProject({ idea: { ...makeProject().idea, type: 'tool' } }));
      const ids = channels.map((c) => c.id);
      expect(ids).toContain('producthunt');
      expect(ids).toContain('hackernews');
      expect(ids).toContain('v2ex');
    });

    it('should recommend bot channels for bot projects', () => {
      const channels = selectChannels(makeProject({ idea: { ...makeProject().idea, type: 'bot' } }));
      const ids = channels.map((c) => c.id);
      expect(ids).toContain('discord');
      expect(ids).toContain('telegram');
    });

    it('should filter English-only channels for WeChat mini-programs', () => {
      const channels = selectChannels(makeProject({
        idea: { ...makeProject().idea, type: 'game', monetization: 'wechat-miniprogram' },
      }));
      const ids = channels.map((c) => c.id);
      expect(ids).not.toContain('reddit');
      expect(ids).not.toContain('producthunt');
      expect(ids).not.toContain('hackernews');
      expect(ids).toContain('douyin');
      expect(ids).toContain('xiaohongshu');
    });

    it('should include Douyin for Douyin monetization', () => {
      const channels = selectChannels(makeProject({
        idea: { ...makeProject().idea, type: 'game', monetization: 'douyin' },
      }));
      const ids = channels.map((c) => c.id);
      expect(ids).toContain('douyin');
    });

    it('should include Steam channel for Steam games', () => {
      const channels = selectChannels(makeProject({
        idea: { ...makeProject().idea, type: 'game', monetization: 'steam' },
      }));
      const ids = channels.map((c) => c.id);
      expect(ids).toContain('steam');
    });

    it('should include itch.io for web games', () => {
      const channels = selectChannels(makeProject({
        idea: { ...makeProject().idea, type: 'game', monetization: 'web' },
      }));
      const ids = channels.map((c) => c.id);
      expect(ids).toContain('itchio');
    });

    it('should have bestTime and estimatedReach for all channels', () => {
      const channels = selectChannels(makeProject());
      for (const ch of channels) {
        expect(ch.bestTime).toBeTruthy();
        expect(ch.estimatedReach).toBeTruthy();
        expect(ch.effort).toBeTruthy();
        expect(ch.format).toBeTruthy();
        expect(ch.specificTips.length).toBeGreaterThan(0);
      }
    });
  });

  describe('generateSEO', () => {
    it('should generate relevant keywords', () => {
      const seo = generateSEO(makeProject({ idea: { ...makeProject().idea, rawText: '塔防 像素 策略游戏', type: 'game' } }));
      const allText = seo.keywords.join(' ') + seo.metaDescription;
      expect(allText).toContain('塔防');
      expect(allText).toContain('像素');
    });

    it('should generate unique keywords', () => {
      const seo = generateSEO(makeProject());
      const unique = new Set(seo.keywords);
      expect(unique.size).toBe(seo.keywords.length);
    });

    it('should limit keywords to reasonable count', () => {
      const seo = generateSEO(makeProject());
      expect(seo.keywords.length).toBeLessThanOrEqual(12);
    });
  });

  describe('generateMarketingPlan', () => {
    it('should return complete plan', () => {
      const plan = generateMarketingPlan(makeProject());
      expect(plan.assets).toBeDefined();
      expect(plan.channels.length).toBeGreaterThan(0);
      expect(plan.schedule.length).toBeGreaterThan(0);
    });

    it('should schedule high-effort channels first', () => {
      const plan = generateMarketingPlan(makeProject());
      const highEffortChannels = plan.channels.filter((c) => c.effort === 'high');
      if (highEffortChannels.length > 0) {
        const firstScheduled = plan.schedule[0];
        const firstChannel = plan.channels.find((c) => c.name === firstScheduled.channel);
        expect(firstChannel!.effort).toBe('high');
      }
    });
  });

  describe('writeMarketingAssets', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'kele-marketing-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it('should write all expected files', () => {
      const project = makeProject();
      const { assets, channels, schedule } = generateMarketingPlan(project);
      writeMarketingAssets(project, assets, channels, schedule, tempDir);

      expect(existsSync(join(tempDir, 'copy'))).toBe(true);
      expect(existsSync(join(tempDir, 'scripts'))).toBe(true);
      expect(existsSync(join(tempDir, 'headlines.md'))).toBe(true);
      expect(existsSync(join(tempDir, 'screenshot-guide.md'))).toBe(true);
      expect(existsSync(join(tempDir, 'seo.md'))).toBe(true);
      expect(existsSync(join(tempDir, 'channels.md'))).toBe(true);
      expect(existsSync(join(tempDir, 'schedule.md'))).toBe(true);
    });

    it('should write copy files with platform names', () => {
      const project = makeProject();
      const { assets, channels, schedule } = generateMarketingPlan(project);
      writeMarketingAssets(project, assets, channels, schedule, tempDir);

      const copyFiles = readFileSync(join(tempDir, 'copy', 'Twitter_X_en.md'), 'utf-8');
      expect(copyFiles).toContain('Twitter/X');
      expect(copyFiles).toContain('## 标题');
      expect(copyFiles).toContain('## 正文');
    });

    it('should write video scripts for all durations', () => {
      const project = makeProject();
      const { assets, channels, schedule } = generateMarketingPlan(project);
      writeMarketingAssets(project, assets, channels, schedule, tempDir);

      expect(existsSync(join(tempDir, 'scripts', 'video_15s.md'))).toBe(true);
      expect(existsSync(join(tempDir, 'scripts', 'video_30s.md'))).toBe(true);
      expect(existsSync(join(tempDir, 'scripts', 'video_60s.md'))).toBe(true);
    });

    it('should include project name in written files', () => {
      const project = makeProject({ name: 'TestGame42' });
      const { assets, channels, schedule } = generateMarketingPlan(project);
      writeMarketingAssets(project, assets, channels, schedule, tempDir);

      const seo = readFileSync(join(tempDir, 'seo.md'), 'utf-8');
      expect(seo).toContain('TestGame42');
    });
  });

  describe('formatMarketingPlan', () => {
    it('should include all sections in terminal output', () => {
      const project = makeProject();
      const { assets, channels, schedule } = generateMarketingPlan(project);
      const output = formatMarketingPlan(assets, channels, schedule);

      expect(output).toContain('📢 运营方案已生成');
      expect(output).toContain('📝 文案');
      expect(output).toContain('🎬 视频脚本');
      expect(output).toContain('📸 截图指南');
      expect(output).toContain('🏷️  A/B 标题');
      expect(output).toContain('🔍 SEO 配置');
      expect(output).toContain('📅 发布日历');
      expect(output).toContain('🎯 预估首周曝光');
    });

    it('should show reach estimate when channels have data', () => {
      const project = makeProject();
      const { assets, channels, schedule } = generateMarketingPlan(project);
      const output = formatMarketingPlan(assets, channels, schedule);
      expect(output).toContain('PV');
    });
  });
});
