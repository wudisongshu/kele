/**
 * Persistent structured logging for kele.
 * Saves console output to ~/.kele/logs/ for post-mortem analysis.
 */

import { appendFileSync, mkdirSync, existsSync, statSync, renameSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_DIR = join(homedir(), '.kele', 'logs');

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFileName(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  return join(LOG_DIR, `kele-${date}.log`);
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
  } catch {
    // Ignore rotation errors
  }
}

/**
 * Write a structured log entry.
 */
export function logEvent(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
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
    jsonOutput,
  };
}

/**
 * Print the final JSON output and exit.
 */
export function printJsonOutput(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
