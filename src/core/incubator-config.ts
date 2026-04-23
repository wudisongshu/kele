import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Incubator configuration — per-project overrides for the AI incubator.
 */

export interface IncubatorConfig {
  /** Glob patterns for files that are exempt from sub-project whitelist checks. */
  whitelistOverrides?: string[];
}

const DEFAULT_CONFIG: IncubatorConfig = {
  whitelistOverrides: [],
};

/**
 * Load incubator config from `.kele/incubator-config.json` under the project root.
 * Returns defaults if the file does not exist.
 */
export function loadIncubatorConfig(projectRoot: string): IncubatorConfig {
  const configPath = join(projectRoot, '.kele', 'incubator-config.json');
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Config must be a JSON object');
    }

    const config = parsed as Record<string, unknown>;
    if (config.whitelistOverrides !== undefined) {
      if (!Array.isArray(config.whitelistOverrides) || !config.whitelistOverrides.every((v) => typeof v === 'string')) {
        throw new Error('whitelistOverrides must be an array of strings');
      }
    }

    return {
      whitelistOverrides: (config.whitelistOverrides as string[]) ?? [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load incubator config from ${configPath}: ${msg}`);
  }
}
