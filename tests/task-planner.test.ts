import { describe, it, expect } from 'vitest';
import { planTasks } from '../src/core/task-planner.js';
import type { SubProject, Idea } from '../src/types/index.js';

function makeSubProject(overrides: Partial<SubProject> = {}): SubProject {
  return {
    id: 'test-sp',
    name: 'Test SubProject',
    description: 'Test',
    type: 'development',
    targetDir: '/tmp/test',
    dependencies: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'test-idea',
    rawText: 'test',
    type: 'game',
    monetization: 'wechat-miniprogram',
    complexity: 'medium',
    keywords: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('TaskPlanner', () => {
  it('should generate tasks for development sub-project', () => {
    const sp = makeSubProject({ type: 'development' });
    const idea = makeIdea();
    const result = planTasks(sp, idea);

    expect(result.success).toBe(true);
    expect(result.tasks!.length).toBe(2);

    const titles = result.tasks!.map((t) => t.title);
    expect(titles).toContain('Implement core features and architecture');
    expect(titles).toContain('Polish and integrate');
  });

  it('should generate tasks for store-submit sub-project', () => {
    const sp = makeSubProject({ type: 'store-submit' });
    const idea = makeIdea();
    const result = planTasks(sp, idea);

    expect(result.tasks!.length).toBe(1);
    const titles = result.tasks!.map((t) => t.title);
    expect(titles).toContain('Submit to store');
  });

  it('should downgrade complexity for simple ideas', () => {
    const sp = makeSubProject({ type: 'development' });
    const idea = makeIdea({ complexity: 'simple' });
    const result = planTasks(sp, idea);

    // All tasks should be simple or medium (downgraded from medium/complex)
    const complexities = result.tasks!.map((t) => t.complexity);
    expect(complexities.every((c) => c !== 'complex')).toBe(true);
  });

  it('should upgrade complexity for complex ideas', () => {
    const sp = makeSubProject({ type: 'development' });
    const idea = makeIdea({ complexity: 'complex' });
    const result = planTasks(sp, idea);

    // At least one task should be complex (upgraded from medium)
    const complexities = result.tasks!.map((t) => t.complexity);
    expect(complexities).toContain('complex');
  });

  it('should link tasks to correct sub-project', () => {
    const sp = makeSubProject({ id: 'sp-123' });
    const idea = makeIdea();
    const result = planTasks(sp, idea);

    for (const task of result.tasks!) {
      expect(task.subProjectId).toBe('sp-123');
      expect(task.status).toBe('pending');
      expect(task.id).toBeDefined();
    }
  });

  it('should generate single task for setup sub-project', () => {
    const sp = makeSubProject({ type: 'setup' });
    const idea = makeIdea();
    const result = planTasks(sp, idea);

    expect(result.tasks!.length).toBe(1);
    const titles = result.tasks!.map((t) => t.title);
    expect(titles).toContain('Initialize project with full configuration');
  });
});
