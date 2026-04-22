import { describe, it, expect } from 'vitest';
import { incubate } from '../src/core/incubator.js';
import type { Idea } from '../src/types/index.js';

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'test-idea',
    rawText: 'test',
    type: 'unknown',
    monetization: 'unknown',
    complexity: 'medium',
    keywords: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Incubator', () => {
  it('should always include project-setup as first sub-project', () => {
    const idea = makeIdea({ type: 'game', complexity: 'complex' });
    const result = incubate(idea, '/tmp/test-game');

    expect(result.success).toBe(true);
    expect(result.subProjects!.length).toBeGreaterThan(0);
    expect(result.subProjects![0].id).toBe('project-setup');
    expect(result.subProjects![0].targetDir).toBe('/tmp/test-game');
  });

  it('simple: should generate only setup + dev when no platform specified', () => {
    const idea = makeIdea({ type: 'tool', complexity: 'simple', monetization: 'unknown' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toEqual(['project-setup', 'tool-dev']);
  });

  it('simple: should include deploy + monetization when platform is specified', () => {
    const idea = makeIdea({ type: 'tool', complexity: 'simple', monetization: 'web' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toEqual(['project-setup', 'tool-dev', 'deployment', 'monetization']);
  });

  it('medium: should add testing to setup + dev when no platform specified', () => {
    const idea = makeIdea({ type: 'game', complexity: 'medium', monetization: 'unknown' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toEqual(['project-setup', 'game-dev', 'game-test']);
  });

  it('medium: should include deploy + monetization when platform is specified', () => {
    const idea = makeIdea({ type: 'game', complexity: 'medium', monetization: 'wechat-miniprogram' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toEqual(['project-setup', 'game-dev', 'game-test', 'deployment', 'monetization']);
  });

  it('complex: should include deploy + monetization', () => {
    const idea = makeIdea({ type: 'tool', complexity: 'complex', monetization: 'web' });
    const result = incubate(idea, '/tmp/test');

    const ids = result.subProjects!.map((sp) => sp.id);
    expect(ids).toEqual(['project-setup', 'tool-dev', 'tool-test', 'deployment', 'monetization']);
  });

  it('should set correct dependencies for complex pipeline', () => {
    const idea = makeIdea({ type: 'game', complexity: 'complex', monetization: 'web' });
    const result = incubate(idea, '/tmp/test');

    const map = new Map(result.subProjects!.map((sp) => [sp.id, sp]));

    expect(map.get('project-setup')!.dependencies).toEqual([]);
    expect(map.get('game-dev')!.dependencies).toContain('project-setup');
    expect(map.get('game-test')!.dependencies).toContain('game-dev');
    expect(map.get('deployment')!.dependencies).toContain('game-test');
    expect(map.get('monetization')!.dependencies).toContain('deployment');
  });

  it('should handle all creative types', () => {
    const types: Array<{ type: CreativeType; expectedDevId: string }> = [
      { type: 'game', expectedDevId: 'game-dev' },
      { type: 'music', expectedDevId: 'music-production' },
      { type: 'content', expectedDevId: 'content-creation' },
      { type: 'tool', expectedDevId: 'tool-dev' },
      { type: 'unknown', expectedDevId: 'core-dev' },
    ];

    for (const { type, expectedDevId } of types) {
      const idea = makeIdea({ type, complexity: 'simple' });
      const result = incubate(idea, '/tmp/test');
      const ids = result.subProjects!.map((sp) => sp.id);
      expect(ids).toContain('project-setup');
      expect(ids).toContain(expectedDevId);
    }
  });
});
