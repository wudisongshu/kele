import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ensureDir, writeFileSafe, fileExists, readFileSafe } from '../../src/utils/file.js';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('file-utils', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'kele-file-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('ensureDir creates nested directories', async () => {
    const nested = join(testDir, 'a', 'b', 'c');
    await ensureDir(nested);
    expect(existsSync(nested)).toBe(true);
  });

  it('writeFileSafe creates parent dirs and writes content', async () => {
    const filePath = join(testDir, 'deep', 'file.txt');
    await writeFileSafe(filePath, 'hello');
    expect(existsSync(filePath)).toBe(true);
    const content = await readFileSafe(filePath);
    expect(content).toBe('hello');
  });

  it('fileExists returns false for missing files', async () => {
    const exists = await fileExists(join(testDir, 'missing.txt'));
    expect(exists).toBe(false);
  });

  it('fileExists returns true for existing files', async () => {
    const filePath = join(testDir, 'exists.txt');
    await writeFileSafe(filePath, 'yes');
    expect(await fileExists(filePath)).toBe(true);
  });

  it('readFileSafe returns undefined for missing files', async () => {
    const content = await readFileSafe(join(testDir, 'missing.txt'));
    expect(content).toBeUndefined();
  });
});
