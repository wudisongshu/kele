import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProjectManager } from '../../src/project/manager.js';

describe('Unit: rename project', () => {
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

  it('updateName changes project name in database', () => {
    const testDir = mkdtempSync(join(tmpdir(), 'kele-rename-'));
    mkdirSync(testDir, { recursive: true });

    const project = pm.create({
      name: 'Old Game',
      description: 'test',
      rootDir: testDir,
    });
    createdIds.push(project.id);

    pm.updateName(project.id, 'New Game');
    const updated = pm.get(project.id);
    expect(updated?.name).toBe('New Game');

    rmSync(testDir, { recursive: true, force: true });
  });

  it('manifest and index.html can be updated manually', () => {
    const testDir = mkdtempSync(join(tmpdir(), 'kele-rename-files-'));
    mkdirSync(testDir, { recursive: true });

    const project = pm.create({
      name: 'Old Game',
      description: 'test',
      rootDir: testDir,
    });
    createdIds.push(project.id);

    // Simulate rename logic
    const newName = 'Space Shooter';
    pm.updateName(project.id, newName);

    // Update manifest
    const manifestPath = join(testDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({ name: 'Old Game', short_name: 'Old' }), 'utf-8');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
    manifest.name = newName;
    manifest.short_name = newName.slice(0, 12);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    // Update index.html title
    const indexPath = join(testDir, 'index.html');
    writeFileSync(indexPath, '<html><head><title>Old Game</title></head></html>', 'utf-8');
    let html = readFileSync(indexPath, 'utf-8');
    html = html.replace(/<title>[^<]*<\/title>/i, `<title>${newName}</title>`);
    writeFileSync(indexPath, html, 'utf-8');

    expect(JSON.parse(readFileSync(manifestPath, 'utf-8')).name).toBe('Space Shooter');
    expect(readFileSync(indexPath, 'utf-8')).toContain('<title>Space Shooter</title>');

    rmSync(testDir, { recursive: true, force: true });
  });
});
