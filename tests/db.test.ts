import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { KeleDatabase, getDbPath } from '../src/db/index.js';

const TEST_DB_PATH = join(tmpdir(), `kele-db-test-${Date.now()}.db`);

function createTestProject(id: string): any {
  return {
    id,
    name: `Project ${id}`,
    idea: {
      id,
      rawText: '做一个测试项目',
      type: 'game',
      monetization: 'web',
      complexity: 'medium',
      keywords: ['test'],
      createdAt: new Date().toISOString(),
    },
    subProjects: [],
    tasks: [],
    status: 'initialized',
    rootDir: '/tmp/test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createTestSubProject(id: string, projectId: string): any {
  return {
    id,
    name: `SubProject ${id}`,
    description: 'A test sub-project',
    type: 'development',
    targetDir: '/tmp/test/dev',
    dependencies: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

function createTestTask(id: string, subProjectId: string, projectId: string): any {
  return {
    id,
    subProjectId,
    title: `Task ${id}`,
    description: 'A test task',
    complexity: 'medium',
    status: 'pending',
    version: 1,
    createdAt: new Date().toISOString(),
  };
}

describe('KeleDatabase', () => {
  let db: KeleDatabase;

  beforeEach(() => {
    db = new KeleDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    db.close();
    try { rmSync(TEST_DB_PATH); } catch { /* ignore */ }
  });

  describe('projects', () => {
    it('saves and retrieves a project', () => {
      const project = createTestProject('proj-1');
      db.saveProject(project);

      const loaded = db.getProject('proj-1');
      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('Project proj-1');
      expect(loaded?.idea.type).toBe('game');
      expect(loaded?.status).toBe('initialized');
    });

    it('lists all projects in descending created order', () => {
      const p1 = createTestProject('proj-1');
      const p2 = createTestProject('proj-2');
      p1.createdAt = '2024-01-01T00:00:00Z';
      p2.createdAt = '2024-01-02T00:00:00Z';
      db.saveProject(p1);
      db.saveProject(p2);

      const list = db.listProjects();
      expect(list).toHaveLength(2);
      expect(list[0].id).toBe('proj-2'); // newer first
      expect(list[1].id).toBe('proj-1');
    });

    it('updates existing project with same id', () => {
      const project = createTestProject('proj-1');
      db.saveProject(project);

      project.name = 'Updated Name';
      project.status = 'in_progress';
      db.saveProject(project);

      const loaded = db.getProject('proj-1');
      expect(loaded?.name).toBe('Updated Name');
      expect(loaded?.status).toBe('in_progress');
    });

    it('returns undefined for non-existent project', () => {
      expect(db.getProject('nonexistent')).toBeUndefined();
    });

    it('deletes project and related sub-projects/tasks', () => {
      const project = createTestProject('proj-del');
      const sp = createTestSubProject('sp-del', 'proj-del');
      const task = createTestTask('task-del', 'sp-del', 'proj-del');

      db.saveProject(project);
      db.saveSubProject(sp, 'proj-del');
      db.saveTask(task, 'proj-del');

      db.deleteProject('proj-del');

      expect(db.getProject('proj-del')).toBeUndefined();
      expect(db.getSubProjects('proj-del')).toHaveLength(0);
      expect(db.getTasks('proj-del')).toHaveLength(0);
    });

    it('filters projects by status', () => {
      const p1 = createTestProject('p1');
      const p2 = createTestProject('p2');
      p1.status = 'completed';
      p2.status = 'failed';
      db.saveProject(p1);
      db.saveProject(p2);

      expect(db.getProjectsByStatus('completed')).toHaveLength(1);
      expect(db.getProjectsByStatus('completed')[0].id).toBe('p1');
      expect(db.getProjectsByStatus('failed')).toHaveLength(1);
    });

    it('filters projects by type', () => {
      const p1 = createTestProject('p1');
      const p2 = createTestProject('p2');
      p1.idea.type = 'game';
      p2.idea.type = 'tool';
      db.saveProject(p1);
      db.saveProject(p2);

      const games = db.getProjectsByType('game');
      expect(games).toHaveLength(1);
      expect(games[0].id).toBe('p1');
    });
  });

  describe('sub-projects', () => {
    it('saves and retrieves sub-projects', () => {
      const project = createTestProject('proj-sp');
      const sp = createTestSubProject('sp-1', 'proj-sp');
      sp.dependencies = ['sp-0'];

      db.saveProject(project);
      db.saveSubProject(sp, 'proj-sp');

      const loaded = db.getSubProjects('proj-sp');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('SubProject sp-1');
      expect(loaded[0].dependencies).toEqual(['sp-0']);
    });

    it('returns empty array for project with no sub-projects', () => {
      expect(db.getSubProjects('no-subs')).toEqual([]);
    });
  });

  describe('tasks', () => {
    it('saves and retrieves tasks', () => {
      const project = createTestProject('proj-task');
      const sp = createTestSubProject('sp-1', 'proj-task');
      const task = createTestTask('task-1', 'sp-1', 'proj-task');

      db.saveProject(project);
      db.saveSubProject(sp, 'proj-task');
      db.saveTask(task, 'proj-task');

      const loaded = db.getTasks('proj-task');
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe('Task task-1');
      expect(loaded[0].status).toBe('pending');
    });

    it('updates task status', () => {
      const project = createTestProject('proj-task');
      const sp = createTestSubProject('sp-1', 'proj-task');
      const task = createTestTask('task-1', 'sp-1', 'proj-task');

      db.saveProject(project);
      db.saveSubProject(sp, 'proj-task');
      db.saveTask(task, 'proj-task');

      db.updateTaskStatus('task-1', 'completed', 'done!', undefined);

      const loaded = db.getTasks('proj-task');
      expect(loaded[0].status).toBe('completed');
      expect(loaded[0].result).toBe('done!');
      expect(loaded[0].completedAt).toBeDefined();
    });

    it('updates task with error', () => {
      const project = createTestProject('proj-task');
      const sp = createTestSubProject('sp-1', 'proj-task');
      const task = createTestTask('task-err', 'sp-1', 'proj-task');

      db.saveProject(project);
      db.saveSubProject(sp, 'proj-task');
      db.saveTask(task, 'proj-task');

      db.updateTaskStatus('task-err', 'failed', undefined, 'something broke');

      const loaded = db.getTasks('proj-task');
      expect(loaded[0].status).toBe('failed');
      expect(loaded[0].error).toBe('something broke');
      expect(loaded[0].completedAt).toBeDefined();
    });

    it('does not set completed_at for running status', () => {
      const project = createTestProject('proj-task');
      const sp = createTestSubProject('sp-1', 'proj-task');
      const task = createTestTask('task-run', 'sp-1', 'proj-task');

      db.saveProject(project);
      db.saveSubProject(sp, 'proj-task');
      db.saveTask(task, 'proj-task');

      db.updateTaskStatus('task-run', 'running', undefined, undefined);

      const loaded = db.getTasks('proj-task');
      expect(loaded[0].status).toBe('running');
      expect(loaded[0].completedAt).toBeUndefined();
    });

    it('finds running tasks across all projects', () => {
      const p1 = createTestProject('p1');
      const p2 = createTestProject('p2');
      const sp1 = createTestSubProject('sp1', 'p1');
      const sp2 = createTestSubProject('sp2', 'p2');
      const t1 = createTestTask('t1', 'sp1', 'p1');
      const t2 = createTestTask('t2', 'sp2', 'p2');

      db.saveProject(p1);
      db.saveProject(p2);
      db.saveSubProject(sp1, 'p1');
      db.saveSubProject(sp2, 'p2');
      db.saveTask(t1, 'p1');
      db.saveTask(t2, 'p2');

      db.updateTaskStatus('t1', 'running', undefined, undefined);
      db.updateTaskStatus('t2', 'running', undefined, undefined);

      const running = db.getRunningTasks();
      expect(running).toHaveLength(2);
      expect(running.map((r) => r.projectId)).toContain('p1');
      expect(running.map((r) => r.projectId)).toContain('p2');
    });

    it('returns empty array when no running tasks', () => {
      expect(db.getRunningTasks()).toEqual([]);
    });

    it('finds failed tasks for a project', () => {
      const project = createTestProject('proj-fail');
      const sp = createTestSubProject('sp1', 'proj-fail');
      const t1 = createTestTask('t1', 'sp1', 'proj-fail');
      const t2 = createTestTask('t2', 'sp1', 'proj-fail');

      db.saveProject(project);
      db.saveSubProject(sp, 'proj-fail');
      db.saveTask(t1, 'proj-fail');
      db.saveTask(t2, 'proj-fail');

      db.updateTaskStatus('t1', 'failed', undefined, 'error1');
      db.updateTaskStatus('t2', 'completed', undefined, undefined);

      const failed = db.getFailedTasks('proj-fail');
      expect(failed).toHaveLength(1);
      expect(failed[0].id).toBe('t1');
    });

    it('updateTaskStatus on non-existent task does not throw', () => {
      expect(() => db.updateTaskStatus('nonexistent', 'completed', 'result', undefined)).not.toThrow();
    });

    it('deleteProject on non-existent project does not throw', () => {
      expect(() => db.deleteProject('nonexistent')).not.toThrow();
    });

    it('getSubProjects for non-existent project returns empty array', () => {
      expect(db.getSubProjects('nonexistent')).toEqual([]);
    });

    it('getTasks for non-existent project returns empty array', () => {
      expect(db.getTasks('nonexistent')).toEqual([]);
    });

    it('handles many projects efficiently', () => {
      for (let i = 0; i < 50; i++) {
        const p = createTestProject(`bulk-${i}`);
        db.saveProject(p);
      }
      const list = db.listProjects();
      expect(list).toHaveLength(50);
    });
  });

  describe('getDbPath', () => {
    it('returns path in home directory', () => {
      const path = getDbPath();
      expect(path).toContain('.kele');
      expect(path).toContain('kele.db');
    });
  });
});
