import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameGenerator, extractCode } from '../../src/core/generator.js';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { AIAdapter } from '../../src/ai/provider.js';

function makeMockAdapter(response: string): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockResolvedValue(response),
  };
}

function makeFailingAdapter(errorMsg: string): AIAdapter {
  return {
    name: 'mock-fail',
    isAvailable: () => true,
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    execute: vi.fn().mockRejectedValue(new Error(errorMsg)),
  };
}

describe('GameGenerator', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'kele-gen-test-'));
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('writes HTML to index.html', async () => {
    const html = '<!DOCTYPE html><html><body><canvas id="c"></canvas><script>const c=document.getElementById("c");const ctx=c.getContext("2d");function loop(){ctx.fillRect(0,0,10,10);requestAnimationFrame(loop);}loop();</script></body></html>';
    const generator = new GameGenerator(makeMockAdapter(html), testDir);
    const result = await generator.generate('test');

    expect(result.success).toBe(true);
    expect(result.filePath).toBe(join(testDir, 'index.html'));
    expect(existsSync(result.filePath)).toBe(true);
    const content = readFileSync(result.filePath, 'utf-8');
    expect(content).toContain('<canvas id="c"></canvas>');
    expect(content).toContain('manifest.json');
  });

  it('extracts code from markdown blocks', async () => {
    const html = '<!DOCTYPE html><html><body><canvas id="c"></canvas><script>const c=document.getElementById("c");const ctx=c.getContext("2d");function loop(){requestAnimationFrame(loop);}loop();</script></body></html>';
    const wrapped = '```html\n' + html + '\n```';
    const generator = new GameGenerator(makeMockAdapter(wrapped), testDir);
    const result = await generator.generate('test');

    expect(result.success).toBe(true);
    const content = readFileSync(result.filePath, 'utf-8');
    expect(content).toContain('<canvas id="c"></canvas>');
    expect(content).toContain('manifest.json');
  });

  it('returns error for empty response', async () => {
    const generator = new GameGenerator(makeMockAdapter('   '), testDir);
    const result = await generator.generate('test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('returns error when adapter throws', async () => {
    const generator = new GameGenerator(makeFailingAdapter('network error'), testDir);
    const result = await generator.generate('test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('network error');
  });

  it('retries on syntax error up to max attempts', async () => {
    const badHtml = `<!DOCTYPE html><html><script>const x = 'broken;</script></html>`;
    const adapter = makeMockAdapter(badHtml);
    const generator = new GameGenerator(adapter, testDir, { maxAttempts: 2 });
    const result = await generator.generate('test');

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(adapter.execute).toHaveBeenCalledTimes(2);
  });
});

describe('extractCode', () => {
  it('extracts from markdown html block', () => {
    const html = '<html></html>';
    expect(extractCode('```html\n' + html + '\n```')).toBe(html);
  });

  it('extracts from generic markdown block', () => {
    const html = '<html></html>';
    expect(extractCode('```\n' + html + '\n```')).toBe(html);
  });

  it('extracts from JSON files array', () => {
    const html = '<html></html>';
    const json = JSON.stringify({ files: [{ content: html }] });
    expect(extractCode(json)).toBe(html);
  });

  it('returns raw text when no wrapper detected', () => {
    expect(extractCode('  hello  ')).toBe('hello');
  });
});
