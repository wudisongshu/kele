import { describe, it, expect, vi } from 'vitest';
import { batchUpgrade } from '../src/core/upgrade-engine.js';
import type { AIAdapter } from '../src/adapters/base.js';

function createMockAdapter(): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    execute: vi.fn().mockResolvedValue(JSON.stringify({
      files: [{ path: 'test.js', content: 'console.log("upgraded")' }],
      notes: 'upgrade complete',
    })),
  } as AIAdapter;
}

function createMockRegistry(adapter: AIAdapter) {
  return {
    route: vi.fn().mockReturnValue({ provider: 'mock', adapter }),
    listAvailable: vi.fn().mockReturnValue(['mock']),
    get: vi.fn().mockReturnValue(adapter),
  };
}

function createMockDb() {
  return {
    saveTask: vi.fn(),
    saveProject: vi.fn(),
    saveSubProject: vi.fn(),
    getProject: vi.fn(),
    listProjects: vi.fn().mockReturnValue([]),
  };
}

function createMockTask(id: string, spId: string): any {
  return {
    id,
    subProjectId: spId,
    title: `Task ${id}`,
    description: 'A test task',
    complexity: 'medium',
    status: 'completed',
    version: 1,
    createdAt: new Date().toISOString(),
  };
}

function createMockSubProject(id: string): any {
  return {
    id,
    name: `SP ${id}`,
    description: 'A test sub-project',
    type: 'development',
    targetDir: '/tmp/nonexistent-upgrade-test',
    dependencies: [],
    status: 'completed',
    createdAt: new Date().toISOString(),
  };
}

function createMockProject(): any {
  return {
    id: 'proj-1',
    name: 'Test Project',
    idea: {
      id: 'idea-1',
      rawText: '做一个测试工具',
      type: 'tool',
      monetization: 'web',
      complexity: 'medium',
      keywords: [],
      createdAt: new Date().toISOString(),
    },
    subProjects: [],
    tasks: [],
    status: 'completed',
    rootDir: '/tmp/test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('upgrade-engine', () => {
  describe('batchUpgrade', () => {
    it('upgrades all tasks successfully', async () => {
      const adapter = createMockAdapter();
      const registry = createMockRegistry(adapter);
      const db = createMockDb();
      const project = createMockProject();
      const tasks = [
        createMockTask('task-1', 'sp-1'),
        createMockTask('task-2', 'sp-1'),
      ];
      const subProjects = [createMockSubProject('sp-1')];

      const result = await batchUpgrade(tasks, subProjects, project, 'change colors', {
        registry: registry as any,
        db: db as any,
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('counts missing sub-project as failure', async () => {
      const adapter = createMockAdapter();
      const registry = createMockRegistry(adapter);
      const db = createMockDb();
      const project = createMockProject();
      const tasks = [createMockTask('task-1', 'sp-missing')];
      const subProjects = [createMockSubProject('sp-1')];

      const result = await batchUpgrade(tasks, subProjects, project, 'change colors', {
        registry: registry as any,
        db: db as any,
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('handles empty task list', async () => {
      const adapter = createMockAdapter();
      const registry = createMockRegistry(adapter);
      const db = createMockDb();
      const project = createMockProject();

      const result = await batchUpgrade([], [], project, 'change colors', {
        registry: registry as any,
        db: db as any,
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});
