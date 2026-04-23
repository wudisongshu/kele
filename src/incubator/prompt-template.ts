/**
 * Prompt Template Engine — loads, renders, and caches markdown prompt templates.
 *
 * Supports:
 * - Variable substitution: {{varName}}
 * - Array auto-formatting: string[] → markdown list
 * - Partial inclusion: {{> partial-name}}
 * - File-based caching (production) or hot-reload (development)
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

export class PromptTemplate {
  private cache = new Map<string, string>();
  private partialCache = new Map<string, string>();
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir ?? join(__dirname, 'prompt-templates');
  }

  /**
   * Clear all cached templates (useful for testing hot-reload).
   */
  clearCache(): void {
    this.cache.clear();
    this.partialCache.clear();
  }

  /**
   * Load a template file by name.
   * Falls back to system-default.md if the requested template does not exist.
   */
  async load(templateName: string): Promise<string> {
    // Development mode: skip cache
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && this.cache.has(templateName)) {
      return this.cache.get(templateName)!;
    }

    const filePath = join(this.templatesDir, `system-${templateName}.md`);
    let content: string;

    if (existsSync(filePath)) {
      content = readFileSync(filePath, 'utf-8');
    } else {
      const fallbackPath = join(this.templatesDir, 'system-default.md');
      if (existsSync(fallbackPath)) {
        content = readFileSync(fallbackPath, 'utf-8');
        debugLog('PromptTemplate fallback', `Template "${templateName}" not found, using system-default.md`);
      } else {
        throw new Error(`PromptTemplate: neither "system-${templateName}.md" nor "system-default.md" found in ${this.templatesDir}`);
      }
    }

    // Resolve partials
    content = await this.resolvePartials(content);

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
   * Resolve {{> partial-name}} references by loading files from _partials/.
   */
  private async resolvePartials(content: string): Promise<string> {
    const partialPattern = /\{\{\>\s*([\w-]+)\s*\}\}/g;
    let match: RegExpExecArray | null;
    const replacements: { placeholder: string; value: string }[] = [];

    // Collect all unique partial references
    const seen = new Set<string>();
    while ((match = partialPattern.exec(content)) !== null) {
      const partialName = match[1];
      if (seen.has(partialName)) continue;
      seen.add(partialName);

      const partialPath = join(this.templatesDir, '_partials', `${partialName}.md`);
      let partialContent: string;
      if (existsSync(partialPath)) {
        partialContent = readFileSync(partialPath, 'utf-8');
      } else {
        partialContent = `<!-- partial "${partialName}" not found -->`;
        debugLog('PromptTemplate missing partial', `Partial "${partialName}" not found in _partials/`);
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
