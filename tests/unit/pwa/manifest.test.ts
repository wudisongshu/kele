import { describe, it, expect } from 'vitest';
import { injectPWATags } from '../../../src/pwa/generator.js';

describe('Unit: PWA manifest injection', () => {
  it('adds manifest link before closing head tag', () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Game</title>
</head>
<body>
  <canvas></canvas>
</body>
</html>`;

    const result = injectPWATags(html);
    expect(result).toContain('<link rel="manifest" href="manifest.json">');
    expect(result).toContain('<meta name="theme-color" content="#1a1a2e">');
    expect(result.indexOf('</head>')).toBeGreaterThan(result.indexOf('manifest.json'));
  });

  it('creates head if missing', () => {
    const html = '<html><body>hello</body></html>';
    const result = injectPWATags(html);
    expect(result).toContain('<head>');
    expect(result).toContain('manifest.json');
  });

  it('preserves existing content', () => {
    const html = '<html><head><title>My Game</title></head><body></body></html>';
    const result = injectPWATags(html);
    expect(result).toContain('<title>My Game</title>');
    expect(result).toContain('manifest.json');
  });

  it('handles empty string gracefully', () => {
    const result = injectPWATags('');
    expect(result).toContain('manifest.json');
  });
});
