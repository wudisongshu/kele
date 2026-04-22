import { describe, it, expect } from 'vitest';
import { MockAdapter } from '../src/adapters/mock.js';

describe('MockAdapter', () => {
  const adapter = new MockAdapter();

  describe('isAvailable', () => {
    it('returns true', () => {
      expect(adapter.isAvailable()).toBe(true);
    });
  });

  describe('testConnection', () => {
    it('returns ok', async () => {
      const result = await adapter.testConnection();
      expect(result.ok).toBe(true);
    });
  });

  describe('execute', () => {
    it('returns incubation structure for incubation prompts', async () => {
      const result = await adapter.execute('AI incubator: generate sub-project structure');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('subProjects');
      expect(Array.isArray(parsed.subProjects)).toBe(true);
      expect(parsed.subProjects.length).toBeGreaterThan(0);
    });

    it('returns intent JSON for intent prompts', async () => {
      const result = await adapter.execute('Intent classification\n\nUser input: "make a snake game"');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('intent');
      expect(parsed.intent).toBe('CREATE');
    });

    it('returns game HTML for game prompts', async () => {
      const result = await adapter.execute('Create a snake game');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('files');
      expect(Array.isArray(parsed.files)).toBe(true);
      const htmlFile = parsed.files.find((f: { path: string }) => f.path === 'index.html');
      expect(htmlFile).toBeDefined();
      expect(htmlFile.content).toContain('<!DOCTYPE html>');
    });

    it('returns setup files for setup prompts', async () => {
      const result = await adapter.execute('Initialize project structure setup');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('files');
    });

    it('returns test files for test prompts', async () => {
      const result = await adapter.execute('Write tests for the app');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('files');
      const testFile = parsed.files.find((f: { path: string }) => f.path.includes('test'));
      expect(testFile).toBeDefined();
    });

    it('returns default HTML for generic prompts', async () => {
      const result = await adapter.execute('Something generic');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('files');
      expect(parsed.files[0].path).toBe('index.html');
    });

    it('includes PWA files for game responses', async () => {
      const result = await adapter.execute('Create a match-3 game');
      const parsed = JSON.parse(result);
      const paths = parsed.files.map((f: { path: string }) => f.path);
      expect(paths).toContain('manifest.json');
      expect(paths).toContain('sw.js');
    });
  });
});
