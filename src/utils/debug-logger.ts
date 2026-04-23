/**
 * DebugLogger — full-chainage debug logging system for kele.
 *
 * Records all inputs, outputs, and intermediate states as JSON Lines
 * for post-mortem analysis. Each task/session gets its own .jsonl file.
 */

import { appendFile, mkdir, writeFile, readdir, unlink, symlink, lstat, stat } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import { randomBytes } from 'crypto';
import { isDebug } from '../debug.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LogEntry {
  ts: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  module: string;
  stage: 'input' | 'output' | 'intermediate' | 'error';
  taskId: string;
  step?: number;
  type: string;
  payload?: Record<string, unknown>;
  meta?: {
    model?: string;
    durationMs?: number;
    tokenUsage?: {
      prompt?: number;
      completion?: number;
      total?: number;
    };
    retryCount?: number;
    fileSize?: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitization
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = ['apiKey', 'api_key', 'token', 'secret', 'password', 'auth', 'authorization'];
const SENSITIVE_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{48,}/g,
  /[a-zA-Z0-9_-]*token[a-zA-Z0-9_-]*:?\s*['"]?[a-zA-Z0-9]{32,}/gi,
];

export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    let sanitized = obj;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        const prefix = match.slice(0, Math.min(8, match.length));
        return prefix + '***REDACTED***';
      });
    }
    return sanitized;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLog);
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
        result[key] = '***REDACTED***';
      } else {
        result[key] = sanitizeForLog(value);
      }
    }
    return result;
  }

  return obj;
}

// ─────────────────────────────────────────────────────────────────────────────
// DebugLogger
// ─────────────────────────────────────────────────────────────────────────────

export interface DebugLoggerOptions {
  enabled?: boolean;
  maxFiles?: number;
  bufferSize?: number;
  flushIntervalMs?: number;
}

export class DebugLogger {
  private logPath: string;
  private taskId: string;
  private enabled: boolean;
  private maxFiles: number;
  private buffer: LogEntry[] = [];
  private bufferSize: number;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private stepCounter = 0;
  private writePromise: Promise<void> = Promise.resolve();
  private closed = false;
  private entryCount = 0;
  private _ready: Promise<void>;

  constructor(
    projectRoot: string,
    taskId: string,
    options: DebugLoggerOptions = {},
  ) {
    this.taskId = taskId;
    this.enabled = options.enabled ?? isDebug();
    this.maxFiles = options.maxFiles ?? 20;
    this.bufferSize = options.bufferSize ?? 10;

    const sessionsDir = join(projectRoot, '.kele-logs', 'sessions');
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const shortId = randomBytes(4).toString('hex');
    this.logPath = join(sessionsDir, `${timestamp}-${shortId}.jsonl`);

    this._ready = this._init(projectRoot);
  }

