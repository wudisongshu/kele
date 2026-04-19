import { describe, it, expect } from 'vitest';

/**
 * Placeholder tests for Slice 1.
 * Real CLI integration tests will be added as the engine matures.
 */

describe('kele CLI', () => {
  it('should have a version', () => {
    // TODO: import actual version from package.json once CLI is testable
    expect(true).toBe(true);
  });

  it('should parse idea text', () => {
    // Placeholder for S2: IdeaEngine tests
    const ideaText = '我要做一个塔防游戏并部署到微信小程序';
    expect(ideaText).toContain('塔防');
    expect(ideaText).toContain('微信');
  });
});
