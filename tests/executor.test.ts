import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { sortSubProjects, executeTask, executeProject } from '../src/core/executor.js';
import { ProviderRegistry, MockAdapter } from '../src/adapters/index.js';
import { KeleDatabase } from '../src/db/index.js';
import type { Project, SubProject, Task, Idea } from '../src/types/index.js';

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea-1',
    rawText: 'test idea',
    type: 'game',
    monetization: 'wechat-miniprogram',
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
