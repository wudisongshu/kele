import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeepSeekAdapter } from '../src/adapters/deepseek.js';

describe('DeepSeekAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('sets default model', () => {
      const adapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      expect(adapter.name).toBe('deepseek');
    });
  });

  describe('isAvailable', () => {
    it('returns true when apiKey is set', () => {
      const adapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      expect(adapter.isAvailable()).toBe(true);
    });

    it('returns false when apiKey is empty', () => {
      const adapter = new DeepSeekAdapter({ apiKey: '' });
      expect(adapter.isAvailable()).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('returns error when not available', async () => {
      const adapter = new DeepSeekAdapter({ apiKey: '' });
      const result = await adapter.testConnection();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('API key not configured');
    });

    it('returns ok when fetch succeeds', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
      } as unknown as Response);
      const adapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      const result = await adapter.testConnection();
      expect(result.ok).toBe(true);
    });

    it('returns error when fetch fails with status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      } as unknown as Response);
      const adapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      const result = await adapter.testConnection();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('401');
    });

    it('returns error when fetch throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const adapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      const result = await adapter.testConnection();
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('execute', () => {
    it('throws when not available', async () => {
      const adapter = new DeepSeekAdapter({ apiKey: '' });
      await expect(adapter.execute('hello')).rejects.toThrow('not configured');
    });

    it('returns response content on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Hello world' } }],
        }),
      } as unknown as Response);
      const adapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      const result = await adapter.execute('hello');
      expect(result).toBe('Hello world');
    });

    it('throws on API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limited'),
      } as unknown as Response);
      const adapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      await expect(adapter.execute('hello')).rejects.toThrow('429');
    });

    it('returns empty string when no choices', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ choices: [] }),
      } as unknown as Response);
      const adapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      const result = await adapter.execute('hello');
      expect(result).toBe('');
    });
  });
});
