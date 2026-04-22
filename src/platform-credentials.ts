import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Platform Credential Manager
 *
 * Manages user credentials for deployment platforms.
 * Stored in ~/.kele/secrets.json (never committed to git).
 *
 * When kele needs to deploy to a platform (WeChat, Douyin, Steam, etc.),
 * it checks if the required credentials are available. If not, it prompts
 * the user to enter them before continuing execution.
 */

const SECRETS_PATH = join(homedir(), '.kele', 'secrets.json');

export interface PlatformCredentials {
  /** WeChat Mini Program */
  'wechat-miniprogram'?: {
    appId: string;
    appSecret?: string;
  };
  /** Douyin Mini Game */
  douyin?: {
    appId: string;
    appSecret?: string;
  };
  /** Steam */
  steam?: {
    appId: string;
    publisherApiKey?: string;
  };
  /** Apple App Store */
  'app-store'?: {
    teamId: string;
    bundleId: string;
    issuerId?: string;
    apiKeyId?: string;
  };
  /** Google Play */
  'google-play'?: {
    packageName: string;
    serviceAccountJson?: string;
  };
  /** itch.io */
  itchio?: {
    apiKey: string;
  };
  /** GitHub Sponsors */
  'github-sponsors'?: {
    username: string;
  };
  /** VPS / Self-hosted server */
  vps?: {
    host: string;
    path?: string;
    port?: string;
    sshKey?: string;
  };
}

/**
 * Human-readable field definitions per platform.
 */
export const PLATFORM_FIELDS: Record<string, Array<{ key: string; label: string; required: boolean; sensitive: boolean }>> = {
  'wechat-miniprogram': [
    { key: 'appId', label: '微信小程序 AppID', required: true, sensitive: false },
    { key: 'appSecret', label: '微信小程序 AppSecret', required: false, sensitive: true },
  ],
  douyin: [
    { key: 'appId', label: '抖音小游戏 AppID', required: true, sensitive: false },
    { key: 'appSecret', label: '抖音小游戏 AppSecret', required: false, sensitive: true },
  ],
  steam: [
    { key: 'appId', label: 'Steam App ID', required: true, sensitive: false },
    { key: 'publisherApiKey', label: 'Steam Publisher Web API Key', required: false, sensitive: true },
  ],
  'app-store': [
    { key: 'teamId', label: 'Apple Team ID', required: true, sensitive: false },
    { key: 'bundleId', label: 'Bundle Identifier', required: true, sensitive: false },
  ],
  'google-play': [
    { key: 'packageName', label: 'Package Name', required: true, sensitive: false },
    { key: 'serviceAccountJson', label: 'Service Account JSON', required: false, sensitive: true },
  ],
  'itchio': [
    { key: 'apiKey', label: 'itch.io Butler API Key', required: false, sensitive: true },
  ],
  'github-sponsors': [
    { key: 'githubUsername', label: 'GitHub Username', required: false, sensitive: false },
  ],
  'vps': [
    { key: 'host', label: 'SSH Host (user@server.com)', required: true, sensitive: false },
    { key: 'path', label: 'Remote deploy path', required: false, sensitive: false },
    { key: 'port', label: 'SSH Port', required: false, sensitive: false },
    { key: 'sshKey', label: 'SSH Private Key Path', required: false, sensitive: true },
  ],
};

function loadSecrets(): PlatformCredentials {
  if (!existsSync(SECRETS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SECRETS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSecrets(secrets: PlatformCredentials): void {
  mkdirSync(join(homedir(), '.kele'), { recursive: true });
  writeFileSync(SECRETS_PATH, JSON.stringify(secrets, null, 2), 'utf-8');
}

/**
 * Check if a platform has all required credentials.
 */
export function hasPlatformCredentials(platform: string): boolean {
  const secrets = loadSecrets();
  const creds = secrets[platform as keyof PlatformCredentials];
  if (!creds) return false;

  const fields = PLATFORM_FIELDS[platform];
  if (!fields) return true; // unknown platform, assume ok

  for (const field of fields) {
    if (field.required && !(creds as Record<string, string>)[field.key]) {
      return false;
    }
  }
  return true;
}

/**
 * Get credentials for a platform.
 */
export function getPlatformCredentials(platform: string): Record<string, string> | undefined {
  const secrets = loadSecrets();
  return secrets[platform as keyof PlatformCredentials] as Record<string, string> | undefined;
}

/**
 * Set credentials for a platform.
 */
export function setPlatformCredentials(platform: string, creds: Record<string, string>): void {
  const secrets = loadSecrets();
  (secrets as Record<string, Record<string, string>>)[platform] = creds;
  saveSecrets(secrets);
}

/**
 * List platforms that are missing required credentials.
 */
export function getMissingCredentials(): Array<{ platform: string; fields: string[] }> {
  const missing: Array<{ platform: string; fields: string[] }> = [];
  for (const [platform, fields] of Object.entries(PLATFORM_FIELDS)) {
    if (!hasPlatformCredentials(platform)) {
      const missingFields = fields.filter((f) => f.required).map((f) => f.label);
      missing.push({ platform, fields: missingFields });
    }
  }
  return missing;
}

/**
 * Get a human-readable description of what credentials are needed.
 */
export function getCredentialPrompt(platform: string): string {
  const fields = PLATFORM_FIELDS[platform];
  if (!fields) return `${platform}: 未知平台，无需特殊配置。`;

  const lines = fields.map((f) => {
    const req = f.required ? '（必填）' : '（可选）';
    return `  - ${f.label}${req}`;
  });

  return `部署到 ${platform} 需要以下信息：\n${lines.join('\n')}\n\n请输入（格式: key=value,key2=value2）:`;
}
