/**
 * Prompt Template Engine — loads, renders, and caches markdown prompt templates.
 *
 * Supports:
 * - Variable substitution: {{varName}}
 * - Array auto-formatting: string[] → markdown list
 * - Partial inclusion: {{> partial-name}}
 * - File-based caching (production) or hot-reload (development)
 * - Multi-path lookup: .kele/templates → src/incubator/prompt-templates → global install → cwd/templates
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { debugLog } from '../debug.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TemplateVars {
  [key: string]: string | string[] | number | undefined;
}

export class TemplateNotFoundError extends Error {
  readonly templateName: string;
  readonly searchedPaths: string[];

  constructor(templateName: string, searchedPaths: string[]) {
    const pathsStr = searchedPaths.join(', ');
    super(`TemplateNotFoundError: system-${templateName}.md not found in [${pathsStr}]`);
    this.templateName = templateName;
    this.searchedPaths = searchedPaths;
    this.name = 'TemplateNotFoundError';
  }
}

/**
 * Resolve the list of template directories to search, in priority order:
 * 1. .kele/templates/ in current working directory
 * 2. src/incubator/prompt-templates/ relative to project root (source dev mode)
 * 3. dist/incubator/prompt-templates/ or global install templates/
 * 4. templates/ in current working directory
 */
function resolveTemplateSearchPaths(): string[] {
  const paths: string[] = [];

  // 1. Project-local override: .kele/templates/
  paths.push(join(process.cwd(), '.kele', 'templates'));

  // 2. Source directory (when running from TypeScript source / vitest)
  // __dirname is either src/incubator/ (ts-node/esm) or dist/incubator/ (compiled)
  // Try walking up to find the project root, then look in src/incubator/prompt-templates
  const srcDir = join(__dirname, '..', '..', 'src', 'incubator', 'prompt-templates');
  if (existsSync(srcDir)) {
    paths.push(srcDir);
  }

  // 3. Adjacent to this file (dist/incubator/prompt-templates when compiled)
  paths.push(join(__dirname, 'prompt-templates'));

  // 4. Current working directory templates/
  paths.push(join(process.cwd(), 'templates'));

  return paths;
}

export class PromptTemplate {
  private cache = new Map<string, string>();
  private partialCache = new Map<string, string>();
  private searchPaths: string[];

  constructor(searchPaths?: string[]) {
    this.searchPaths = searchPaths ?? resolveTemplateSearchPaths();
  }

  /**
   * Clear all cached templates (useful for testing hot-reload).
   */
  clearCache(): void {
    this.cache.clear();
    this.partialCache.clear();
  }

  /**
   * Find the first existing file among search paths.
   */
  private findFile(fileName: string): { path: string; dir: string } | null {
    for (const dir of this.searchPaths) {
      const filePath = join(dir, fileName);
      if (existsSync(filePath)) {
        return { path: filePath, dir };
      }
    }
    return null;
  }

  /**
   * Load a template file by name.
   * Searches across all configured template directories.
   * Falls back to system-default.md in the SAME directory where the primary template was expected.
   */
  async load(templateName: string): Promise<string> {
    // Development mode: skip cache
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && this.cache.has(templateName)) {
      return this.cache.get(templateName)!;
    }

    const primaryFile = `system-${templateName}.md`;
    const fallbackFile = 'system-default.md';

    // Try primary template in each search path
    let found = this.findFile(primaryFile);
    let usedFallback = false;

    if (!found) {
      // Try fallback in each search path
      found = this.findFile(fallbackFile);
      usedFallback = true;
    }

    if (!found) {
      throw new TemplateNotFoundError(templateName, this.searchPaths);
    }

    if (usedFallback) {
      debugLog('PromptTemplate fallback', `Template "${templateName}" not found, using system-default.md from ${found.dir}`);
    }

    let content = readFileSync(found.path, 'utf-8');

    // Resolve partials relative to the directory where the template was found
    content = await this.resolvePartials(content, found.dir);

    if (!isDev) {
      this.cache.set(templateName, content);
    }
    return content;
  }

  /**
   * Render a template by replacing {{var}} variables.
   * If a variable value is a string array, it is auto-formatted as a markdown list.
   * Missing variables are left as-is and a warning is logged.
   */
  render(template: string, vars: TemplateVars): string {
    return template.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_match, key) => {
      const value = vars[key];
      if (value === undefined) {
        debugLog('PromptTemplate missing var', `Variable "${key}" not provided, leaving placeholder`);
        return `{{${key}}}`;
      }
      if (Array.isArray(value)) {
        return value.map((v) => `- ${v}`).join('\n');
      }
      return String(value);
    });
  }

  /**
   * Convenience method: load + render in one call.
   */
  async getSystemMessage(templateName: string, vars: TemplateVars): Promise<string> {
    const template = await this.load(templateName);
    return this.render(template, vars);
  }

  /**
   * Resolve {{> partial-name}} references by loading files from _partials/
   * relative to the template directory.
   */
  private async resolvePartials(content: string, templateDir: string): Promise<string> {
    const partialPattern = /\{\{\>\s*([\w-]+)\s*\}\}/g;
    let match: RegExpExecArray | null;
    const replacements: { placeholder: string; value: string }[] = [];

    // Collect all unique partial references
    const seen = new Set<string>();
    while ((match = partialPattern.exec(content)) !== null) {
      const partialName = match[1];
      if (seen.has(partialName)) continue;
      seen.add(partialName);

      const partialPath = join(templateDir, '_partials', `${partialName}.md`);
      let partialContent: string;
      if (existsSync(partialPath)) {
        partialContent = readFileSync(partialPath, 'utf-8');
      } else {
        partialContent = `<!-- partial "${partialName}" not found -->`;
        debugLog('PromptTemplate missing partial', `Partial "${partialName}" not found in ${join(templateDir, '_partials')}`);
      }
      replacements.push({ placeholder: match[0], value: partialContent });
    }

    // Apply replacements
    for (const r of replacements) {
      content = content.split(r.placeholder).join(r.value);
    }

    return content;
  }
}
