import { describe, it, expect, vi } from 'vitest';
import { incubateWithAI, parseIncubationResponse, normalizeRelevance, normalizeRiskLevel, normalizeAcceptanceType } from '../src/core/ai-incubator.js';
import type { AIAdapter } from '../src/adapters/base.js';
import type { Idea } from '../src/types/index.js';

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'test-idea',
    rawText: 'A test game idea',
    type: 'game',
    monetization: 'web',
    complexity: 'medium',
    keywords: ['game'],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockAdapter(response: string): AIAdapter {
  return {
    name: 'mock',
    execute: vi.fn().mockResolvedValue(response),
  } as unknown as AIAdapter;
}

describe('incubateWithAI', () => {
  it('returns sub-projects on valid AI response', async () => {
    const adapter = makeMockAdapter(JSON.stringify({
      subProjects: [
        { id: 'setup', name: 'Setup', description: 'Init', type: 'setup', dependencies: [] },
        { id: 'dev', name: 'Dev', description: 'Build', type: 'development', dependencies: ['setup'] },
      ],
    }));
    const result = await incubateWithAI(makeIdea(), '/tmp/test', adapter);
    expect(result.success).toBe(true);
    expect(result.subProjects).toHaveLength(2);
    expect(result.subProjects![0].id).toBe('setup');
  });

  it('returns error on invalid JSON', async () => {
    const adapter = makeMockAdapter('not json');
    const result = await incubateWithAI(makeIdea(), '/tmp/test', adapter);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });

  it('returns error on schema validation failure', async () => {
    const adapter = makeMockAdapter(JSON.stringify({ subProjects: [] }));
    const result = await incubateWithAI(makeIdea(), '/tmp/test', adapter);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Schema validation failed');
  });

  it('includes validation metadata in result', async () => {
    const adapter = makeMockAdapter(JSON.stringify({
      subProjects: [
        { id: 'setup', name: 'Setup', description: 'Init', type: 'setup', dependencies: [] },
      ],
    }));
    const result = await incubateWithAI(makeIdea(), '/tmp/test', adapter);
    expect(result.validation).toBeDefined();
    expect(result.validation!.localValid).toBe(true);
  });
});

describe('parseIncubationResponse', () => {
  it('parses valid incubation JSON', () => {
    const json = JSON.stringify({
      subProjects: [
        { id: 'sp1', name: 'SP1', description: 'Desc', type: 'setup', dependencies: [], acceptanceCriteria: [] },
      ],
      reasoning: 'test',
    });
    const result = parseIncubationResponse(json, '/tmp/proj');
    expect(result.success).toBe(true);
    expect(result.subProjects![0].targetDir).toBe('/tmp/proj/sp1');
  });

  it('rejects invalid JSON', () => {
    const result = parseIncubationResponse('bad json', '/tmp');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON');
  });

  it('rejects schema-invalid data', () => {
    const result = parseIncubationResponse(JSON.stringify({ subProjects: [{ id: 'INVALID ID!' }] }), '/tmp');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Schema validation failed');
  });

  it('normalizes optional fields', () => {
    const json = JSON.stringify({
      subProjects: [{
        id: 'sp1', name: 'SP1', description: 'Desc', type: 'setup', dependencies: [],
        monetizationRelevance: 'core', riskLevel: 'high', criticalPath: true,
        acceptanceCriteria: [{
          description: 'test', type: 'functional', action: 'verify-file',
          target: 'x', expected: 'y', critical: false,
        }],
      }],
    });
    const result = parseIncubationResponse(json, '/tmp');
    expect(result.success).toBe(true);
    const sp = result.subProjects![0];
    expect(sp.monetizationRelevance).toBe('core');
    expect(sp.riskLevel).toBe('high');
    expect(sp.criticalPath).toBe(true);
    expect(sp.acceptanceCriteria![0].type).toBe('functional');
    expect(sp.acceptanceCriteria![0].critical).toBe(false);
  });

  it('rejects schema-invalid enum values', () => {
    const json = JSON.stringify({
      subProjects: [{
        id: 'sp1', name: 'SP1', description: 'Desc', type: 'setup', dependencies: [],
        monetizationRelevance: 'CORE', // uppercase, schema rejects
      }],
    });
    const result = parseIncubationResponse(json, '/tmp');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Schema validation failed');
  });
});

describe('normalize helpers', () => {
  it('normalizeRelevance', () => {
    expect(normalizeRelevance('core')).toBe('core');
    expect(normalizeRelevance('SUPPORTING')).toBe('supporting');
    expect(normalizeRelevance('unknown')).toBeUndefined();
    expect(normalizeRelevance()).toBeUndefined();
  });

  it('normalizeRiskLevel', () => {
    expect(normalizeRiskLevel('low')).toBe('low');
    expect(normalizeRiskLevel('MEDIUM')).toBe('medium');
    expect(normalizeRiskLevel('high')).toBe('high');
    expect(normalizeRiskLevel('extreme')).toBeUndefined();
  });

  it('normalizeAcceptanceType', () => {
    expect(normalizeAcceptanceType('visual')).toBe('visual');
    expect(normalizeAcceptanceType('PERFORMANCE')).toBe('performance');
    expect(normalizeAcceptanceType('security')).toBe('security');
    expect(normalizeAcceptanceType('unknown')).toBe('functional');
    expect(normalizeAcceptanceType()).toBe('functional');
  });
});