  private async _init(projectRoot: string): Promise<void> {
    if (!this.enabled) return;

    // Ensure directories
    const sessionsDir = join(projectRoot, '.kele-logs', 'sessions');
    await mkdir(sessionsDir, { recursive: true });

    // Write header
    const header = {
      _header: true,
      version: '1.0',
      taskId: this.taskId,
      startTime: new Date().toISOString(),
      projectRoot,
    };
    await writeFile(this.logPath, JSON.stringify(sanitizeForLog(header)) + '\n', 'utf-8');
    this.entryCount = 1;

    // Update latest symlink
    await this._updateSymlink(projectRoot);

    // Cleanup old logs
    await this._cleanup(projectRoot);

    // Start flush timer
    const flushIntervalMs = 1000;
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => { /* ignore */ });
    }, flushIntervalMs);
  }

  private async _updateSymlink(projectRoot: string): Promise<void> {
    const latestPath = join(projectRoot, '.kele-logs', 'latest');
    try {
      // Remove existing symlink (works on both file and symlink)
      const stat = await lstat(latestPath).catch(() => null);
      if (stat) {
        await unlink(latestPath);
      }
    } catch { /* ignore */ }
    try {
      // Create relative symlink
      const relativeTarget = join('sessions', basename(this.logPath));
      await symlink(relativeTarget, latestPath);
    } catch { /* ignore */ }
  }

  private async _cleanup(projectRoot: string): Promise<void> {
    try {
      const sessionsDir = join(projectRoot, '.kele-logs', 'sessions');
      if (!existsSync(sessionsDir)) return;
      const files = await readdir(sessionsDir);
      const jsonlFiles = await Promise.all(
        files
          .filter((f) => f.endsWith('.jsonl'))
          .map(async (f) => {
            const path = join(sessionsDir, f);
            const s = await stat(path);
            return { name: f, path, mtime: s.mtimeMs };
          }),
      );
      jsonlFiles.sort((a, b) => a.mtime - b.mtime);

      if (jsonlFiles.length > this.maxFiles) {
        const toDelete = jsonlFiles.slice(0, jsonlFiles.length - this.maxFiles);
        for (const f of toDelete) {
          try { await unlink(f.path); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore cleanup errors */ }
  }

  /**
   * Record a single log entry.
   */
  async log(entry: Omit<LogEntry, 'ts' | 'taskId'>): Promise<void> {
    try { await this._ready; } catch { /* ignore init errors */ }
    if (!this.enabled || this.closed) return;

    const fullEntry: LogEntry = {
      ts: new Date().toISOString(),
      taskId: this.taskId,
      ...entry,
    };

    this.buffer.push(fullEntry);

    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Flush buffered entries to disk.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const entries = this.buffer.splice(0, this.buffer.length);
    const lines = entries.map((e) => JSON.stringify(sanitizeForLog(e)) + '\n').join('');

    this.writePromise = this.writePromise.then(async () => {
      try {
        await appendFile(this.logPath, lines, 'utf-8');
        this.entryCount += entries.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error(`[DebugLogger] Failed to write log: ${msg}`);
      }
    });

    await this.writePromise;
  }

  // ─── Convenience methods ───

  async logInput(module: string, type: string, payload: Record<string, unknown>, meta?: LogEntry['meta']): Promise<void> {
    await this.log({ level: 'INFO', module, stage: 'input', type, payload, meta });
  }

  async logOutput(module: string, type: string, payload: Record<string, unknown>, meta?: LogEntry['meta']): Promise<void> {
    await this.log({ level: 'INFO', module, stage: 'output', type, payload, meta });
  }

  async logIntermediate(module: string, type: string, payload: Record<string, unknown>, step?: number): Promise<void> {
    if (step !== undefined) this.stepCounter = step;
    await this.log({ level: 'DEBUG', module, stage: 'intermediate', type, payload, step: step ?? this.stepCounter });
  }

  async logWarn(module: string, type: string, payload: Record<string, unknown>): Promise<void> {
    await this.log({ level: 'WARN', module, stage: 'intermediate', type, payload });
  }

  async logError(module: string, error: Error, context?: Record<string, unknown>): Promise<void> {
    await this.log({
      level: 'ERROR',
      module,
      stage: 'error',
      type: 'error',
      payload: {
        message: error.message,
        stack: error.stack,
        ...context,
      },
    });
  }

  async logAIRequest(prompt: { system?: string; user?: string }, config: Record<string, unknown>): Promise<void> {
    await this.logInput('ai-request', 'ai.prompt', { prompt, config });
  }

  async logAIResponse(response: string | object, _durationMs: number, meta?: LogEntry['meta']): Promise<void> {
    await this.logOutput('ai-request', 'ai.response', { response }, meta);
  }

  /**
   * Finalize the session — flush and write footer.
   */
  async finalize(status: 'success' | 'failed' | 'aborted', summary?: Record<string, unknown>): Promise<void> {
    if (!this.enabled || this.closed) return;
    this.closed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();

    const footer = {
      _footer: true,
      status,
      endTime: new Date().toISOString(),
      totalEntries: this.entryCount,
      summary,
    };

    try {
      await appendFile(this.logPath, JSON.stringify(sanitizeForLog(footer)) + '\n', 'utf-8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(`[DebugLogger] Failed to write footer: ${msg}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Global instance helpers
// ─────────────────────────────────────────────────────────────────────────────

let _globalLogger: DebugLogger | null = null;

export function setGlobalDebugLogger(logger: DebugLogger | null): void {
  _globalLogger = logger;
}

export function getGlobalDebugLogger(): DebugLogger | null {
  return _globalLogger;
}

export async function withDebugLogger<T>(
  projectRoot: string,
  taskId: string,
  fn: (logger: DebugLogger) => Promise<T>,
  options?: DebugLoggerOptions,
): Promise<T> {
  const logger = new DebugLogger(projectRoot, taskId, options);
  setGlobalDebugLogger(logger);
  try {
    const result = await fn(logger);
    await logger.finalize('success');
    return result;
  } catch (err) {
    await logger.logError('task', err instanceof Error ? err : new Error(String(err)));
    await logger.finalize('failed');
    throw err;
  }
}
