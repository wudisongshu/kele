import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findRunEntry } from '../src/cli/run-guide.js';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('findRunEntry', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'kele-run-guide-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns npm when package.json exists in root', () => {
    writeFileSync(join(tempDir, 'package.json'), '{}');
    const entry = findRunEntry(tempDir);
    expect(entry.type).toBe('npm');
    expect(entry.dir).toBe(tempDir);
  });

  it('returns html when index.html exists', () => {
    writeFileSync(join(tempDir, 'index.html'), '<html></html>');
    const entry = findRunEntry(tempDir);
    expect(entry.type).toBe('html');
    expect(entry.entryFile).toBe('index.html');
  });

  it('returns python when main.py exists', () => {
    writeFileSync(join(tempDir, 'main.py'), 'print(1)');
    const entry = findRunEntry(tempDir);
    expect(entry.type).toBe('python');
    expect(entry.entryFile).toBe('main.py');
  });

  it('returns go when main.go exists', () => {
    writeFileSync(join(tempDir, 'main.go'), 'package main');
    const entry = findRunEntry(tempDir);
    expect(entry.type).toBe('go');
    expect(entry.entryFile).toBe('main.go');
  });

  it('prefers game subdirectories with higher priority', () => {
    writeFileSync(join(tempDir, 'package.json'), '{}');
    const gameDir = join(tempDir, 'game-dev');
    mkdirSync(gameDir);
    writeFileSync(join(gameDir, 'index.html'), '<html></html>');
    const entry = findRunEntry(tempDir);
    expect(entry.type).toBe('html');
    expect(entry.dir).toBe(gameDir);
  });

  it('prefers app over generic web', () => {
    const appDir = join(tempDir, 'my-app');
    const webDir = join(tempDir, 'web-client');
    mkdirSync(appDir);
    mkdirSync(webDir);
    writeFileSync(join(appDir, 'index.html'), '<html></html>');
    writeFileSync(join(webDir, 'index.html'), '<html></html>');
    const entry = findRunEntry(tempDir);
    expect(entry.dir).toBe(appDir);
  });

  it('checks nested game-dev inside sub-project', () => {
    const devDir = join(tempDir, 'core-dev');
    mkdirSync(devDir);
    mkdirSync(join(devDir, 'game-dev'));
    writeFileSync(join(devDir, 'game-dev', 'index.html'), '<html></html>');
    const entry = findRunEntry(tempDir);
    expect(entry.dir).toBe(join(devDir, 'game-dev'));
  });

  it('returns none when no recognizable files exist', () => {
    const entry = findRunEntry(tempDir);
    expect(entry.type).toBe('none');
    expect(entry.dir).toBe(tempDir);
  });

  it('handles empty directory gracefully', () => {
    const entry = findRunEntry(tempDir);
    expect(entry.type).toBe('none');
  });

  it('detects miniprogram via app.json in subdirectory', () => {
    const mpDir = join(tempDir, 'mini');
    mkdirSync(mpDir);
    writeFileSync(join(mpDir, 'app.json'), '{}');
    const entry = findRunEntry(tempDir);
    expect(entry.type).toBe('miniprogram');
  });
});
