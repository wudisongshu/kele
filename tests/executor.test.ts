import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sortSubProjects, executeTask } from '../src/core/executor.js';
import { executeProject } from '../src/core/project-executor.js';
import { ProviderRegistry, MockAdapter } from '../src/adapters/index.js';
import { KeleDatabase } from '../src/db/index.js';
import { APIError, ValidationError } from '../src/core/executor-errors.js';
import type { Project, SubProject, Task, Idea } from '../src/types/index.js';
import type { AIAdapter } from '../src/adapters/base.js';

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea-1',
    rawText: 'test idea',
    type: 'tool',
    monetization: 'web',
    complexity: 'medium',
    keywords: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    idea: makeIdea(),
    subProjects: [],
    tasks: [],
    status: 'initialized',
    rootDir: '/tmp/test-proj',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSubProject(overrides: Partial<SubProject> = {}): SubProject {
  return {
    id: 'sp-1',
    name: 'Test SubProject',
    description: 'Test',
    type: 'development',
    targetDir: '/tmp/test',
    dependencies: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    subProjectId: 'sp-1',
    title: 'Test Task',
    description: 'Test description',
    complexity: 'simple',
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Executor', () => {
  describe('sortSubProjects', () => {
    it('should sort by dependencies', () => {
      const setup = makeSubProject({ id: 'setup', dependencies: [] });
      const dev = makeSubProject({ id: 'dev', dependencies: ['setup'] });
      const deploy = makeSubProject({ id: 'deploy', dependencies: ['dev'] });

      const sorted = sortSubProjects([deploy, dev, setup]);
      const ids = sorted.map((s) => s.id);

      expect(ids).toEqual(['setup', 'dev', 'deploy']);
    });

    it('should handle multiple independent roots', () => {
      const a = makeSubProject({ id: 'a', dependencies: [] });
      const b = makeSubProject({ id: 'b', dependencies: [] });
      const c = makeSubProject({ id: 'c', dependencies: ['a'] });

      const sorted = sortSubProjects([c, b, a]);
      const ids = sorted.map((s) => s.id);

      expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
    });

    it('should handle empty sub-project list', () => {
      const sorted = sortSubProjects([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single sub-project without dependencies', () => {
      const a = makeSubProject({ id: 'a', dependencies: [] });
      const sorted = sortSubProjects([a]);
      expect(sorted.map((s) => s.id)).toEqual(['a']);
    });
  });

  describe('executeTask', () => {
    let registry: ProviderRegistry;
    let db: KeleDatabase;

    beforeEach(() => {
      registry = new ProviderRegistry();
      registry.register(new MockAdapter());
      db = new KeleDatabase(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should execute a task with mock adapter', async () => {
      const project = makeProject();
      const sp = makeSubProject();
      const task = makeTask({ title: 'Initialize project structure' });

      db.saveProject(project);
      db.saveSubProject(sp, project.id);

      const result = await executeTask(task, sp, project, { registry, db });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(task.status).toBe('completed');
      expect(task.aiProvider).toBe('mock');
    });

    it('should update database on completion', async () => {
      const project = makeProject();
      const sp = makeSubProject();
      const task = makeTask();

      db.saveProject(project);
      db.saveSubProject(sp, project.id);

      await executeTask(task, sp, project, { registry, db });

      const tasks = db.getTasks(project.id);
      expect(tasks.length).toBe(1);
      expect(tasks[0].status).toBe('completed');
    });

    it('should abort when signal is triggered', async () => {
      const project = makeProject();
      const sp = makeSubProject();
      const task = makeTask();
      const controller = new AbortController();
      controller.abort();

      db.saveProject(project);
      db.saveSubProject(sp, project.id);

      const result = await executeTask(task, sp, project, { registry, db, signal: controller.signal });

      expect(result.success).toBe(false);
      expect(result.error).toContain('aborted');
    });

    it('should track aiProvider after execution', async () => {
      const project = makeProject();
      const sp = makeSubProject();
      const task = makeTask();

      db.saveProject(project);
      db.saveSubProject(sp, project.id);

      await executeTask(task, sp, project, { registry, db });

      expect(task.aiProvider).toBe('mock');
      expect(task.status).toBe('completed');
    });

    it('should classify APIError and output structured diagnostics', async () => {
      const throwingAdapter: AIAdapter = {
        name: 'throwing',
        isAvailable: () => true,
        testConnection: async () => ({ ok: true }),
        execute: async () => {
          throw new APIError('OpenAI API error (502)', {
            statusCode: 502,
            responsePreview: '{"error":"gateway timeout"}',
            provider: 'throwing',
          });
        },
      };
      const reg = new ProviderRegistry();
      reg.register(throwingAdapter);

      const project = makeProject();
      const sp = makeSubProject();
      const task = makeTask();
      db.saveProject(project);
      db.saveSubProject(sp, project.id);

      const progress: string[] = [];
      const result = await executeTask(task, sp, project, {
        registry: reg,
        db,
        onProgress: (msg) => progress.push(msg),
        recoveryMode: 'skip',
      });

      expect(result.success).toBe(false);
      // Structured diagnostic should have been printed BEFORE recovery wizard
      const diag = progress.find((m) => m.includes('❌ 任务'));
      expect(diag).toBeDefined();
      expect(diag).toContain('APIError');
      expect(diag).toContain('502');
      expect(diag).toContain('gateway timeout');
      // API error happens during the first phase, so no phase has completed yet
      expect(diag).toContain('无（任务启动前即失败）');
      // Log path should be shown
      expect(diag).toContain('Debug 日志位置');
      expect(diag).toContain('.jsonl');
    });

    it('should classify ValidationError correctly', async () => {
      // Force empty output by using an adapter that returns nothing parseable
      const emptyAdapter: AIAdapter = {
        name: 'empty',
        isAvailable: () => true,
        testConnection: async () => ({ ok: true }),
        execute: async () => '',
      };
      const reg = new ProviderRegistry();
      reg.register(emptyAdapter);

      const project = makeProject();
      const sp = makeSubProject();
      const task = makeTask();
      db.saveProject(project);
      db.saveSubProject(sp, project.id);

      const progress: string[] = [];
      const result = await executeTask(task, sp, project, {
        registry: reg,
        db,
        onProgress: (msg) => progress.push(msg),
        recoveryMode: 'skip',
      });

      expect(result.success).toBe(false);
      const diag = progress.find((m) => m.includes('❌ 任务'));
      expect(diag).toBeDefined();
      expect(diag).toContain('ValidationError');
    });

    it('should write setup errors to global log dir when targetDir does not exist', async () => {
      const throwingAdapter: AIAdapter = {
        name: 'throwing',
        isAvailable: () => true,
        testConnection: async () => ({ ok: true }),
        execute: async () => {
          throw new APIError('Setup API error (503)', { statusCode: 503, provider: 'throwing' });
        },
      };
      const reg = new ProviderRegistry();
      reg.register(throwingAdapter);

      const project = makeProject();
      const sp = makeSubProject({
        type: 'setup',
        targetDir: '/tmp/nonexistent-kele-setup-dir-' + Date.now(),
      });
      const task = makeTask();
      db.saveProject(project);
      db.saveSubProject(sp, project.id);

      const result = await executeTask(task, sp, project, { registry: reg, db, recoveryMode: 'skip' });

      expect(result.success).toBe(false);
      // The DebugLogger should have been created without crashing even though targetDir doesn't exist
    });
  });

  describe('executeProject', () => {
    let registry: ProviderRegistry;
    let db: KeleDatabase;
    const logs: string[] = [];

    beforeEach(() => {
      registry = new ProviderRegistry();
      registry.register(new MockAdapter());
      db = new KeleDatabase(':memory:');
      logs.length = 0;
    });

    afterEach(() => {
      db.close();
    });

    it('should execute all pending tasks', async () => {
      const setup = makeSubProject({ id: 'setup', type: 'setup' });
      const dev = makeSubProject({ id: 'dev', type: 'development', dependencies: ['setup'] });

      const tasks: Task[] = [
        makeTask({ id: 't1', subProjectId: 'setup', title: 'Setup task' }),
        makeTask({ id: 't2', subProjectId: 'dev', title: 'Dev task' }),
      ];

      const project = makeProject({ subProjects: [setup, dev], tasks });

      const result = await executeProject(project, {
        registry,
        db,
        onProgress: (msg) => logs.push(msg),
      });

      expect(result.completed).toBe(2);
      expect(result.failed).toBe(0);
      expect(logs.some((l) => l.includes('Setup task'))).toBe(true);
      expect(logs.some((l) => l.includes('Dev task'))).toBe(true);
    });
  });
});
