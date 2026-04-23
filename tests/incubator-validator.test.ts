import { describe, it, expect } from 'vitest';
import { validateIncubatorOutput, detectCycles, estimateTotalDays } from '../src/core/incubator-validator.js';
import type { SubProject, Idea } from '../src/types/index.js';

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'test', rawText: 'test', type: 'game', monetization: 'web', complexity: 'medium', keywords: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSP(overrides: Partial<SubProject> = {}): SubProject {
  return {
    id: 'sp1', name: 'SP1', description: 'Desc', type: 'setup', targetDir: '/tmp/sp1',
    dependencies: [], status: 'pending', createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('validateIncubatorOutput', () => {
  it('validates a correct structure', () => {
    const sps = [
      makeSP({ id: 'setup', type: 'setup' }),
      makeSP({ id: 'dev', type: 'development', dependencies: ['setup'] }),
      makeSP({ id: 'deploy', type: 'deployment', dependencies: ['dev'], monetizationRelevance: 'core' }),
    ];
    const result = validateIncubatorOutput(sps, makeIdea());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('errors when first project is not setup', () => {
    const sps = [makeSP({ id: 'dev', type: 'development' })];
    const result = validateIncubatorOutput(sps, makeIdea());
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('setup');
  });

  it('errors when setup has dependencies', () => {
    const sps = [makeSP({ id: 'setup', type: 'setup', dependencies: ['dev'] })];
    const result = validateIncubatorOutput(sps, makeIdea());
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('setup');
  });

  it('errors on duplicate IDs', () => {
    const sps = [
      makeSP({ id: 'setup', type: 'setup' }),
      makeSP({ id: 'setup', type: 'development' }),
    ];
    const result = validateIncubatorOutput(sps, makeIdea());
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('重复');
  });

  it('errors on dangling dependencies', () => {
    const sps = [
      makeSP({ id: 'setup', type: 'setup' }),
      makeSP({ id: 'dev', type: 'development', dependencies: ['missing'] }),
    ];
    const result = validateIncubatorOutput(sps, makeIdea());
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('不存在');
  });

  it('errors when too many sub-projects for complexity', () => {
    const sps = Array.from({ length: 10 }, (_, i) => makeSP({ id: `sp${i}`, type: i === 0 ? 'setup' : 'development' }));
    const result = validateIncubatorOutput(sps, makeIdea({ complexity: 'simple' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('3');
  });

  it('warns when no core monetization sub-project', () => {
    const sps = [
      makeSP({ id: 'setup', type: 'setup' }),
      makeSP({ id: 'dev', type: 'development', dependencies: ['setup'] }),
    ];
    const result = validateIncubatorOutput(sps, makeIdea());
    expect(result.warnings.some(w => w.includes('core'))).toBe(true);
  });

  it('warns when no deployment for monetized idea', () => {
    const sps = [
      makeSP({ id: 'setup', type: 'setup' }),
      makeSP({ id: 'dev', type: 'development', dependencies: ['setup'] }),
    ];
    const result = validateIncubatorOutput(sps, makeIdea({ monetization: 'web' }));
    expect(result.warnings.some(w => w.includes('deployment') || w.includes('monetization'))).toBe(true);
  });

  it('warns when all sub-projects are critical path', () => {
    const sps = [
      makeSP({ id: 'setup', type: 'setup', criticalPath: true }),
      makeSP({ id: 'dev', type: 'development', dependencies: ['setup'], criticalPath: true }),
    ];
    const result = validateIncubatorOutput(sps, makeIdea());
    expect(result.warnings.some(w => w.includes('关键路径'))).toBe(true);
  });

  it('warns when no critical path marked', () => {
    const sps = [
      makeSP({ id: 'setup', type: 'setup', criticalPath: false }),
      makeSP({ id: 'dev', type: 'development', dependencies: ['setup'], criticalPath: false }),
    ];
    const result = validateIncubatorOutput(sps, makeIdea());
    expect(result.warnings.some(w => w.includes('关键路径'))).toBe(true);
  });
});

describe('detectCycles', () => {
  it('finds no cycles in acyclic graph', () => {
    const sps = [
      makeSP({ id: 'a', dependencies: [] }),
      makeSP({ id: 'b', dependencies: ['a'] }),
      makeSP({ id: 'c', dependencies: ['b'] }),
    ];
    expect(detectCycles(sps)).toHaveLength(0);
  });

  it('finds simple cycle', () => {
    const sps = [
      makeSP({ id: 'a', dependencies: ['b'] }),
      makeSP({ id: 'b', dependencies: ['a'] }),
    ];
    const cycles = detectCycles(sps);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('finds self-loop', () => {
    const sps = [makeSP({ id: 'a', dependencies: ['a'] })];
    const cycles = detectCycles(sps);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('estimateTotalDays', () => {
  it('estimates days from range strings', () => {
    const sps = [
      makeSP({ estimatedEffort: '2-4 days' }),
      makeSP({ estimatedEffort: '1-2 days' }),
    ];
    expect(estimateTotalDays(sps)).toBeCloseTo(4.5, 1);
  });

  it('converts hours to days', () => {
    const sps = [makeSP({ estimatedEffort: '8-16 hours' })];
    expect(estimateTotalDays(sps)).toBeCloseTo(1.5, 1);
  });

  it('handles single value', () => {
    const sps = [makeSP({ estimatedEffort: '3 days' })];
    expect(estimateTotalDays(sps)).toBe(3);
  });

  it('returns 0 when no effort data', () => {
    const sps = [makeSP(), makeSP()];
    expect(estimateTotalDays(sps)).toBe(0);
  });

  it('handles mixed units in effort estimation', () => {
    const sps = [
      makeSP({ estimatedEffort: '2 days' }),
      makeSP({ estimatedEffort: '8 hours' }),
    ];
    expect(estimateTotalDays(sps)).toBeGreaterThan(0);
  });

  it('detects cycle with multiple nodes', () => {
    const sps = [
      makeSP({ id: 'a', dependencies: ['b'] }),
      makeSP({ id: 'b', dependencies: ['c'] }),
      makeSP({ id: 'c', dependencies: ['a'] }),
    ];
    const cycles = detectCycles(sps);
    expect(cycles.length).toBeGreaterThan(0);
  });
});
