import { describe, it, expect } from 'vitest';
import { getDeployStrategy, listDeployPlatforms, detectPlatformFromProject } from '../src/core/deploy-strategies.js';

describe('deploy-strategies', () => {
  describe('getDeployStrategy', () => {
    it('returns strategy for known platforms', () => {
      const gh = getDeployStrategy('github-pages');
      expect(gh).toBeDefined();
      expect(gh?.name).toBe('github-pages');
    });

    it('returns undefined for unknown platform', () => {
      expect(getDeployStrategy('mars-server')).toBeUndefined();
    });
  });

  describe('listDeployPlatforms', () => {
    it('returns an array of platform names', () => {
      const platforms = listDeployPlatforms();
      expect(platforms.length).toBeGreaterThan(0);
      expect(platforms).toContain('github-pages');
      expect(platforms).toContain('itchio');
    });
  });

  describe('detectPlatformFromProject', () => {
    it('maps web to github-pages', () => {
      expect(detectPlatformFromProject('web')).toBe('github-pages');
    });

    it('maps wechat-miniprogram to wechat-miniprogram', () => {
      expect(detectPlatformFromProject('wechat-miniprogram')).toBe('wechat-miniprogram');
    });

    it('maps itchio to itchio', () => {
      expect(detectPlatformFromProject('itchio')).toBe('itchio');
    });

    it('returns undefined for unsupported platforms', () => {
      expect(detectPlatformFromProject('douyin')).toBeUndefined();
      expect(detectPlatformFromProject('discord-bot')).toBeUndefined();
      expect(detectPlatformFromProject('telegram-bot')).toBeUndefined();
    });

    it('returns undefined for unknown monetization', () => {
      expect(detectPlatformFromProject('unknown')).toBeUndefined();
    });
  });
});
