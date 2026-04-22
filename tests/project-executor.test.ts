import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeProjectWithStats, executeProject } from '../src/core/project-executor.js';

// Mock executeTask from executor module
vi.mock('../src/core/executor.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/core/executor.js')>();
  return {
    ...mod,
    executeTask: vi.fn().mockResolvedValue({ success: true, output: 'done' }),
  };
});

vi.mock('../src/core/project-reviewer.js', () => ({
  reviewProjectHealth: vi.fn().mockResolvedValue({
    healthy: true,
    progress: 'on-track',
    concerns: [],
    recommendations: [],
  }),
}));

function createMockProject(): any {
  return {
    id: 'proj-1',
    name: 'Test Project',
    idea: {
      id: 'idea-1',
      rawText: '做一个测试',
      type: 'tool',
      monetization: 'web',
      complexity: 'simple',
      keywords: [],
      createdAt: new Date().toISOString(),
    },
    subProjects: [
      { id: 'sp-1', name: 'Setup', description: '', type: 'setup', targetDir: '/tmp/test1', dependencies: [], status: 'pending', createdAt: new Date().toISOString() },
      { id: 'sp-2', name: 'Core', description: '', type: 'development', targetDir: '/tmp/test2', dependencies: ['sp-1'], status: 'pending', createdAt: new Date().toISOString() },
    ],
    tasks: [
      { id: 't1', subProjectId: 'sp-1', title: 'Task 1', description: '', complexity: 'simple', status: 'pending', version: 1, createdAt: new Date().toISOString() },
      { id: 't2', subProjectId: 'sp-2', title: 'Task 2', description: '', complexity: 'medium', status: 'pending', version: 1, createdAt: new Date().toISOString() },
    ],
    status: 'pending',
    rootDir: '/tmp/test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createMockDb() {
  return {
    saveProject: vi.fn(),
    saveSubProject: vi.fn(),
    saveTask: vi.fn(),
    getProject: vi.fn(),
    listProjects: vi.fn().mockReturnValue([]),
  };
}

function createMockRegistry() {
  return {
    route: vi.fn().mockReturnValue({ provider: 'mock', adapter: { name: 'mock', isAvailable: () => true, execute: vi.fn() } }),
  };
}

describe('project-executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes project with dependency ordering', async () => {
    const project = createMockProject();
    const db = createMockDb();
    const registry = createMockRegistry();
    const progressMessages: string[] = [];

    const result = await executeProject(project, {
      registry: registry as any,
      db: db as any,
      onProgress: (msg) => progressMessages.push(msg),
    });

    expect(result.completed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.aborted).toBe(false);
    expect(db.saveProject).toHaveBeenCalledWith(project);
  });

  it('aborts when signal is triggered', async () => {
    const project = createMockProject();
    const db = createMockDb();
    const registry = createMockRegistry();
    const controller = new AbortController();
    controller.abort();

    const result = await executeProject(project, {
      registry: registry as any,
      db: db as any,
      signal: controller.signal,
    });

    expect(result.aborted).toBe(true);
  });

  it('returns timing stats', async () => {
    const project = createMockProject();
    const db = createMockDb();
    const registry = createMockRegistry();
    const progressMessages: string[] = [];

    const result = await executeProjectWithStats(project, {
      registry: registry as any,
      db: db as any,
      onProgress: (msg) => progressMessages.push(msg),
    });

    expect(result.completed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(progressMessages.some((m) => m.includes('Total execution time'))).toBe(true);
  });

  it('stops on critical sub-project failure', async () => {
    const { executeTask } = await import('../src/core/executor.js');
    const mockExecuteTask = vi.mocked(executeTask);
    mockExecuteTask.mockResolvedValueOnce({ success: true, output: 'done' });
    mockExecuteTask.mockResolvedValueOnce({ success: false, error: 'build failed' });

    const project = createMockProject();
    const db = createMockDb();
    const registry = createMockRegistry();

    const result = await executeProject(project, {
      registry: registry as any,
      db: db as any,
    });

    expect(result.completed).toBe(1);
    expect(result.failed).toBe(1);
  });
});
