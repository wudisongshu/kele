import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateTaskOutput } from '../src/core/task-validator.js';

function createTempDir(): string {
  const dir = join(tmpdir(), `kele-tv-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('TaskValidator', () => {
  it('passes for clean code', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.js'), 'function hello() {\n  const x = 1;\n  return "world";\n}\n', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(90);
    rmSync(dir, { recursive: true });
  });

  it('detects TODO comments', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.js'), 'function hello() { // TODO: implement\n}', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('TODO'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('detects empty arrow functions', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.js'), 'const fn = () => {};', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.includes('stub') || i.includes('empty'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('detects placeholder implementation', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.js'), 'function hello() {\n  // placeholder implementation\n}', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.issues.some(i => i.includes('placeholder'))).toBe(true);
    expect(result.score).toBeLessThan(90);
    rmSync(dir, { recursive: true });
  });

  it('handles empty directory', () => {
    const dir = createTempDir();
    const result = validateTaskOutput(dir, 'test');
    expect(result.valid).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('detects FIXME comments', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.js'), 'function hello() { // FIXME: broken\n}', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.issues.some(i => i.includes('FIXME'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('detects HACK comments', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.js'), 'function hello() { // HACK: workaround\n}', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.issues.some(i => i.includes('HACK'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('detects STUB comments', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.js'), 'function hello() { // STUB: implement later\n}', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.issues.some(i => i.includes('STUB'))).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('validates multiple files in directory', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'a.js'), 'function a() {\n  const x = 1;\n  return x + 1;\n}\n', 'utf-8');
    writeFileSync(join(dir, 'b.js'), 'function b() {\n  const y = 2;\n  return y + 2;\n}\n', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.issues)).toBe(true);
    rmSync(dir, { recursive: true });
  });

  it('handles non-JS files gracefully', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'readme.md'), '# Hello\nThis is documentation for the project.', 'utf-8');
    writeFileSync(join(dir, 'style.css'), 'body { color: red; background: blue; margin: 0; padding: 0; }', 'utf-8');
    const result = validateTaskOutput(dir, 'test');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.issues)).toBe(true);
    rmSync(dir, { recursive: true });
  });
});
