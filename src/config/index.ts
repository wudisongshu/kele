import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * kele Configuration Manager
 *
 * Config file: ~/.kele/config.json
 *
 * Supports any OpenAI-compatible API provider:
 * - Kimi (Moonshot): https://api.moonshot.cn/v1
 * - DeepSeek: https://api.deepseek.com/v1
 * - Qwen: https://dashscope.aliyuncs.com/compatible-mode/v1
 * - OpenAI: https://api.openai.com/v1
 */

export interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface KeleConfig {
  providers: Record<string, ProviderConfig>;
  defaultProvider?: string;
}

const CONFIG_DIR = join(homedir(), '.kele');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: KeleConfig = {
  providers: {},
};

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function loadConfig(): KeleConfig {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as KeleConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: KeleConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function setProvider(name: string, cfg: ProviderConfig): void {
  const config = loadConfig();
  config.providers[name] = cfg;

  // Auto-set as default if it's the first provider
  if (!config.defaultProvider) {
    config.defaultProvider = name;
  }

  saveConfig(config);
}

export function removeProvider(name: string): void {
  const config = loadConfig();
  delete config.providers[name];

  if (config.defaultProvider === name) {
    const remaining = Object.keys(config.providers);
    config.defaultProvider = remaining[0];
  }

  saveConfig(config);
}

export function getProviderConfig(name: string): ProviderConfig | undefined {
  const config = loadConfig();
  return config.providers[name];
}

export function listProviders(): string[] {
  const config = loadConfig();
  return Object.keys(config.providers);
}

export function getDefaultProvider(): string | undefined {
  return loadConfig().defaultProvider;
}

export function setDefaultProvider(name: string): void {
  const config = loadConfig();
  config.defaultProvider = name;
  saveConfig(config);
}

/**
 * Check if any provider is configured.
 */
export function hasAnyProvider(): boolean {
  return listProviders().length > 0;
}

/**
 * Get a display-friendly config summary.
 */
export function getConfigSummary(): string {
  const config = loadConfig();
  const providers = Object.entries(config.providers).map(([name, cfg]) => {
    const masked = cfg.apiKey.length > 12
      ? cfg.apiKey.slice(0, 8) + '...' + cfg.apiKey.slice(-4)
      : cfg.apiKey.slice(0, 4) + '****';
    return `  ${name}: ${cfg.model} @ ${cfg.baseURL}\n    key: ${masked}`;
  });

  return `Providers (${providers.length}):\n${providers.join('\n')}\n\nDefault: ${config.defaultProvider ?? '(none)'}`;
}
