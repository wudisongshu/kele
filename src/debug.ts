import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

let _debugEnabled = false;

export function setDebug(enabled: boolean): void {
  _debugEnabled = enabled;
}

export function isDebug(): boolean {
  if (_debugEnabled) return true;
  if (process.env.KELE_DEBUG === '1') return true;
  if (process.env.DEBUG?.includes('kele')) return true;
  return false;
}

/**
 * Log a debug message. In debug mode, prints to console AND saves to file.
 */
export function debugLog(label: string, content: string): void {
  if (!isDebug()) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Print to console
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[DEBUG] ${label}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(content);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Save to file
  const debugDir = join(homedir(), '.kele', 'debug');
  if (!existsSync(debugDir)) {
    mkdirSync(debugDir, { recursive: true });
  }

  const filename = `${timestamp}_${safeLabel}.txt`;
  const filepath = join(debugDir, filename);
  writeFileSync(filepath, `[${label}]\n\n${content}`, 'utf-8');
}
