/**
 * kele — Library entry point.
 *
 * Export core APIs for programmatic use.
 */

export { GameGenerator, type GenerateResult } from './core/generator.js';
export { GameValidator, type ValidationResult } from './core/validator.js';
export { WholeFileFixer, type FixResult } from './core/fixer.js';
export { ProviderRouter, createRouterFromConfig, createMockRouter } from './ai/router.js';
export type { AIAdapter, RouteResult } from './ai/provider.js';
export { MockAdapter } from './ai/providers/mock.js';
export { OpenAICompatibleAdapter } from './ai/providers/openai-compatible.js';
export { ProjectManager } from './project/manager.js';
export type { Project, ProjectCreateInput } from './project/types.js';
export { loadConfig, saveConfig, setProvider, getConfigSummary, hasAnyProvider } from './config/manager.js';
export type { KeleConfig, ProviderConfig } from './config/types.js';
