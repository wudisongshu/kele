import { describe, it, expect } from 'vitest';
import { getTemplateType, getTemplateDescription, loadTemplate } from '../src/core/template-loader.js';

describe('TemplateLoader', () => {
  it('maps monetization channels to template types', () => {
    expect(getTemplateType('web')).toBe('pwa-game');
    expect(getTemplateType('wechat-miniprogram')).toBe('wechat-miniprogram');
    expect(getTemplateType('douyin')).toBe('douyin-game');
    expect(getTemplateType('steam')).toBe('steam-game');
    expect(getTemplateType('app-store')).toBe('ios-app');
    expect(getTemplateType('google-play')).toBe('android-app');
    expect(getTemplateType('discord-bot')).toBe('discord-bot');
    expect(getTemplateType('telegram-bot')).toBe('telegram-bot');
    expect(getTemplateType('itchio')).toBe('itchio-game');
    expect(getTemplateType('github-sponsors')).toBe('github-sponsors');
    expect(getTemplateType('unknown')).toBe('pwa-game');
  });

  it('returns descriptions for all template types', () => {
    expect(getTemplateDescription('pwa-game')).toContain('PWA');
    expect(getTemplateDescription('wechat-miniprogram')).toContain('WeChat');
    expect(getTemplateDescription('discord-bot')).toContain('Discord');
    expect(getTemplateDescription('ios-app')).toContain('iOS');
    expect(getTemplateDescription('itchio-game')).toContain('itch.io');
    expect(getTemplateDescription('github-sponsors')).toContain('GitHub Sponsors');
    expect(getTemplateDescription('unknown-type' as any)).toBe('Generic web project template');
  });

  it('loads template files from disk', () => {
    const files = loadTemplate('web-scaffold');
    expect(files.length).toBeGreaterThan(0);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('index.html');
  });

  it('returns empty array for missing template', () => {
    const files = loadTemplate('nonexistent-template' as any);
    expect(files).toEqual([]);
  });
});
