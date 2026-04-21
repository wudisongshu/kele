import { describe, it, expect } from 'vitest';
import { extractJson, prettyJson, safeJsonParse } from '../src/core/json-utils.js';

describe('extractJson', () => {
  it('returns null for empty string', () => {
    expect(extractJson('')).toBeNull();
    expect(extractJson('   ')).toBeNull();
  });

  it('extracts JSON from markdown code block', () => {
    const text = 'Here is the result:\n```json\n{"key": "value"}\n```';
    expect(extractJson(text)).toBe('{"key": "value"}');
  });

  it('extracts JSON from plain code block without json tag', () => {
    const text = '```\n{"a": 1}\n```';
    expect(extractJson(text)).toBe('{"a": 1}');
  });

  it('extracts plain JSON object', () => {
    const text = 'Some text before {"key": "value"} some after';
    expect(extractJson(text)).toBe('{"key": "value"}');
  });

  it('extracts plain JSON array', () => {
    const text = 'Result: [1, 2, 3]';
    expect(extractJson(text)).toBe('[1, 2, 3]');
  });

  it('handles nested JSON objects', () => {
    const text = 'Data: {"outer": {"inner": [1, 2]}}';
    expect(extractJson(text)).toBe('{"outer": {"inner": [1, 2]}}');
  });

  it('handles JSON with newlines', () => {
    const text = `Response:
{
  "name": "test",
  "value": 42
}`;
    expect(extractJson(text)).toBe('{\n  "name": "test",\n  "value": 42\n}');
  });

  it('returns null for text without JSON', () => {
    expect(extractJson('just plain text')).toBeNull();
    expect(extractJson('no json here')).toBeNull();
  });

  it('prefers code block over inline JSON', () => {
    const text = '```json\n{"from": "block"}\n``` and {"from": "inline"}';
    expect(extractJson(text)).toBe('{"from": "block"}');
  });
});

describe('prettyJson', () => {
  it('pretty-prints extracted JSON', () => {
    const text = '{"a":1}';
    expect(prettyJson(text)).toBe('{\n  "a": 1\n}');
  });

  it('returns original text when no JSON found', () => {
    expect(prettyJson('no json')).toBe('no json');
  });
});

describe('safeJsonParse', () => {
  it('parses valid JSON object', () => {
    const result = safeJsonParse<{ key: string }>('{"key": "value"}');
    expect(result.data).toEqual({ key: 'value' });
    expect(result.error).toBeNull();
    expect(result.raw).toBe('{"key": "value"}');
  });

  it('parses valid JSON array', () => {
    const result = safeJsonParse<number[]>('[1, 2, 3]');
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.error).toBeNull();
  });

  it('extracts and parses JSON from markdown block', () => {
    const text = '```json\n{"parsed": true}\n```';
    const result = safeJsonParse(text);
    expect(result.data).toEqual({ parsed: true });
    expect(result.error).toBeNull();
  });

  it('returns error for invalid JSON', () => {
    const result = safeJsonParse('{"broken": }');
    expect(result.data).toBeNull();
    expect(result.raw).toBe('{"broken": }');
    expect(result.error).toContain('Invalid JSON');
  });

  it('returns error for text without JSON structure', () => {
    const result = safeJsonParse('just plain text');
    expect(result.data).toBeNull();
    expect(result.raw).toBeNull();
    expect(result.error).toContain('no JSON structure found');
  });

  it('returns error for empty string', () => {
    const result = safeJsonParse('');
    expect(result.data).toBeNull();
    expect(result.raw).toBeNull();
    expect(result.error).toContain('no JSON structure found');
  });
});
