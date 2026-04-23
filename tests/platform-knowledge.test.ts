import { describe, it, expect } from 'vitest';
import {
  getPlatformGuide,
  formatPlatformGuideForPrompt,
  formatReleaseInsightForUser,
  formatReleaseChecklist,
  getDeployCommandGuide,
  getDeployableConfigTemplate,
  PLATFORM_RELEASE_GUIDE,
} from '../src/platform-knowledge.js';

describe('platform-knowledge', () => {
  describe('getPlatformGuide', () => {
    it('returns guide for web platform', () => {
      const guide = getPlatformGuide('web');
      expect(guide).toBeDefined();
      expect(guide?.steps.length).toBeGreaterThan(0);
      expect(guide?.requiredMaterials.length).toBeGreaterThan(0);
    });

    it('returns guide for wechat-miniprogram', () => {
      const guide = getPlatformGuide('wechat-miniprogram');
      expect(guide).toBeDefined();
    });

    it('returns guide for steam', () => {
      const guide = getPlatformGuide('steam');
      expect(guide).toBeDefined();
    });

    it('returns guide for app-store', () => {
      const guide = getPlatformGuide('app-store');
      expect(guide).toBeDefined();
    });

    it('returns guide for google-play', () => {
      const guide = getPlatformGuide('google-play');
      expect(guide).toBeDefined();
    });

    it('returns guide for discord-bot', () => {
      const guide = getPlatformGuide('discord-bot');
      expect(guide).toBeDefined();
    });

    it('returns guide for telegram-bot', () => {
      const guide = getPlatformGuide('telegram-bot');
      expect(guide).toBeDefined();
    });

    it('returns guide for douyin', () => {
      const guide = getPlatformGuide('douyin');
      expect(guide).toBeDefined();
    });

    it('returns undefined for unknown platform', () => {
      expect(getPlatformGuide('unknown-platform')).toBeUndefined();
    });
  });

  describe('PLATFORM_RELEASE_GUIDE data completeness', () => {
    it('every guide has steps, materials, and userInfo', () => {
      for (const [platform, guide] of Object.entries(PLATFORM_RELEASE_GUIDE)) {
        expect(guide.steps.length, `${platform}: missing steps`).toBeGreaterThan(0);
        expect(guide.requiredMaterials.length, `${platform}: missing materials`).toBeGreaterThan(0);
        expect(guide.userInfoNeeded.length, `${platform}: missing userInfo`).toBeGreaterThan(0);
        expect(guide.notes.length, `${platform}: missing notes`).toBeGreaterThan(0);
      }
    });

    it('every step has title, description, and estimatedDays', () => {
      for (const [platform, guide] of Object.entries(PLATFORM_RELEASE_GUIDE)) {
        for (const step of guide.steps) {
          expect(step.title, `${platform}: step missing title`).toBeTruthy();
          expect(step.description, `${platform}: step missing description`).toBeTruthy();
          expect(step.estimatedDays, `${platform}: step missing estimatedDays`).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('every userInfo field has field, label, reason, and required', () => {
      for (const [platform, guide] of Object.entries(PLATFORM_RELEASE_GUIDE)) {
        for (const info of guide.userInfoNeeded) {
          expect(info.field, `${platform}: userInfo missing field`).toBeTruthy();
          expect(info.label, `${platform}: userInfo missing label`).toBeTruthy();
          expect(info.reason, `${platform}: userInfo missing reason`).toBeTruthy();
          expect(typeof info.required, `${platform}: userInfo missing required`).toBe('boolean');
        }
      }
    });
  });

  describe('formatPlatformGuideForPrompt', () => {
    it('formats web guide as prompt text', () => {
      const text = formatPlatformGuideForPrompt('web');
      expect(text).toContain('PLATFORM PUBLISHING GUIDE for web');
      expect(text).toContain('Publishing steps:');
      expect(text).toContain('Required materials:');
      expect(text).toContain('User information needed:');
      expect(text).toContain('Notes:');
    });

    it('returns empty string for unknown platform', () => {
      expect(formatPlatformGuideForPrompt('unknown')).toBe('');
    });
  });

  describe('formatReleaseInsightForUser', () => {
    it('formats web insight with total days', () => {
      const text = formatReleaseInsightForUser('web');
      expect(text).toContain('📢 发布洞察');
      expect(text).toContain('web');
      expect(text).toContain('📋 你需要准备的材料');
      expect(text).toContain('👤 必填信息');
      expect(text).toContain('📝 发布步骤概览');
    });

    it('includes optional info when present', () => {
      const text = formatReleaseInsightForUser('wechat-miniprogram');
      // WeChat has optional fields (companyName, businessLicense)
      expect(text).toContain('👤 可选信息');
    });

    it('returns empty string for unknown platform', () => {
      expect(formatReleaseInsightForUser('unknown')).toBe('');
    });
  });

  describe('formatReleaseChecklist', () => {
    it('formats checklist with checkboxes', () => {
      const text = formatReleaseChecklist('web');
      expect(text).toContain('📦 发布准备清单');
      expect(text).toContain('[ ]');
      // Should have as many checkboxes as steps
      const guide = getPlatformGuide('web')!;
      const checkboxCount = (text.match(/\[ \]/g) || []).length;
      expect(checkboxCount).toBe(guide.steps.length);
    });

    it('returns empty string for unknown platform', () => {
      expect(formatReleaseChecklist('unknown')).toBe('');
    });
  });

  describe('getDeployCommandGuide', () => {
    it('returns guide for web', () => {
      const text = getDeployCommandGuide('web', '/tmp/project');
      expect(text).toContain('一键部署指南');
      expect(text).toContain('/tmp/project');
    });

    it('returns guide for steam', () => {
      const text = getDeployCommandGuide('steam', '/tmp/game');
      expect(text).toContain('Steam');
      expect(text).toContain('/tmp/game');
    });

    it('returns guide for app-store', () => {
      const text = getDeployCommandGuide('app-store', '/tmp/app');
      expect(text).toContain('App Store');
    });

    it('returns guide for google-play', () => {
      const text = getDeployCommandGuide('google-play', '/tmp/app');
      expect(text).toContain('Google Play');
    });

    it('returns empty string for unknown platform', () => {
      expect(getDeployCommandGuide('unknown', '/tmp')).toBe('');
    });
  });

  describe('getDeployableConfigTemplate', () => {
    it('returns template for web', () => {
      const text = getDeployableConfigTemplate('web');
      expect(text).toContain('manifest.json');
      expect(text).toContain('sw.js');
      expect(text).toContain('PWA');
      expect(text).toContain('.github/workflows/deploy.yml');
    });

    it('returns template for wechat-miniprogram', () => {
      const text = getDeployableConfigTemplate('wechat-miniprogram');
      expect(text).toContain('project.config.json');
    });

    it('returns template for google-play', () => {
      const text = getDeployableConfigTemplate('google-play');
      expect(text).toContain('fastlane');
    });

    it('returns template for discord-bot', () => {
      const text = getDeployableConfigTemplate('discord-bot');
      expect(text).toContain('.env.example');
    });

    it('returns template for itchio', () => {
      const text = getDeployableConfigTemplate('itchio');
      expect(text).toContain('.itch.toml');
    });

    it('returns template for github-sponsors', () => {
      const text = getDeployableConfigTemplate('github-sponsors');
      expect(text).toContain('FUNDING.yml');
    });

    it('returns empty string for unknown platform', () => {
      expect(getDeployableConfigTemplate('unknown')).toBe('');
    });

    it('returns template for steam', () => {
      const text = getDeployableConfigTemplate('steam');
      expect(text.length).toBeGreaterThan(0);
    });

    it('returns template for app-store', () => {
      const text = getDeployableConfigTemplate('app-store');
      expect(text.length).toBeGreaterThan(0);
    });
  });
});
