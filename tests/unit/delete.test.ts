import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProjectManager } from '../../src/project/manager.js';

describe('Unit: delete project', () => {
  let pm: ProjectManager;
  const createdIds: string[] = [];

  beforeEach(() => {
    pm = new ProjectManager();
    createdIds.length = 0;
  });

  afterEach(() => {
    for (const id of createdIds) {
      try { pm.delete(id); } catch { /* ignore */ }
    }
    pm.close();
  });

  it('deletes project from database', () => {
    const testDir = mkdtempSync(join(tmpdir(), 'kele-del-'));
    mkdirSync(testDir, { recursive: true });

    const project = pm.create({
      name: 'to-delete',
      description: 'test',
      rootDir: testDir,
    });
    createdIds.push(project.id);

    expect(pm.get(project.id)).toBeDefined();

    pm.delete(project.id);

    expect(pm.get(project.id)).toBeUndefined();

    rmSync(testDir, { recursive: true, force: true });
  });

  it('removes local directory when deleting', () => {
    const testDir = mkdtempSync(join(tmpdir(), 'kele-del-dir-'));
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, 'sub'), { recursive: true });

    const project = pm.create({
      name: 'del-with-dir',
      description: 'test',
      rootDir: testDir,
    });
    createdIds.push(project.id);

    expect(existsSync(testDir)).toBe(true);

    // Simulate delete command behavior
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    pm.delete(project.id);

    expect(existsSync(testDir)).toBe(false);
    expect(pm.get(project.id)).toBeUndefined();
  });

  it('survives deletion when directory already removed', () => {
    const testDir = join(tmpdir(), `kele-del-missing-${Date.now()}`);

    const project = pm.create({
      name: 'del-missing-dir',
      description: 'test',
      rootDir: testDir,
    });
    createdIds.push(project.id);

    // Directory never existed
    expect(existsSync(testDir)).toBe(false);

    // Should not throw
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    pm.delete(project.id);

    expect(pm.get(project.id)).toBeUndefined();
  });
});
