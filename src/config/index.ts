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
 * - Kimi Code: https://api.kimi.com/coding/v1
 * - DeepSeek: https://api.deepseek.com/v1
 * - Qwen: https://dashscope.aliyuncs.com/compatible-mode/v1
 * - OpenAI: https://api.openai.com/v1
 */

export interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  /** Optional extra headers (e.g. User-Agent for Kimi Code) */
  headers?: Record<string, string>;
  /** Request timeout in seconds (default: 3000 = 50 minutes) */
  timeout?: number;
  /** Max tokens for response (default: 4096) */
  maxTokens?: number;
  /** Temperature for sampling (default: 0.7) */
  temperature?: number;
}

export interface KeleConfig {
  providers: Record<string, ProviderConfig>;
  defaultProvider?: string;
  /** If true, skip all confirmation checkpoints */
  autoYes?: boolean;
  /** If false, disable telemetry collection */
  telemetry?: boolean;
  /** Preferred output directory */
  outputDir?: string;
}

const CONFIG_DIR = join(homedir(), '.kele');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: KeleConfig = {
  providers: {},
  autoYes: false,
  telemetry: true,
  outputDir: join(homedir(), 'kele-projects'),
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

export function getAutoYes(): boolean {
  return loadConfig().autoYes ?? false;
}

export function setAutoYes(value: boolean): void {
  const config = loadConfig();
  config.autoYes = value;
  saveConfig(config);
}

export function getTelemetryEnabled(): boolean {
  return loadConfig().telemetry ?? true;
}

export function setTelemetryEnabled(value: boolean): void {
  const config = loadConfig();
  config.telemetry = value;
  saveConfig(config);
}

export function getOutputDir(): string {
  return loadConfig().outputDir ?? join(homedir(), 'kele-projects');
}

export function setOutputDir(dir: string): void {
  const config = loadConfig();
  config.outputDir = dir;
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
    const headerInfo = cfg.headers ? `\n    headers: ${Object.keys(cfg.headers).join(', ')}` : '';
    const opts = [
      cfg.timeout && `timeout: ${cfg.timeout}s`,
      cfg.maxTokens && `maxTokens: ${cfg.maxTokens}`,
    ].filter(Boolean).join(', ');
    const optStr = opts ? `\n    options: ${opts}` : '';
    return `  ${name}: ${cfg.model} @ ${cfg.baseURL}\n    key: ${masked}${headerInfo}${optStr}`;
  });

  const outputDir = config.outputDir ?? join(homedir(), 'kele-projects');
  const extras = [
    `Output dir: ${outputDir}`,
    config.autoYes ? 'Auto-yes: enabled' : null,
    config.telemetry === false ? 'Telemetry: disabled' : null,
  ].filter(Boolean);

  return `Providers (${providers.length}):\n${providers.join('\n')}\n\nDefault: ${config.defaultProvider ?? '(none)'}\n${extras.join('\n')}`;
}
