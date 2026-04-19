import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type TemplateType = 'game-web' | 'web-scaffold' | 'wechat-miniprogram' | 'douyin-game' | 'generic';

/**
 * Map monetization channel to template type.
 */
export function getTemplateType(monetization: string): TemplateType {
  switch (monetization) {
    case 'wechat-miniprogram':
      return 'wechat-miniprogram';
    case 'douyin':
      return 'douyin-game';
    case 'web':
    case 'unknown':
    default:
      return 'game-web';
  }
}

interface TemplateFile {
  path: string;
  content: string;
}

/**
 * Recursively read all files from a template directory.
 */
function readTemplateFiles(templateDir: string): TemplateFile[] {
  const files: TemplateFile[] = [];

  function walk(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const relPath = relative(templateDir, fullPath);
        files.push({
          path: relPath,
          content: readFileSync(fullPath, 'utf-8'),
        });
      }
    }
  }

  walk(templateDir);
  return files;
}

/**
 * Load template files for a given template type.
 */
export function loadTemplate(type: TemplateType): TemplateFile[] {
  const templateDir = join(__dirname, '../../templates', type);

  if (!existsSync(templateDir)) {
    return [];
  }

  return readTemplateFiles(templateDir);
}

/**
 * Copy template files to target directory.
 */
export function copyTemplate(type: TemplateType, targetDir: string): string[] {
  const files = loadTemplate(type);
  const written: string[] = [];

  for (const file of files) {
    const destPath = join(targetDir, file.path);
    const destDir = dirname(destPath);

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    writeFileSync(destPath, file.content, 'utf-8');
    written.push(file.path);
  }

  return written;
}

/**
 * Get template description for AI prompt context.
 */
export function getTemplateDescription(type: TemplateType): string {
  switch (type) {
    case 'wechat-miniprogram':
      return 'WeChat Mini Program game template (game.json + Canvas API)';
    case 'douyin-game':
      return 'Douyin Mini Game template (game.json + tt.createCanvas API)';
    case 'game-web':
      return 'HTML5 Canvas game template (index.html + canvas.js)';
    case 'web-scaffold':
      return 'Standard Web Project (package.json + Vite + index.html)';
    default:
      return 'Generic web project template';
  }
}
