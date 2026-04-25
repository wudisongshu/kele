/**
 * Configuration type definitions.
 */

export interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  headers?: Record<string, string>;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
}

export interface KeleConfig {
  providers: Record<string, ProviderConfig>;
  defaultProvider?: string;
  autoYes?: boolean;
  telemetry?: boolean;
  outputDir?: string;
  defaultPlatform?: string;
  github?: {
    token?: string;
    repo?: string;
    branch?: string;
  };
  vercel?: {
    token?: string;
  };
  netlify?: {
    token?: string;
    siteId?: string;
  };
}
