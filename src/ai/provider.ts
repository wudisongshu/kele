/**
 * AI Provider Interface — unified API for all AI providers.
 */

export interface AIAdapter {
  /** Provider name */
  readonly name: string;

  /** Whether this provider is configured and available */
  isAvailable(): boolean;

  /**
   * Test if the API connection actually works.
   */
  testConnection(): Promise<{ ok: boolean; error?: string }>;

  /**
   * Execute a prompt and return the response text.
   * @param onToken - Optional callback fired for each token during streaming.
   *                  When provided, the adapter will use streaming mode if supported.
   */
  execute(prompt: string, onToken?: (token: string) => void): Promise<string>;

  /**
   * Get model info for display/logging.
   */
  getModelInfo?(): { name: string; maxTokens?: number };
}

/**
 * Result of routing a task to an AI provider.
 */
export interface RouteResult {
  provider: string;
  adapter: AIAdapter;
}
