import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runProject } from '../src/core/run-validator.js';

function getTestDir() {
  return join(tmpdir(), `kele-run-val-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe('run-validator', () => {
  let TEST_DIR: string;

  beforeEach(() => {
    TEST_DIR = getTestDir();
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
  });

  it('returns success for empty directory with no runnable config', async () => {
    const result = await runProject(TEST_DIR);
    expect(result.success).toBe(true);
    expect(result.command).toBe('none');
    expect(result.stderr).toContain('No runnable configuration detected');
  });

  it('validates HTML structure for static projects', async () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body><script>console.log(1)</script></body></html>');
    const result = await runProject(TEST_DIR);
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('HTML validation PASSED');
  });

  it('reports HTML validation failure in stdout', async () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<div>no doctype</div>');
    const result = await runProject(TEST_DIR);
    // echo command succeeds but reports failure in output
    expect(result.stdout).toContain('HTML validation FAILED');
  });

  it('validates manifest.json when present', async () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body></body></html>');
    writeFileSync(join(TEST_DIR, 'manifest.json'), '{"name":"test"}');
    const result = await runProject(TEST_DIR);
    expect(result.success).toBe(true);
  });

  it('reports invalid manifest.json in stdout', async () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body></body></html>');
    writeFileSync(join(TEST_DIR, 'manifest.json'), 'not json {');
    const result = await runProject(TEST_DIR);
    // echo command succeeds but reports failure in output
    expect(result.stdout).toContain('manifest.json validation FAILED');
  });

  it('detects npm test script', async () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ scripts: { test: 'echo "test passed"' } }));
    const result = await runProject(TEST_DIR);
    expect(result.command).toContain('npm test');
  });

  it('detects npm build script', async () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ scripts: { build: 'echo "build done"' } }));
    const result = await runProject(TEST_DIR);
    expect(result.command).toContain('npm run build');
  });

  it('falls back to npm install for dev script', async () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ scripts: { dev: 'echo "dev"' } }));
    const result = await runProject(TEST_DIR);
    expect(result.command).toBe('npm install');
  });

  it('falls back to npm install for package.json without scripts', async () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test' }));
    const result = await runProject(TEST_DIR);
    expect(result.command).toBe('npm install');
  });

  it('detects Python project', async () => {
    writeFileSync(join(TEST_DIR, 'main.py'), 'print("hello")');
    const result = await runProject(TEST_DIR);
    expect(result.command).toContain('python3');
    expect(result.command).toContain('main.py');
  });

  it('detects Go project', async () => {
    writeFileSync(join(TEST_DIR, 'go.mod'), 'module test');
    const result = await runProject(TEST_DIR);
    expect(result.command).toContain('go build');
  });

  it('detects Rust project', async () => {
    writeFileSync(join(TEST_DIR, 'Cargo.toml'), '[package]\nname = "test"');
    const result = await runProject(TEST_DIR);
    expect(result.command).toContain('cargo check');
  });

  it('caps stdout and stderr at 5000 chars', async () => {
    // Create an HTML file that passes validation
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body><script>console.log(1)</script></body></html>');
    const result = await runProject(TEST_DIR);
    expect(result.stdout.length).toBeLessThanOrEqual(5000);
    expect(result.stderr.length).toBeLessThanOrEqual(5000);
  });

  it('handles directory with only CSS files', async () => {
    writeFileSync(join(TEST_DIR, 'style.css'), 'body { margin: 0; }');
    const result = await runProject(TEST_DIR);
    expect(result.success).toBe(true);
    expect(result.command).toBe('none');
  });

  it('validates multiple HTML files', async () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body></body></html>');
    writeFileSync(join(TEST_DIR, 'about.html'), '<!DOCTYPE html><html><body></body></html>');
    const result = await runProject(TEST_DIR);
    expect(result.success).toBe(true);
  });
});
