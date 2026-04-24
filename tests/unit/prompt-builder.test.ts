import { describe, it, expect } from 'vitest';
import { buildGamePrompt, buildToolPrompt } from '../../src/utils/prompt-builder.js';

describe('prompt-builder', () => {
  describe('buildGamePrompt', () => {
    it('includes user input in the prompt', () => {
      const prompt = buildGamePrompt('做一个贪吃蛇游戏');
      expect(prompt).toContain('做一个贪吃蛇游戏');
    });

    it('includes all required rules', () => {
      const prompt = buildGamePrompt('test');
      expect(prompt).toContain('HTML5 Canvas');
      expect(prompt).toContain('requestAnimationFrame');
      expect(prompt).toContain('TODO');
      expect(prompt).toContain('DEATH LINE');
    });

    it('adds retry warning on second attempt', () => {
      const first = buildGamePrompt('test', false);
      const retry = buildGamePrompt('test', true);
      expect(retry).toContain('语法错误');
      expect(retry.length).toBeGreaterThan(first.length);
    });
  });

  describe('buildToolPrompt', () => {
    it('includes user input', () => {
      const prompt = buildToolPrompt('做一个计算器');
      expect(prompt).toContain('做一个计算器');
    });

    it('mentions responsive design', () => {
      const prompt = buildToolPrompt('test');
      expect(prompt).toContain('响应式');
    });
  });
});
