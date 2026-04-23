import { describe, it, expect, vi } from 'vitest';
import { reviewProjectHealth, adjustProjectScope } from '../src/core/project-reviewer.js';
import type { AIAdapter } from '../src/adapters/base.js';

function createMockAdapter(responseJson: object): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    execute: vi.fn().mockResolvedValue(JSON.stringify(responseJson)),
  } as AIAdapter;
}

function createFailingAdapter(): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    execute: vi.fn().mockRejectedValue(new Error('API error')),
  } as AIAdapter;
}

function createMockProject(): any {
  return {
    id: 'proj-1',
    name: 'Test Project',
    idea: {
      id: 'idea-1',
      rawText: '做一个测试游戏',
      type: 'game',
      monetization: 'web',
      complexity: 'medium',
      keywords: [],
      createdAt: new Date().toISOString(),
    },
    subProjects: [
      { id: 'sp-1', name: 'Setup', description: '', type: 'setup', targetDir: '/tmp/test', dependencies: [], status: 'completed', createdAt: new Date().toISOString() },
      { id: 'sp-2', name: 'Core', description: '', type: 'development', targetDir: '/tmp/test2', dependencies: ['sp-1'], status: 'pending', createdAt: new Date().toISOString() },
    ],
    tasks: [
      { id: 't1', subProjectId: 'sp-1', title: 'Init', description: '', complexity: 'simple', status: 'completed', version: 1, createdAt: new Date().toISOString() },
      { id: 't2', subProjectId: 'sp-2', title: 'Build', description: '', complexity: 'medium', status: 'pending', version: 1, createdAt: new Date().toISOString() },
    ],
    status: 'in_progress',
    rootDir: '/tmp/test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('project-reviewer', () => {
  describe('reviewProjectHealth', () => {
    it('parses healthy project response', async () => {
      const adapter = createMockAdapter({
        healthy: true,
        progress: 'on-track',
        concerns: [],
        recommendations: ['Keep going'],
      });
      const project = createMockProject();
      const result = await reviewProjectHealth(project, adapter);

      expect(result.healthy).toBe(true);
      expect(result.progress).toBe('on-track');
      expect(result.concerns).toHaveLength(0);
      expect(result.recommendations).toContain('Keep going');
    });

    it('parses behind-schedule project', async () => {
      const adapter = createMockAdapter({
        healthy: false,
        progress: 'behind',
        concerns: ['Missing core feature'],
        recommendations: ['Add feature X'],
        scopeAdjustment: 'Cut optional features',
      });
      const project = createMockProject();
      const result = await reviewProjectHealth(project, adapter);

      expect(result.healthy).toBe(false);
      expect(result.progress).toBe('behind');
      expect(result.scopeAdjustment).toBe('Cut optional features');
    });

    it('normalizes progress variants', async () => {
      const adapter = createMockAdapter({
        healthy: true,
        progress: 'ahead-of-schedule',
        concerns: [],
        recommendations: [],
      });
      const project = createMockProject();
      const result = await reviewProjectHealth(project, adapter);
      expect(result.progress).toBe('ahead');
    });

    it('falls back to defaults on parse error', async () => {
      const adapter: AIAdapter = {
        name: 'mock',
        isAvailable: () => true,
        execute: vi.fn().mockResolvedValue('not json at all'),
      } as AIAdapter;
      const project = createMockProject();
      const result = await reviewProjectHealth(project, adapter);

      expect(result.healthy).toBe(true);
      expect(result.progress).toBe('on-track');
      expect(result.concerns.length).toBeGreaterThan(0);
    });

    it('falls back to defaults on API error', async () => {
      const adapter = createFailingAdapter();
      const project = createMockProject();
      const result = await reviewProjectHealth(project, adapter);

      expect(result.healthy).toBe(true);
      expect(result.progress).toBe('on-track');
      expect(result.concerns[0]).toContain('API error');
    });

    it('handles project with failed tasks', async () => {
      const adapter = createMockAdapter({
        healthy: false,
        progress: 'behind',
        concerns: ['Task failed'],
        recommendations: ['Retry failed task'],
      });
      const project = createMockProject();
      project.tasks[0].status = 'failed';
      project.tasks[0].title = 'Failed Task';
      const result = await reviewProjectHealth(project, adapter);

      expect(result.healthy).toBe(false);
    });
  });

  describe('adjustProjectScope', () => {
    it('returns project unchanged when healthy and on-track', () => {
      const project = createMockProject();
      const health = { healthy: true, progress: 'on-track', concerns: [], recommendations: [] };
      const adjusted = adjustProjectScope(project, health);
      expect(adjusted).toBe(project);
      const pendingCount = adjusted.tasks.filter((t: any) => t.status === 'pending').length;
      expect(pendingCount).toBe(1); // t2 is pending in mock
    });

    it('marks optional tasks as skipped when behind', () => {
      const project = createMockProject();
      project.subProjects[1].monetizationRelevance = 'optional';
      // Make both tasks pending so we can test the skip logic
      project.tasks[0].status = 'pending';
      project.tasks[1].status = 'pending';

      const health = { healthy: false, progress: 'behind', concerns: [], recommendations: [] };
      const adjusted = adjustProjectScope(project, health);

      // In-place mutation: same object returned
      expect(adjusted).toBe(project);
      // The optional task should be marked as skipped
      const optionalTask = adjusted.tasks.find((t: any) => t.subProjectId === project.subProjects[1].id);
      expect(optionalTask?.status).toBe('skipped');
      // Non-optional tasks remain pending
      const nonOptionalTask = adjusted.tasks.find((t: any) => t.subProjectId === project.subProjects[0].id);
      expect(nonOptionalTask?.status).toBe('pending');
    });

    it('does not skip tasks when project is healthy', () => {
      const project = createMockProject();
      project.subProjects[1].monetizationRelevance = 'optional';
      project.tasks[0].status = 'pending';
      project.tasks[1].status = 'pending';

      const health = { healthy: true, progress: 'on-track', concerns: [], recommendations: [] };
      const adjusted = adjustProjectScope(project, health);

      const optionalTask = adjusted.tasks.find((t: any) => t.subProjectId === project.subProjects[1].id);
      expect(optionalTask?.status).toBe('pending');
    });
  });
});
