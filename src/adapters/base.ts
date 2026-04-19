/**
 * AI Adapter Interface — unified API for all AI providers.
 */

export interface AIAdapter {
  /** Provider name */
  readonly name: string;

  /** Whether this provider is configured and available */
  isAvailable(): boolean;

  /** Execute a prompt and return the response text */
  execute(prompt: string): Promise<string>;
}

/**
 * Result of routing a task to an AI provider.
 */
import type { AIProvider } from '../types/index.js';

export interface RouteResult {
  provider: AIProvider;
  adapter: AIAdapter;
}
