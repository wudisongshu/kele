import { describe, it, expect } from 'vitest';
import { createChatContext, addTurn, summarizeHistory, estimateTokenCost, buildChatPrompt } from '../src/core/chat-engine.js';
import type { Project } from '../src/types/index.js';

describe('chat-engine', () => {
  describe('createChatContext', () => {
    it('creates a context with empty history', () => {
      const ctx = createChatContext('proj-1');
      expect(ctx.projectId).toBe('proj-1');
      expect(ctx.history).toEqual([]);
      expect(ctx.maxHistory).toBe(10);
    });

    it('respects custom maxHistory', () => {
      const ctx = createChatContext('proj-2', 5);
      expect(ctx.maxHistory).toBe(5);
    });
  });

  describe('addTurn', () => {
    it('adds a user turn', () => {
      const ctx = createChatContext('proj-1');
      addTurn(ctx, 'user', 'hello');
      expect(ctx.history).toHaveLength(1);
      expect(ctx.history[0]).toEqual({ role: 'user', content: 'hello' });
    });

    it('adds an assistant turn with action', () => {
      const ctx = createChatContext('proj-1');
      addTurn(ctx, 'assistant', 'done', 'modify');
      expect(ctx.history[0]).toEqual({ role: 'assistant', content: 'done', action: 'modify' });
    });

    it('trims history to maxHistory', () => {
      const ctx = createChatContext('proj-1', 2);
      addTurn(ctx, 'user', 'a');
      addTurn(ctx, 'user', 'b');
      addTurn(ctx, 'user', 'c');
      expect(ctx.history).toHaveLength(2);
      expect(ctx.history[0].content).toBe('b');
      expect(ctx.history[1].content).toBe('c');
    });
  });

  describe('summarizeHistory', () => {
    it('returns default for empty history', () => {
      expect(summarizeHistory([])).toBe('No previous conversation.');
    });

    it('summarizes turns with action tags', () => {
      const history = [
        { role: 'user' as const, content: 'make a game' },
        { role: 'assistant' as const, content: 'ok', action: 'create' },
      ];
      const summary = summarizeHistory(history);
      expect(summary).toContain('User: make a game');
      expect(summary).toContain('AI [create]: ok');
    });

    it('truncates long content', () => {
      const history = [{ role: 'user' as const, content: 'x'.repeat(300) }];
      const summary = summarizeHistory(history);
      expect(summary).toContain('...');
      expect(summary.length).toBeLessThan(300);
    });
  });

  describe('estimateTokenCost', () => {
    it('estimates 1 token per 4 chars', () => {
      expect(estimateTokenCost('')).toBe(0);
      expect(estimateTokenCost('abc')).toBe(1);
      expect(estimateTokenCost('abcdefgh')).toBe(2);
    });
  });

  describe('buildChatPrompt', () => {
    it('includes project name and user input', () => {
      const project: Project = {
        id: 'p1',
        name: 'Test Game',
        idea: { rawText: 'a snake game', type: 'game', monetization: 'ads' },
        subProjects: [],
        tasks: [],
        status: 'initialized',
        rootDir: '/tmp/test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ctx = createChatContext('p1');
      const prompt = buildChatPrompt(ctx, 'how do I run this?', project);
      expect(prompt).toContain('Test Game');
      expect(prompt).toContain('how do I run this?');
      expect(prompt).toContain('No previous conversation.');
    });

    it('includes sub-project names', () => {
      const project: Project = {
        id: 'p1',
        name: 'Test Game',
        idea: { rawText: 'a snake game', type: 'game', monetization: 'ads' },
        subProjects: [
          { id: 'sp1', name: 'Core Game', type: 'development', targetDir: '/tmp/test', dependencies: [], status: 'completed', createdAt: '2024-01-01' },
        ],
        tasks: [],
        status: 'initialized',
        rootDir: '/tmp/test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ctx = createChatContext('p1');
      const prompt = buildChatPrompt(ctx, 'hello', project);
      expect(prompt).toContain('Core Game');
    });
  });
});
