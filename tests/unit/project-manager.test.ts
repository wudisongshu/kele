import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync } from 'fs';
import { basename, join } from 'path';
import { tmpdir } from 'os';
import { ProjectManager } from '../../src/project/manager.js';

describe('Unit: ProjectManager', () => {
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

  it('findByIdentifier finds by id', () => {
    const testDir = join(tmpdir(), `kele-test-proj-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const project = pm.create({
      name: `game-find-by-id-${Date.now()}`,
      description: 'test',
      rootDir: testDir,
      prompt: 'test prompt',
    });
    createdIds.push(project.id);

    const found = pm.findByIdentifier(project.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(project.id);

    rmSync(testDir, { recursive: true, force: true });
  });

  it('findByIdentifier falls back to name match', () => {
    const testDir = join(tmpdir(), `kele-test-proj-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const name = `game-name-match-${Date.now()}`;
    const project = pm.create({
      name,
      description: 'test',
      rootDir: testDir,
    });
    createdIds.push(project.id);

    // Search by name (not id)
    const found = pm.findByIdentifier(name);
    expect(found).toBeDefined();
    expect(found?.id).toBe(project.id);
    expect(found?.name).toBe(name);

    rmSync(testDir, { recursive: true, force: true });
  });

  it('findByIdentifier prefers id over name', () => {
    const dir1 = join(tmpdir(), `kele-test-a-${Date.now()}`);
    const dir2 = join(tmpdir(), `kele-test-b-${Date.now()}`);
    mkdirSync(dir1, { recursive: true });
    mkdirSync(dir2, { recursive: true });

    const p1 = pm.create({
      name: `same-name-${Date.now()}`,
      description: 'first',
      rootDir: dir1,
    });
    const p2 = pm.create({
      name: `same-name-${Date.now()}-2`,
      description: 'second',
      rootDir: dir2,
    });
    createdIds.push(p1.id, p2.id);

    // When searching by id, should return exact match
    const byId = pm.findByIdentifier(p1.id);
    expect(byId?.description).toBe('first');

    rmSync(dir1, { recursive: true, force: true });
    rmSync(dir2, { recursive: true, force: true });
  });

  it('findByIdentifier finds by rootDir basename (slug)', () => {
    const testDir = join(tmpdir(), `kele-test-slug-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const slug = basename(testDir);
    const project = pm.create({
      name: 'slug-lookup-test',
      description: 'test',
      rootDir: testDir,
    });
    createdIds.push(project.id);

    // Search by slug (basename of rootDir), not id or name
    const found = pm.findByIdentifier(slug);
    expect(found).toBeDefined();
    expect(found?.id).toBe(project.id);

    rmSync(testDir, { recursive: true, force: true });
  });

  it('findByIdentifier returns undefined for non-existent', () => {
    expect(pm.findByIdentifier('nonexistent')).toBeUndefined();
    expect(pm.findByIdentifier(`game-does-not-exist-${Date.now()}`)).toBeUndefined();
  });

  it('stores and retrieves prompt', () => {
    const testDir = join(tmpdir(), `kele-test-prompt-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const project = pm.create({
      name: 'test-game',
      description: 'test desc',
      rootDir: testDir,
      prompt: '做个贪吃蛇游戏',
    });
    createdIds.push(project.id);

    const found = pm.get(project.id);
    expect(found?.prompt).toBe('做个贪吃蛇游戏');

    rmSync(testDir, { recursive: true, force: true });
  });

  it('updateName changes project name', () => {
    const testDir = join(tmpdir(), `kele-test-rename-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const project = pm.create({
      name: 'old-name',
      description: 'test',
      rootDir: testDir,
    });
    createdIds.push(project.id);

    pm.updateName(project.id, 'new-name');
    const updated = pm.get(project.id);
    expect(updated?.name).toBe('new-name');

    rmSync(testDir, { recursive: true, force: true });
  });
});
