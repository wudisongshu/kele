import { describe, it, expect, vi } from 'vitest';
import { reviewTaskOutput, buildFixTask } from '../src/core/task-reviewer.js';
import type { AIAdapter } from '../src/adapters/base.js';

function createMockAdapter(responseJson: object): AIAdapter {
  return {
    name: 'mock',
    isAvailable: () => true,
    execute: vi.fn().mockResolvedValue(JSON.stringify(responseJson)),
  } as AIAdapter;
}

function createMockTask(): any {
  return {
    id: 'task-1',
    subProjectId: 'sp-1',
    title: 'Implement game logic',
    description: 'Create the core game loop',
    complexity: 'medium',
    status: 'completed',
    version: 1,
    createdAt: new Date().toISOString(),
  };
}

function createMockSubProject(): any {
  return {
    id: 'sp-1',
    name: 'Core Game',
    description: 'Core game development',
    type: 'development',
    targetDir: '/tmp/nonexistent-dir-for-test',
    dependencies: [],
    status: 'completed',
    createdAt: new Date().toISOString(),
  };
}

function createMockProject(): any {
  return {
    id: 'proj-1',
    name: 'Test Game',
    idea: {
      id: 'idea-1',
      rawText: '做一个测试游戏',
      type: 'game',
      monetization: 'web',
      complexity: 'medium',
      keywords: [],
      createdAt: new Date().toISOString(),
    },
    subProjects: [],
    tasks: [],
    status: 'in_progress',
    rootDir: '/tmp/test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('task-reviewer', () => {
  describe('reviewTaskOutput', () => {
    it('parses PASS review response', async () => {
      const adapter = createMockAdapter({
        verdict: 'PASS',
        score: 9,
        completeness: 'complete',
        meetsRequirements: true,
        issues: [],
        fixInstructions: '',
      });
      const result = await reviewTaskOutput(createMockTask(), createMockSubProject(), createMockProject(), adapter);

      expect(result.verdict).toBe('PASS');
      expect(result.score).toBe(9);
      expect(result.meetsRequirements).toBe(true);
    });

    it('parses FAIL review response', async () => {
      const adapter = createMockAdapter({
        verdict: 'FAIL',
        score: 3,
        completeness: 'missing',
        meetsRequirements: false,
        issues: ['Missing core file', 'Broken logic'],
        fixInstructions: 'Add game.js and fix the loop',
      });
      const result = await reviewTaskOutput(createMockTask(), createMockSubProject(), createMockProject(), adapter);

      expect(result.verdict).toBe('FAIL');
      expect(result.score).toBe(3);
      expect(result.completeness).toBe('missing');
      expect(result.issues).toHaveLength(2);
    });

    it('normalizes verdict variants', async () => {
      const adapter = createMockAdapter({
        verdict: 'pass',
        score: 8,
        completeness: 'complete',
        meetsRequirements: true,
        issues: [],
        fixInstructions: '',
      });
      const result = await reviewTaskOutput(createMockTask(), createMockSubProject(), createMockProject(), adapter);
      expect(result.verdict).toBe('PASS');
    });

    it('clamps score to 1-10 range', async () => {
      const adapter = createMockAdapter({
        verdict: 'PARTIAL',
        score: 15,
        completeness: 'partial',
        meetsRequirements: false,
        issues: [],
        fixInstructions: '',
      });
      const result = await reviewTaskOutput(createMockTask(), createMockSubProject(), createMockProject(), adapter);
      expect(result.score).toBe(10);
    });

    it('clamps low scores to minimum 1', async () => {
      const adapter = createMockAdapter({
        verdict: 'FAIL',
        score: -5,
        completeness: 'missing',
        meetsRequirements: false,
        issues: [],
        fixInstructions: '',
      });
      const result = await reviewTaskOutput(createMockTask(), createMockSubProject(), createMockProject(), adapter);
      expect(result.score).toBe(1);
    });

    it('falls back to PARTIAL on parse error', async () => {
      const adapter: AIAdapter = {
        name: 'mock',
        isAvailable: () => true,
        execute: vi.fn().mockResolvedValue('not valid json'),
      } as AIAdapter;
      const result = await reviewTaskOutput(createMockTask(), createMockSubProject(), createMockProject(), adapter);

      expect(result.verdict).toBe('PARTIAL');
      expect(result.score).toBe(5);
      expect(result.meetsRequirements).toBe(false);
    });

    it('falls back to PARTIAL on API error', async () => {
      const adapter: AIAdapter = {
        name: 'mock',
        isAvailable: () => true,
        execute: vi.fn().mockRejectedValue(new Error('network error')),
      } as AIAdapter;
      const result = await reviewTaskOutput(createMockTask(), createMockSubProject(), createMockProject(), adapter);

      expect(result.verdict).toBe('PARTIAL');
      expect(result.score).toBe(5);
      expect(result.issues[0]).toContain('network error');
    });

    it('handles empty response fields with defaults', async () => {
      const adapter = createMockAdapter({});
      const result = await reviewTaskOutput(createMockTask(), createMockSubProject(), createMockProject(), adapter);

      expect(result.verdict).toBe('PARTIAL');
      expect(result.score).toBe(5);
      expect(result.completeness).toBe('partial');
      expect(result.meetsRequirements).toBe(false);
      expect(result.issues).toEqual([]);
    });
  });

  describe('buildFixTask', () => {
    it('creates fix task from review result', () => {
      const originalTask = createMockTask();
      const review = {
        verdict: 'FAIL' as const,
        score: 3,
        completeness: 'missing' as const,
        meetsRequirements: false,
        issues: ['Missing file', 'Broken logic'],
        fixInstructions: 'Add the missing file and fix the loop',
      };
      const sp = createMockSubProject();

      const fixTask = buildFixTask(originalTask, review, sp);

      expect(fixTask.title).toContain('Fix:');
      expect(fixTask.title).toContain(originalTask.title);
      expect(fixTask.subProjectId).toBe(sp.id);
      expect(fixTask.status).toBe('pending');
      expect(fixTask.description).toContain('FAIL');
      expect(fixTask.description).toContain('Missing file');
      expect(fixTask.description).toContain('Add the missing file');
      expect(fixTask.id).toMatch(/^fix-/);
    });
  });
});
