import { describe, it, expect } from 'vitest';
import { getPlatformStatuses, getDefaultPlatform } from '../../../src/deploy/index.js';

describe('Unit: Deploy platform status', () => {
  it('returns status for all platforms', () => {
    const statuses = getPlatformStatuses();
    expect(statuses).toHaveLength(4);

    const names = statuses.map((s) => s.name);
    expect(names).toContain('static');
    expect(names).toContain('github-pages');
    expect(names).toContain('vercel');
    expect(names).toContain('netlify');
  });

  it('static is always available', () => {
    const statuses = getPlatformStatuses();
    const staticPlatform = statuses.find((s) => s.name === 'static');
    expect(staticPlatform?.available).toBe(true);
  });

  it('returns a default platform', () => {
    const platform = getDefaultPlatform();
    expect(['static', 'github-pages', 'vercel', 'netlify']).toContain(platform);
  });
});

describe('Unit: Deploy checklist', () => {
  it('generates checklist items', async () => {
    const { generateChecklist } = await import('../../../src/deploy/checklist.js');
    const items = generateChecklist({
      id: 'test',
      name: 'Test',
      description: 'test',
      rootDir: '/tmp',
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(items.length).toBeGreaterThan(0);
    const texts = items.map((i) => i.text);
    expect(texts.some((t) => t.includes('PWA'))).toBe(true);
    expect(texts.some((t) => t.includes('H5'))).toBe(true);
    expect(texts.some((t) => t.includes('软著'))).toBe(true);
  });
});
