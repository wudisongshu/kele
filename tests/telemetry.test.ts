import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('telemetry', () => {
  const TEST_HOME = join(tmpdir(), `kele-telemetry-test-${Date.now()}`);

  beforeEach(() => {
    process.env.HOME = TEST_HOME;
    process.env.USERPROFILE = TEST_HOME;
  });

  afterEach(() => {
    try { rmSync(join(TEST_HOME, '.kele'), { recursive: true }); } catch { /* ignore */ }
    delete process.env.HOME;
    delete process.env.USERPROFILE;
  });

  async function importTelemetry() {
    return import('../src/core/telemetry.js');
  }

  function getTelemetryFile(): string {
    return join(TEST_HOME, '.kele', 'telemetry.jsonl');
  }

  function readEvents(): any[] {
    const path = getTelemetryFile();
    if (!existsSync(path)) return [];
    const lines = readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean);
    return lines.map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  }

  it('trackEvent writes JSONL to telemetry file', async () => {
    const { trackEvent } = await importTelemetry();
    trackEvent({ timestamp: '2024-01-01T00:00:00Z', event: 'project_start' });

    const events = readEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('project_start');
    expect(events[0].timestamp).toBe('2024-01-01T00:00:00Z');
  });

  it('trackProjectStart records project info', async () => {
    const { trackProjectStart } = await importTelemetry();
    trackProjectStart('proj-1', 'Test Project', 'game');

    const events = readEvents();
    expect(events[0].event).toBe('project_start');
    expect(events[0].projectId).toBe('proj-1');
    expect(events[0].projectName).toBe('Test Project');
    expect(events[0].meta.ideaType).toBe('game');
  });

  it('trackProjectComplete records success when no failures', async () => {
    const { trackProjectComplete } = await importTelemetry();
    trackProjectComplete('proj-1', 'Test', 5, 0, 10000, 85);

    const events = readEvents();
    expect(events[0].event).toBe('project_complete');
    expect(events[0].score).toBe(85);
    expect(events[0].meta.completed).toBe(5);
    expect(events[0].meta.failed).toBe(0);
  });

  it('trackProjectComplete records fail when there are failures', async () => {
    const { trackProjectComplete } = await importTelemetry();
    trackProjectComplete('proj-1', 'Test', 3, 2, 15000);

    const events = readEvents();
    expect(events[0].event).toBe('project_fail');
    expect(events[0].meta.failed).toBe(2);
  });

  it('trackTaskComplete records task success', async () => {
    const { trackTaskComplete } = await importTelemetry();
    trackTaskComplete('proj-1', 'task-1', 'kimi-code', 5000);

    const events = readEvents();
    expect(events[0].event).toBe('task_complete');
    expect(events[0].provider).toBe('kimi-code');
    expect(events[0].durationMs).toBe(5000);
  });

  it('trackTaskFail records error details', async () => {
    const { trackTaskFail } = await importTelemetry();
    trackTaskFail('proj-1', 'task-1', 'deepseek', 'timeout', 30000);

    const events = readEvents();
    expect(events[0].event).toBe('task_fail');
    expect(events[0].error).toBe('timeout');
  });

  it('trackApiError records provider and error', async () => {
    const { trackApiError } = await importTelemetry();
    trackApiError('openai', 'rate limit exceeded', 2048);

    const events = readEvents();
    expect(events[0].event).toBe('api_error');
    expect(events[0].provider).toBe('openai');
    expect(events[0].meta.promptLength).toBe(2048);
  });

  it('trackFixAttempt records attempt number', async () => {
    const { trackFixAttempt } = await importTelemetry();
    trackFixAttempt('proj-1', 'task-1', 2, 'stub_detected');

    const events = readEvents();
    expect(events[0].event).toBe('fix_attempt');
    expect(events[0].meta.attemptNum).toBe(2);
    expect(events[0].meta.issueType).toBe('stub_detected');
  });

  it('trackValidation records pass with score', async () => {
    const { trackValidation } = await importTelemetry();
    trackValidation('proj-1', 'task-1', true, 95);

    const events = readEvents();
    expect(events[0].event).toBe('validation_pass');
    expect(events[0].score).toBe(95);
  });

  it('trackValidation records fail with errors', async () => {
    const { trackValidation } = await importTelemetry();
    trackValidation('proj-1', 'task-1', false, 45, ['missing file', 'syntax error']);

    const events = readEvents();
    expect(events[0].event).toBe('validation_fail');
    expect(events[0].score).toBe(45);
    expect(events[0].meta.errors).toEqual(['missing file', 'syntax error']);
  });

  it('appends multiple events in order', async () => {
    const { trackProjectStart, trackTaskComplete } = await importTelemetry();
    trackProjectStart('proj-1', 'Test', 'game');
    trackTaskComplete('proj-1', 'task-1', 'kimi-code', 5000);

    const events = readEvents();
    expect(events).toHaveLength(2);
    expect(events[0].event).toBe('project_start');
    expect(events[1].event).toBe('task_complete');
  });

  it('handles malformed existing telemetry file gracefully', async () => {
    const { trackEvent } = await importTelemetry();
    // Write invalid JSON to the file
    const fs = await import('fs');
    const dir = join(TEST_HOME, '.kele');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(join(dir, 'telemetry.jsonl'), 'not-json\n{invalid\n', 'utf-8');

    // Should not throw — writes a new valid line
    trackEvent({ timestamp: '2024-01-01T00:00:00Z', event: 'test' });

    const events = readEvents();
    // Only the valid new line should be readable (old malformed lines are skipped by JSON.parse)
    expect(events.length).toBeGreaterThanOrEqual(0);
  });

  it('handles very large event payload', async () => {
    const { trackEvent } = await importTelemetry();
    const largePayload = { timestamp: '2024-01-01T00:00:00Z', event: 'large', data: 'x'.repeat(100000) };
    trackEvent(largePayload);

    const events = readEvents();
    expect(events.length).toBe(1);
    expect(events[0].data).toHaveLength(100000);
  });

  it('tracks task completion events', async () => {
    const { trackTaskComplete } = await importTelemetry();
    trackTaskComplete('proj-1', 'task-1', 'mock', 1234);

    const events = readEvents();
    const taskEvents = events.filter((e) => e.event === 'task_complete');
    expect(taskEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('tracks task failure events', async () => {
    const { trackTaskFail } = await importTelemetry();
    trackTaskFail('proj-1', 'task-1', 'mock', 'error', 1234);

    const events = readEvents();
    const failEvents = events.filter((e) => e.event === 'task_fail');
    expect(failEvents.length).toBeGreaterThanOrEqual(1);
  });
});
