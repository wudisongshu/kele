/**
 * Deploy module type definitions.
 */

export type DeployPlatform = 'static' | 'github-pages' | 'vercel' | 'netlify';

export interface DeployOptions {
  platform: DeployPlatform;
  /** Output directory for static export */
  outDir?: string;
  /** Custom project root (defaults to project.rootDir) */
  projectRoot?: string;
}

export interface DeployResult {
  success: boolean;
  url?: string;
  message: string;
}

export interface PlatformStatus {
  name: DeployPlatform;
  available: boolean;
  message: string;
}

export interface DeployConfig {
  defaultPlatform: DeployPlatform;
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
