import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_HOME = join(tmpdir(), `kele-creds-test-${Date.now()}`);

describe('platform-credentials', () => {
  beforeEach(() => {
    process.env.HOME = TEST_HOME;
    process.env.USERPROFILE = TEST_HOME;
    mkdirSync(join(TEST_HOME, '.kele'), { recursive: true });
  });

  afterEach(() => {
    try { rmSync(TEST_HOME, { recursive: true }); } catch { /* ignore */ }
    delete process.env.HOME;
    delete process.env.USERPROFILE;
  });

  async function importModule() {
    return import('../src/platform-credentials.js');
  }

  describe('PLATFORM_FIELDS', () => {
    it('has fields for all supported platforms', async () => {
      const { PLATFORM_FIELDS } = await importModule();
      const platforms = Object.keys(PLATFORM_FIELDS);
      expect(platforms).toContain('wechat-miniprogram');
      expect(platforms).toContain('douyin');
      expect(platforms).toContain('steam');
      expect(platforms).toContain('app-store');
      expect(platforms).toContain('google-play');
      expect(platforms).toContain('itchio');
      expect(platforms).toContain('github-sponsors');
    });

    it('every field has key, label, required, sensitive', async () => {
      const { PLATFORM_FIELDS } = await importModule();
      for (const [platform, fields] of Object.entries(PLATFORM_FIELDS)) {
        for (const field of fields) {
          expect(field.key, `${platform}: missing key`).toBeTruthy();
          expect(field.label, `${platform}: missing label`).toBeTruthy();
          expect(typeof field.required, `${platform}: missing required`).toBe('boolean');
          expect(typeof field.sensitive, `${platform}: missing sensitive`).toBe('boolean');
        }
      }
    });

    it('sensitive fields are marked correctly', async () => {
      const { PLATFORM_FIELDS } = await importModule();
      // appSecret should be sensitive
      const wechatFields = PLATFORM_FIELDS['wechat-miniprogram'];
      const appSecret = wechatFields.find((f) => f.key === 'appSecret');
      expect(appSecret?.sensitive).toBe(true);
      expect(appSecret?.required).toBe(false);

      // appId should not be sensitive
      const appId = wechatFields.find((f) => f.key === 'appId');
      expect(appId?.sensitive).toBe(false);
      expect(appId?.required).toBe(true);
    });
  });

  describe('hasPlatformCredentials', () => {
    it('returns false when no credentials exist', async () => {
      const { hasPlatformCredentials } = await importModule();
      expect(hasPlatformCredentials('web')).toBe(false);
    });

    it('returns true when all required fields present', async () => {
      const { setPlatformCredentials, hasPlatformCredentials } = await importModule();
      setPlatformCredentials('wechat-miniprogram', { appId: 'wx123456' });
      expect(hasPlatformCredentials('wechat-miniprogram')).toBe(true);
    });

    it('returns false when required fields missing', async () => {
      const { setPlatformCredentials, hasPlatformCredentials } = await importModule();
      // app-store requires teamId AND bundleId
      setPlatformCredentials('app-store', { teamId: 'TEAM123' });
      expect(hasPlatformCredentials('app-store')).toBe(false);
    });

    it('returns true for unknown platform with any creds', async () => {
      const { setPlatformCredentials, hasPlatformCredentials } = await importModule();
      setPlatformCredentials('some-new-platform', { key: 'val' });
      expect(hasPlatformCredentials('some-new-platform')).toBe(true);
    });
  });

  describe('getPlatformCredentials / setPlatformCredentials', () => {
    it('round-trips credentials', async () => {
      const { setPlatformCredentials, getPlatformCredentials } = await importModule();
      const creds = { appId: 'wx-test', appSecret: 'secret123' };
      setPlatformCredentials('wechat-miniprogram', creds);

      const loaded = getPlatformCredentials('wechat-miniprogram');
      expect(loaded).toEqual(creds);
    });

    it('returns undefined for unset platform', async () => {
      const { getPlatformCredentials } = await importModule();
      expect(getPlatformCredentials('douyin')).toBeUndefined();
    });
  });

  describe('getMissingCredentials', () => {
    it('lists all platforms when no credentials set', async () => {
      const { getMissingCredentials } = await importModule();
      const missing = getMissingCredentials();
      const platforms = missing.map((m) => m.platform);
      expect(platforms).toContain('wechat-miniprogram');
      expect(platforms).toContain('steam');
      expect(platforms).toContain('app-store');
    });

    it('excludes platforms with complete credentials', async () => {
      const { setPlatformCredentials, getMissingCredentials } = await importModule();
      // Set complete credentials for wechat-miniprogram (only appId is required)
      setPlatformCredentials('wechat-miniprogram', { appId: 'wx123' });

      const missing = getMissingCredentials();
      const platforms = missing.map((m) => m.platform);
      expect(platforms).not.toContain('wechat-miniprogram');
    });

    it('includes required field labels', async () => {
      const { getMissingCredentials } = await importModule();
      const missing = getMissingCredentials();
      const steam = missing.find((m) => m.platform === 'steam');
      expect(steam?.fields).toContain('Steam App ID');
    });
  });

  describe('getCredentialPrompt', () => {
    it('formats prompt for known platform', async () => {
      const { getCredentialPrompt } = await importModule();
      const prompt = getCredentialPrompt('web');
      expect(prompt).toContain('web');
    });

    it('returns fallback for unknown platform', async () => {
      const { getCredentialPrompt } = await importModule();
      const prompt = getCredentialPrompt('unknown-platform');
      expect(prompt).toContain('未知平台');
    });

    it('includes required/optional markers', async () => {
      const { getCredentialPrompt } = await importModule();
      const prompt = getCredentialPrompt('wechat-miniprogram');
      expect(prompt).toContain('（必填）');
      expect(prompt).toContain('（可选）');
    });
  });

  describe('corrupted secrets file', () => {
    it('handles corrupted secrets.json gracefully', async () => {
      const secretsPath = join(TEST_HOME, '.kele', 'secrets.json');
      writeFileSync(secretsPath, 'not json {{{', 'utf-8');

      const { getPlatformCredentials, hasPlatformCredentials } = await importModule();
      expect(getPlatformCredentials('wechat-miniprogram')).toBeUndefined();
      expect(hasPlatformCredentials('wechat-miniprogram')).toBe(false);
    });
  });
});
