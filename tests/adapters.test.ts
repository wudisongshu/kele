import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProviderRegistry, createMockRegistry } from '../src/adapters/index.js';
import type { AIAdapter, RouteResult } from '../src/adapters/base.js';

// Create a mock adapter factory
function createMockAdapter(name: string, available = true): AIAdapter {
  return {
    name,
    isAvailable: () => available,
    execute: vi.fn().mockResolvedValue('mock response'),
  } as AIAdapter;
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('always has mock adapter registered by default', () => {
    const mock = registry.get('mock');
    expect(mock).toBeDefined();
    expect(mock?.name).toBe('mock');
    expect(mock?.isAvailable()).toBe(true);
  });

  it('registers and retrieves adapters', () => {
    const deepseek = createMockAdapter('deepseek');
    registry.register(deepseek);
    expect(registry.get('deepseek')).toBe(deepseek);
  });

  it('returns undefined for unregistered adapter', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('lists only available adapters', () => {
    const available = createMockAdapter('available', true);
    const unavailable = createMockAdapter('unavailable', false);
    registry.register(available);
    registry.register(unavailable);

    const list = registry.listAvailable();
    expect(list).toContain('available');
    expect(list).toContain('mock');
    expect(list).not.toContain('unavailable');
  });

  describe('route', () => {
    it('uses preferred provider when available', () => {
      const deepseek = createMockAdapter('deepseek');
      registry.register(deepseek);

      const result = registry.route('medium', 'deepseek');
      expect(result.provider).toBe('deepseek');
      expect(result.adapter).toBe(deepseek);
    });

    it('falls back to default provider when preferred unavailable', () => {
      const deepseek = createMockAdapter('deepseek');
      registry.register(deepseek);

      const result = registry.route('medium', 'nonexistent' as any);
      // Should fall back to deepseek (only non-mock available)
      expect(result.provider).toBe('deepseek');
    });

    it('falls back to mock when no other providers available', () => {
      const result = registry.route('complex');
      expect(result.provider).toBe('mock');
      expect(result.adapter.name).toBe('mock');
    });

    it('skips mock when other providers are available', () => {
      const openai = createMockAdapter('openai');
      registry.register(openai);

      const result = registry.route('simple');
      expect(result.provider).toBe('openai');
    });
  });
});

describe('createMockRegistry', () => {
  it('creates registry with only mock adapter', () => {
    const registry = createMockRegistry();
    const available = registry.listAvailable();
    expect(available).toEqual(['mock']);
    expect(registry.get('mock')).toBeDefined();
  });

  it('mock adapter returns responses', async () => {
    const registry = createMockRegistry();
    const mock = registry.get('mock')!;
    const result = await mock.execute('test');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
