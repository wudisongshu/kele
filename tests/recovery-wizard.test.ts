import { describe, it, expect } from 'vitest';
import { analyzeFailure, formatRecoveryMenu, buildSimplifiedDescription } from '../src/core/recovery-wizard.js';
import type { Task } from '../src/types/index.js';

describe('recovery-wizard', () => {
  describe('analyzeFailure', () => {
    it('detects syntax errors', () => {
      const task: Task = {
        id: 't1',
        title: 'Test',
        description: 'Build game',
        status: 'failed',
        subProjectId: 'sp1',
        createdAt: '2024-01-01',
      };
      const diagnosis = analyzeFailure(task, 'SyntaxError: Unexpected token');
      expect(diagnosis.type).toBe('runtime');
      expect(diagnosis.title).toContain('Test');
      expect(diagnosis.suggestions.some(s => s.action === 'auto_fix')).toBe(true);
    });

    it('detects timeout errors', () => {
      const task: Task = {
        id: 't1',
        title: 'Test',
        description: 'Build game',
        status: 'failed',
        subProjectId: 'sp1',
        createdAt: '2024-01-01',
      };
      const diagnosis = analyzeFailure(task, 'Request timeout after 30000ms');
      expect(diagnosis.type).toBe('ai_timeout');
    });

    it('detects rate limit errors', () => {
      const task: Task = {
        id: 't1',
        title: 'Test',
        description: 'Build game',
        status: 'failed',
        subProjectId: 'sp1',
        createdAt: '2024-01-01',
      };
      const diagnosis = analyzeFailure(task, '429 too many requests');
      expect(diagnosis.type).toBe('ai_timeout');
    });

    it('detects stub/TODO errors', () => {
      const task: Task = {
        id: 't1',
        title: 'Test',
        description: 'Build game',
        status: 'failed',
        subProjectId: 'sp1',
        createdAt: '2024-01-01',
      };
      const diagnosis = analyzeFailure(task, 'TODO: implement this function');
      expect(diagnosis.type).toBe('validation');
    });

    it('handles unknown errors gracefully', () => {
      const task: Task = {
        id: 't1',
        title: 'Test',
        description: 'Build game',
        status: 'failed',
        subProjectId: 'sp1',
        createdAt: '2024-01-01',
      };
      const diagnosis = analyzeFailure(task, 'Something weird happened');
      expect(diagnosis.type).toBe('unknown');
      expect(diagnosis.suggestions.some(s => s.action === 'retry')).toBe(true);
    });
  });

  describe('formatRecoveryMenu', () => {
    it('formats a menu with options', () => {
      const diagnosis = analyzeFailure({
        id: 't1',
        title: 'Test',
        description: 'Build game',
        status: 'failed',
        subProjectId: 'sp1',
        createdAt: '2024-01-01',
      }, 'SyntaxError');
      const menu = formatRecoveryMenu(diagnosis);
      expect(menu).toContain('1.');
      expect(menu).toContain(diagnosis.title);
    });
  });

  describe('buildSimplifiedDescription', () => {
    it('wraps description with simplification instructions', () => {
      const original = 'Build snake game';
      const simplified = buildSimplifiedDescription(original, 'timeout');
      expect(simplified).toContain('SIMPLIFIED VERSION');
      expect(simplified).toContain(original);
      expect(simplified).toContain('timeout');
      expect(simplified).toContain('MINIMAL working version');
    });

    it('handles empty original description', () => {
      const simplified = buildSimplifiedDescription('', 'error');
      expect(simplified).toContain('SIMPLIFIED VERSION');
      expect(simplified).toContain('error');
    });
  });

  describe('analyzeFailure', () => {
    it('detects API key errors', () => {
      const task: Task = {
        id: 't1', title: 'Test', description: 'Build game',
        status: 'failed', subProjectId: 'sp1', createdAt: '2024-01-01',
      };
      const diagnosis = analyzeFailure(task, 'invalid api key');
      expect(diagnosis.type).toBe('unknown');
      expect(diagnosis.suggestions.length).toBeGreaterThan(0);
    });

    it('detects network errors', () => {
      const task: Task = {
        id: 't1', title: 'Test', description: 'Build game',
        status: 'failed', subProjectId: 'sp1', createdAt: '2024-01-01',
      };
      const diagnosis = analyzeFailure(task, 'ECONNREFUSED');
      expect(diagnosis.type).toBe('ai_timeout');
      expect(diagnosis.suggestions.some(s => s.action === 'retry')).toBe(true);
    });

    it('includes task title in diagnosis', () => {
      const task: Task = {
        id: 't1', title: 'Custom Task Title', description: 'Build game',
        status: 'failed', subProjectId: 'sp1', createdAt: '2024-01-01',
      };
      const diagnosis = analyzeFailure(task, 'error');
      expect(diagnosis.title).toContain('Custom Task Title');
    });
  });
});
