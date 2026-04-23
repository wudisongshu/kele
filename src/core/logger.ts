/**
 * Persistent structured logging for kele.
 * Saves console output to ./.kele-logs/ (project directory) for post-mortem analysis.
 */

import { appendFileSync, mkdirSync, existsSync, statSync, renameSync } from 'fs';
import { join } from 'path';
import { debugLog } from '../debug.js';

let _logDir = join(process.cwd(), '.kele-logs');

export function setLogDir(dir: string): void {
  _logDir = dir;
}

export function getLogDir(): string {
  return _logDir;
}

function ensureLogDir(): void {
  if (!existsSync(_logDir)) {
    mkdirSync(_logDir, { recursive: true });
  }
}

function getLogFileName(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  return join(_logDir, `kele-${date}.log`);
}

const MAX_LOG_SIZE_MB = 10;

function rotateLogIfNeeded(filePath: string): void {
  if (!existsSync(filePath)) return;
  try {
    const stats = statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB >= MAX_LOG_SIZE_MB) {
      const rotated = filePath.replace('.log', `.${Date.now()}.log`);
      renameSync(filePath, rotated);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`Logger rotation failed: ${filePath}`, msg);
    // Ignore rotation errors
  }
}

/**
 * Write a structured log entry.
 */
export function logEvent(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: Record<string, unknown>): void {
  ensureLogDir();
  const filePath = getLogFileName();
  rotateLogIfNeeded(filePath);
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
}

/**
 * Create a progress logger that writes to both console and log file.
 * When jsonMode is true, outputs structured JSON instead of human-readable text.
 */
export function createProgressLogger(jsonMode: boolean = false): {
  log: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  jsonOutput: unknown[];
} {
  const jsonOutput: unknown[] = [];

  if (jsonMode) {
    return {
      log: (msg: string, meta?: Record<string, unknown>) => {
        const entry = { type: 'progress', message: msg, ...meta };
        jsonOutput.push(entry);
        logEvent('info', msg, meta);
      },
      warn: (msg: string, meta?: Record<string, unknown>) => {
        const entry = { type: 'warn', message: msg, ...meta };
        jsonOutput.push(entry);
        logEvent('warn', msg, meta);
      },
      error: (msg: string, meta?: Record<string, unknown>) => {
        const entry = { type: 'error', message: msg, ...meta };
        jsonOutput.push(entry);
        logEvent('error', msg, meta);
      },
      debug: (msg: string, meta?: Record<string, unknown>) => {
        const entry = { type: 'debug', message: msg, ...meta };
        jsonOutput.push(entry);
        logEvent('debug', msg, meta);
      },
      jsonOutput,
    };
  }

  return {
    log: (msg: string, meta?: Record<string, unknown>) => {
      console.log(msg);
      logEvent('info', msg, meta);
    },
    warn: (msg: string, meta?: Record<string, unknown>) => {
      console.warn(msg);
      logEvent('warn', msg, meta);
    },
    error: (msg: string, meta?: Record<string, unknown>) => {
      console.error(msg);
      logEvent('error', msg, meta);
    },
    debug: (msg: string, meta?: Record<string, unknown>) => {
      // Debug messages only go to log file, not console
      logEvent('debug', msg, meta);
    },
    jsonOutput,
  };
}

/**
 * Print the final JSON output and exit.
 */
export function printJsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
