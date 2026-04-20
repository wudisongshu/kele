/**
 * Telemetry — lightweight error/success tracking for kele.
 * Saves structured events to ~/.kele/telemetry.jsonl for post-mortem analysis.
 */

import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const TELEMETRY_DIR = join(homedir(), '.kele');
const TELEMETRY_FILE = join(TELEMETRY_DIR, 'telemetry.jsonl');

function ensureDir(): void {
  if (!existsSync(TELEMETRY_DIR)) {
    mkdirSync(TELEMETRY_DIR, { recursive: true });
  }
}

export interface TelemetryEvent {
  timestamp: string;
  event: 'project_start' | 'project_complete' | 'project_fail' | 'task_complete' | 'task_fail' | 'api_call' | 'api_error' | 'validation_pass' | 'validation_fail';
  projectId?: string;
  projectName?: string;
  taskId?: string;
  provider?: string;
  durationMs?: number;
  error?: string;
  score?: number;
  meta?: Record<string, unknown>;
}

export function trackEvent(event: TelemetryEvent): void {
  ensureDir();
  appendFileSync(TELEMETRY_FILE, JSON.stringify(event) + '\n', 'utf-8');
}

export function trackProjectStart(projectId: string, projectName: string, ideaType: string): void {
  trackEvent({
    timestamp: new Date().toISOString(),
    event: 'project_start',
    projectId,
    projectName,
    meta: { ideaType },
  });
}

export function trackProjectComplete(projectId: string, projectName: string, completed: number, failed: number, durationMs: number, avgScore?: number): void {
  trackEvent({
    timestamp: new Date().toISOString(),
    event: failed === 0 ? 'project_complete' : 'project_fail',
    projectId,
    projectName,
    durationMs,
    score: avgScore,
    meta: { completed, failed, avgScore },
  });
}

export function trackTaskComplete(projectId: string, taskId: string, provider: string, durationMs: number): void {
  trackEvent({
    timestamp: new Date().toISOString(),
    event: 'task_complete',
    projectId,
    taskId,
    provider,
    durationMs,
  });
}

export function trackTaskFail(projectId: string, taskId: string, provider: string, error: string, durationMs: number): void {
  trackEvent({
    timestamp: new Date().toISOString(),
    event: 'task_fail',
    projectId,
    taskId,
    provider,
    error,
    durationMs,
  });
}

export function trackApiError(provider: string, error: string, promptLength?: number): void {
  trackEvent({
    timestamp: new Date().toISOString(),
    event: 'api_error',
    provider,
    error,
    meta: { promptLength },
  });
}

export function trackValidation(projectId: string, taskId: string, passed: boolean, score: number, errors?: string[]): void {
  trackEvent({
    timestamp: new Date().toISOString(),
    event: passed ? 'validation_pass' : 'validation_fail',
    projectId,
    taskId,
    score,
    meta: { errors },
  });
}
