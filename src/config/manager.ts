/**
 * Configuration Manager — handles reading/writing kele config.
 *
 * Config file: ~/.kele/config.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { KeleConfig, ProviderConfig } from './types.js';

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
  return loadConfig().providers[name];
}

export function listProviders(): string[] {
  return Object.keys(loadConfig().providers);
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

export function getOutputDir(): string {
  return loadConfig().outputDir ?? join(homedir(), 'kele-projects');
}

export function setOutputDir(dir: string): void {
  const config = loadConfig();
  config.outputDir = dir;
  saveConfig(config);
}

export function hasAnyProvider(): boolean {
  return listProviders().length > 0;
}

export function getConfigSummary(): string {
  const config = loadConfig();
  const providers = Object.entries(config.providers).map(([name, cfg]) => {
    const masked = cfg.apiKey.length > 12
      ? cfg.apiKey.slice(0, 8) + '...' + cfg.apiKey.slice(-4)
      : cfg.apiKey.slice(0, 4) + '****';
    return `  ${name}: ${cfg.model} @ ${cfg.baseURL}\n    key: ${masked}`;
  });

  const outputDir = config.outputDir ?? join(homedir(), 'kele-projects');
  const platforms = [];
  if (config.defaultPlatform) platforms.push(`Default platform: ${config.defaultPlatform}`);
  if (config.github?.repo) platforms.push(`GitHub repo: ${config.github.repo}`);

  return `Providers (${providers.length}):\n${providers.join('\n')}\n\nDefault: ${config.defaultProvider ?? '(none)'}\nOutput dir: ${outputDir}${platforms.length > 0 ? '\n' + platforms.join('\n') : ''}`;
}

export function setDefaultPlatform(platform: string): void {
  const config = loadConfig();
  config.defaultPlatform = platform;
  saveConfig(config);
}

export function setGitHubConfig(repo?: string, token?: string, branch?: string): void {
  const config = loadConfig();
  config.github = config.github ?? {};
  if (repo !== undefined) config.github.repo = repo;
  if (token !== undefined) config.github.token = token;
  if (branch !== undefined) config.github.branch = branch;
  saveConfig(config);
}

export function setVercelConfig(token?: string): void {
  const config = loadConfig();
  config.vercel = config.vercel ?? {};
  if (token !== undefined) config.vercel.token = token;
  saveConfig(config);
}

export function setNetlifyConfig(token?: string, siteId?: string): void {
  const config = loadConfig();
  config.netlify = config.netlify ?? {};
  if (token !== undefined) config.netlify.token = token;
  if (siteId !== undefined) config.netlify.siteId = siteId;
  saveConfig(config);
}
