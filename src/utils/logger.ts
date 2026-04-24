/**
 * Logger — simple debug/info/warn/error logging.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

let _debugEnabled = false;
let _logDir = join(process.cwd(), '.kele-debug');

export function setDebug(enabled: boolean): void {
  _debugEnabled = enabled;
}

export function setLogDir(dir: string): void {
  _logDir = dir;
}

export function isDebug(): boolean {
  return _debugEnabled || process.env.KELE_DEBUG === '1' || process.env.DEBUG?.includes('kele') || false;
}

/**
 * Log a debug message. Only shown when debug mode is enabled.
 */
export function debugLog(label: string, content: string): void {
  if (!isDebug()) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[DEBUG] ${label}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(content);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!existsSync(_logDir)) {
    mkdirSync(_logDir, { recursive: true });
  }
  const filepath = join(_logDir, `${timestamp}_${safeLabel}.txt`);
  writeFileSync(filepath, `[${label}]\n\n${content}`, 'utf-8');
}

/**
 * Log an info message.
 */
export function info(message: string): void {
  console.log(`ℹ️  ${message}`);
}

/**
 * Log a warning.
 */
export function warn(message: string): void {
  console.log(`⚠️  ${message}`);
}

/**
 * Log an error.
 */
export function error(message: string): void {
  console.log(`❌ ${message}`);
}

/**
 * Log a success.
 */
export function success(message: string): void {
  console.log(`✅ ${message}`);
}
