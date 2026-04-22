import { describe, it, expect, vi } from 'vitest';
import {
  createChatContext,
  addTurn,
  summarizeHistory,
  estimateTokenCost,
  buildChatPrompt,
  handleChatIntent,
} from '../src/core/chat-engine.js';
import { setupChatCommand } from '../src/cli/commands/chat.js';
import { Command } from 'commander';
import type { Project, Task, SubProject } from '../src/types/index.js';

function makeMockProject(): Project {
  return {
    id: 'test-project',
    name: 'Test Tower Defense',
    idea: {
      id: 'test-project',
      rawText: '做一个塔防游戏',
      type: 'game',
      monetization: 'web',
      complexity: 'medium',
      keywords: [],
      createdAt: new Date().toISOString(),
    },
    subProjects: [
      {
        id: 'sp-dev',
        name: 'Game Development',
        description: 'Core game logic',
        type: 'development',
        targetDir: '/tmp/test-game',
        dependencies: [],
        status: 'completed',
        createdAt: new Date().toISOString(),
      } as SubProject,
    ],
    tasks: [
      {
        id: 'task-1',
        subProjectId: 'sp-dev',
        title: 'Implement core gameplay',
        description: 'Build the tower defense game',
        complexity: 'medium',
        status: 'completed',
        version: 1,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      } as Task,
    ],
    status: 'completed',
    rootDir: '/tmp/test-game',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('chat context & history', () => {
  it('creates empty chat context', () => {
    const ctx = createChatContext('proj-1', 5);
    expect(ctx.projectId).toBe('proj-1');
    expect(ctx.history).toEqual([]);
    expect(ctx.maxHistory).toBe(5);
  });

  it('adds turns to history', () => {
    const ctx = createChatContext('proj-1');
    addTurn(ctx, 'user', 'Hello');
    addTurn(ctx, 'assistant', 'Hi there');
    expect(ctx.history.length).toBe(2);
    expect(ctx.history[0].role).toBe('user');
    expect(ctx.history[1].role).toBe('assistant');
  });

  it('trims history to maxHistory', () => {
    const ctx = createChatContext('proj-1', 3);
    addTurn(ctx, 'user', '1');
    addTurn(ctx, 'assistant', 'A');
    addTurn(ctx, 'user', '2');
    addTurn(ctx, 'assistant', 'B');
    expect(ctx.history.length).toBe(3);
    expect(ctx.history[0].content).toBe('A');
    expect(ctx.history[2].content).toBe('B');
  });

  it('summarizes empty history', () => {
    expect(summarizeHistory([])).toBe('No previous conversation.');
  });

  it('summarizes history with action tags', () => {
    const history = [
      { role: 'user' as const, content: 'Change color', action: 'MODIFY' },
      { role: 'assistant' as const, content: 'Done changing color to blue', action: 'MODIFY' },
    ];
    const summary = summarizeHistory(history);
    expect(summary).toContain('User [MODIFY]: Change color');
    expect(summary).toContain('AI [MODIFY]: Done changing color to blue');
  });

  it('truncates long content in summary', () => {
    const longText = 'a'.repeat(300);
    const history = [{ role: 'user' as const, content: longText }];
    const summary = summarizeHistory(history);
    expect(summary).toContain('...');
    expect(summary.length).toBeLessThan(longText.length);
  });
});

describe('token estimation', () => {
  it('estimates tokens for empty string', () => {
    expect(estimateTokenCost('')).toBe(0);
  });

  it('estimates tokens proportionally to length', () => {
    const text = 'a'.repeat(400);
    expect(estimateTokenCost(text)).toBe(100);
  });

  it('rounds up partial tokens', () => {
    expect(estimateTokenCost('abc')).toBe(1);
  });
});

describe('buildChatPrompt', () => {
  it('includes project name and idea', () => {
    const ctx = createChatContext('proj-1');
    const project = makeMockProject();
    const prompt = buildChatPrompt(ctx, '改颜色', project);
    expect(prompt).toContain('Test Tower Defense');
    expect(prompt).toContain('做一个塔防游戏');
    expect(prompt).toContain('改颜色');
  });

  it('includes conversation history', () => {
    const ctx = createChatContext('proj-1');
    addTurn(ctx, 'user', 'Previous question');
    addTurn(ctx, 'assistant', 'Previous answer');
    const project = makeMockProject();
    const prompt = buildChatPrompt(ctx, 'New question', project);
    expect(prompt).toContain('Previous question');
    expect(prompt).toContain('Previous answer');
  });
});

describe('handleChatIntent', () => {
  it('handles QUESTION intent with mock adapter', async () => {
    const project = makeMockProject();
    const ctx = createChatContext(project.id);
    const mockAdapter = {
      name: 'mock',
      isAvailable: () => true,
      execute: vi.fn().mockResolvedValue('You can use AdSense for web games.'),
      getModelInfo: () => undefined,
    };
    const registry = {
      route: () => ({ provider: 'mock', adapter: mockAdapter as any }),
      get: () => mockAdapter as any,
      listAvailable: () => ['mock'],
      register: () => {},
    };
    const db = {
      getTasks: vi.fn().mockReturnValue(project.tasks),
      getSubProjects: vi.fn().mockReturnValue(project.subProjects),
    } as any;

    const result = await handleChatIntent(
      { type: 'QUESTION', question: '怎么接广告？' },
      project,
      ctx,
      { registry: registry as any, db }
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('QUESTION');
    expect(result.message).toContain('AdSense');
    expect(mockAdapter.execute).toHaveBeenCalled();
  });

  it('handles QUERY intent without AI call', async () => {
    const project = makeMockProject();
    const ctx = createChatContext(project.id);
    const registry = {} as any;
    const db = {
      getTasks: vi.fn().mockReturnValue(project.tasks),
      getSubProjects: vi.fn().mockReturnValue(project.subProjects),
    } as any;

    const result = await handleChatIntent(
      { type: 'QUERY', query: '进度' },
      project,
      ctx,
      { registry, db }
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('QUERY');
    expect(result.message).toContain('Test Tower Defense');
    expect(result.message).toContain('1 完成');
  });

  it('handles DEPLOY intent with missing platform', async () => {
    const project = makeMockProject();
    project.idea.monetization = 'unknown';
    const ctx = createChatContext(project.id);
    const registry = {} as any;
    const db = {
      getTasks: vi.fn().mockReturnValue([]),
      getSubProjects: vi.fn().mockReturnValue([]),
    } as any;

    const result = await handleChatIntent(
      { type: 'DEPLOY' },
      project,
      ctx,
      { registry, db }
    );

    expect(result.success).toBe(false);
    expect(result.action).toBe('DEPLOY');
    expect(result.message).toContain('无法自动检测');
  });

  it('handles MODIFY intent when no task exists', async () => {
    const project = makeMockProject();
    const ctx = createChatContext(project.id);
    const registry = {} as any;
    const db = {
      getTasks: vi.fn().mockReturnValue([]),
      getSubProjects: vi.fn().mockReturnValue([]),
    } as any;

    const result = await handleChatIntent(
      { type: 'MODIFY', request: '改颜色' },
      project,
      ctx,
      { registry, db }
    );

    expect(result.success).toBe(false);
    expect(result.action).toBe('MODIFY');
    expect(result.message).toContain('未找到');
  });

  it('handles CREATE intent via CHAT fallback', async () => {
    const project = makeMockProject();
    const ctx = createChatContext(project.id);
    const mockAdapter = {
      name: 'mock',
      execute: vi.fn().mockResolvedValue('Created new project plan'),
    };
    const registry = {
      route: () => ({ provider: 'mock', adapter: mockAdapter }),
    } as any;

    const result = await handleChatIntent(
      { type: 'CREATE', idea: '做一个新游戏' },
      project,
      ctx,
      { registry }
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('CHAT');
    expect(result.message).toContain('Created new project plan');
  });

  it('handles CHAT intent directly', async () => {
    const project = makeMockProject();
    const ctx = createChatContext(project.id);
    const mockAdapter = {
      name: 'mock',
      execute: vi.fn().mockResolvedValue('Hello! How can I help?'),
    };
    const registry = {
      route: () => ({ provider: 'mock', adapter: mockAdapter }),
    } as any;

    const result = await handleChatIntent(
      { type: 'CHAT', message: '你好' },
      project,
      ctx,
      { registry }
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('CHAT');
    expect(result.message).toContain('Hello! How can I help?');
  });

  it('handles CONFIG intent via CHAT fallback', async () => {
    const project = makeMockProject();
    const ctx = createChatContext(project.id);
    const mockAdapter = {
      name: 'mock',
      execute: vi.fn().mockResolvedValue('Config updated'),
    };
    const registry = {
      route: () => ({ provider: 'mock', adapter: mockAdapter }),
    } as any;

    const result = await handleChatIntent(
      { type: 'CONFIG', key: 'provider', value: 'kimi' },
      project,
      ctx,
      { registry }
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('CHAT');
  });

  it('handles DELETE intent via CHAT fallback', async () => {
    const project = makeMockProject();
    const ctx = createChatContext(project.id);
    const mockAdapter = {
      name: 'mock',
      execute: vi.fn().mockResolvedValue('Deleted'),
    };
    const registry = {
      route: () => ({ provider: 'mock', adapter: mockAdapter }),
    } as any;

    const result = await handleChatIntent(
      { type: 'DELETE', target: 'project' },
      project,
      ctx,
      { registry }
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('CHAT');
  });

  it('handles unknown intent via CHAT fallback with adapter error', async () => {
    const project = makeMockProject();
    const ctx = createChatContext(project.id);
    const mockAdapter = {
      name: 'mock',
      execute: vi.fn().mockRejectedValue(new Error('adapter down')),
    };
    const registry = {
      route: () => ({ provider: 'mock', adapter: mockAdapter }),
    } as any;

    const result = await handleChatIntent(
      { type: 'CHAT', message: 'test' },
      project,
      ctx,
      { registry }
    );

    expect(result.success).toBe(false);
    expect(result.action).toBe('CHAT');
    expect(result.message).toContain('adapter down');
  });
});

describe('CLI command setup', () => {
  it('registers chat command on program', () => {
    const program = new Command();
    setupChatCommand(program);
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain('chat');
  });
});
