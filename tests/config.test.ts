import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_HOME = join(tmpdir(), `kele-config-test-${Date.now()}`);

describe('config', () => {
  beforeEach(() => {
    process.env.HOME = TEST_HOME;
    process.env.USERPROFILE = TEST_HOME;
    mkdirSync(join(TEST_HOME, '.kele'), { recursive: true });
    vi.resetModules();
  });

  afterEach(() => {
    try { rmSync(TEST_HOME, { recursive: true }); } catch { /* ignore */ }
    delete process.env.HOME;
    delete process.env.USERPROFILE;
  });

  async function importConfig() {
    return import('../src/config/index.js');
  }

  it('loads default config when file does not exist', async () => {
    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.providers).toEqual({});
    expect(config.autoYes).toBe(false);
    expect(config.telemetry).toBe(true);
    expect(config.defaultProvider).toBeUndefined();
  });

  it('saves and loads config', async () => {
    const { loadConfig, saveConfig } = await importConfig();
    const config = {
      providers: {
        deepseek: {
          apiKey: 'sk-test123',
          baseURL: 'https://api.deepseek.com/v1',
          model: 'deepseek-chat',
        },
      },
      defaultProvider: 'deepseek',
      autoYes: true,
      telemetry: false,
    };
    saveConfig(config as any);

    const loaded = loadConfig();
    expect(loaded.providers.deepseek).toBeDefined();
    expect(loaded.providers.deepseek.apiKey).toBe('sk-test123');
    expect(loaded.defaultProvider).toBe('deepseek');
    expect(loaded.autoYes).toBe(true);
    expect(loaded.telemetry).toBe(false);
  });

  it('setProvider adds provider and auto-sets default', async () => {
    const { setProvider, getDefaultProvider, getProviderConfig } = await importConfig();
    setProvider('openai', {
      apiKey: 'sk-abc',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4',
    });

    expect(getDefaultProvider()).toBe('openai');
    const cfg = getProviderConfig('openai');
    expect(cfg?.model).toBe('gpt-4');
  });

  it('setDefaultProvider changes default', async () => {
    const { setProvider, setDefaultProvider, getDefaultProvider } = await importConfig();
    setProvider('p1', { apiKey: 'k1', baseURL: 'u1', model: 'm1' });
    setProvider('p2', { apiKey: 'k2', baseURL: 'u2', model: 'm2' });

    setDefaultProvider('p2');
    expect(getDefaultProvider()).toBe('p2');
  });

  it('removeProvider deletes provider and updates default', async () => {
    const { setProvider, removeProvider, getDefaultProvider, listProviders } = await importConfig();
    setProvider('p1', { apiKey: 'k1', baseURL: 'u1', model: 'm1' });
    setProvider('p2', { apiKey: 'k2', baseURL: 'u2', model: 'm2' });

    removeProvider('p1');
    expect(listProviders()).not.toContain('p1');
    expect(getDefaultProvider()).toBe('p2');
  });

  it('removeProvider clears default when last provider removed', async () => {
    const { setProvider, removeProvider, getDefaultProvider } = await importConfig();
    setProvider('p1', { apiKey: 'k1', baseURL: 'u1', model: 'm1' });

    removeProvider('p1');
    expect(getDefaultProvider()).toBeUndefined();
  });

  it('hasAnyProvider returns correct state', async () => {
    const { setProvider, removeProvider, hasAnyProvider } = await importConfig();
    expect(hasAnyProvider()).toBe(false);

    setProvider('p1', { apiKey: 'k1', baseURL: 'u1', model: 'm1' });
    expect(hasAnyProvider()).toBe(true);

    removeProvider('p1');
    expect(hasAnyProvider()).toBe(false);
  });

  it('autoYes getters and setters work', async () => {
    const { setAutoYes, getAutoYes } = await importConfig();
    expect(getAutoYes()).toBe(false);

    setAutoYes(true);
    expect(getAutoYes()).toBe(true);
  });

  it('telemetry getters and setters work', async () => {
    const { setTelemetryEnabled, getTelemetryEnabled } = await importConfig();
    expect(getTelemetryEnabled()).toBe(true);

    setTelemetryEnabled(false);
    expect(getTelemetryEnabled()).toBe(false);
  });

  it('outputDir getters and setters work', async () => {
    const { setOutputDir, getOutputDir } = await importConfig();
    const customDir = '/tmp/kele-custom-output';

    setOutputDir(customDir);
    expect(getOutputDir()).toBe(customDir);
  });

  it('defaultPlatform getters and setters work', async () => {
    const { setDefaultPlatform, getDefaultPlatform } = await importConfig();
    expect(getDefaultPlatform()).toBeUndefined();

    setDefaultPlatform('web');
    expect(getDefaultPlatform()).toBe('web');
  });

  it('getConfigSummary includes providers and platform', async () => {
    const { setProvider, setDefaultPlatform, getConfigSummary } = await importConfig();
    setProvider('deepseek', {
      apiKey: 'sk-very-long-test-key-1234',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      timeout: 3000,
    });
    setDefaultPlatform('web');

    const summary = getConfigSummary();
    expect(summary).toContain('deepseek');
    expect(summary).toContain('deepseek-chat');
    expect(summary).toContain('Default platform: web');
    expect(summary).not.toContain('sk-very-long-test-key-1234');
  });

  it('handles corrupted config file gracefully', async () => {
    const configPath = join(TEST_HOME, '.kele', 'config.json');
    writeFileSync(configPath, 'not valid json {{{', 'utf-8');

    const { loadConfig } = await importConfig();
    const config = loadConfig();
    expect(config.providers).toEqual({});
    expect(config.autoYes).toBe(false);
  });
});
