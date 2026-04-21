import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

let _debugEnabled = false;
const _timers = new Map<string, number>();
const _counters = new Map<string, number>();

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

/**
 * Start a debug timer.
 */
export function debugTimerStart(label: string): void {
  if (!isDebug()) return;
  _timers.set(label, Date.now());
}

/**
 * End a debug timer and log the duration.
 */
export function debugTimerEnd(label: string): void {
  if (!isDebug()) return;
  const start = _timers.get(label);
  if (!start) return;
  const duration = Date.now() - start;
  _timers.delete(label);
  debugLog(`${label} duration`, `${duration}ms`);
}

/**
 * Increment a debug counter.
 */
export function debugCounter(label: string): void {
  if (!isDebug()) return;
  const count = (_counters.get(label) || 0) + 1;
  _counters.set(label, count);
}

/**
 * Get and reset a debug counter.
 */
export function debugCounterGet(label: string): number {
  const count = _counters.get(label) || 0;
  _counters.delete(label);
  return count;
}
