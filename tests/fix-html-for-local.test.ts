import { describe, it, expect } from 'vitest';
import { fixHtmlForLocal } from '../src/core/file-writer.js';

describe('fixHtmlForLocal', () => {
  it('removes crossorigin attributes', () => {
    const html = '<script src="app.js" crossorigin="anonymous"></script>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).not.toContain('crossorigin');
    expect(fixed).toContain('src="app.js"');
  });

  it('removes crossorigin without value', () => {
    const html = '<script src="app.js" crossorigin></script>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).not.toContain('crossorigin');
  });

  it('converts absolute /assets/ src to relative', () => {
    const html = '<script src="/assets/game.js"></script>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toContain('src="./assets/game.js"');
    expect(fixed).not.toContain('src="/assets/');
  });

  it('converts absolute /assets/ href to relative', () => {
    const html = '<link rel="stylesheet" href="/assets/style.css">';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toContain('href="./assets/style.css"');
    expect(fixed).not.toContain('href="/assets/');
  });

  it('adds base href when missing', () => {
    const html = '<html><head><title>Game</title></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toContain('<base href=".">');
  });

  it('does not duplicate base href if already present', () => {
    const html = '<html><head><base href="/"><title>Game</title></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    const matches = fixed.match(/<base/g);
    expect(matches?.length).toBe(1);
  });

  it('adds charset meta when missing', () => {
    const html = '<html><head><title>Game</title></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toContain('<meta charset="UTF-8">');
  });

  it('does not duplicate charset if already present', () => {
    const html = '<html><head><meta charset="UTF-8"><title>Game</title></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    const matches = fixed.match(/charset/g);
    expect(matches?.length).toBe(1);
  });

  it('moves non-defer scripts from head to body', () => {
    const html = '<html><head><script>alert(1)</script></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    const headEnd = fixed.indexOf('</head>');
    expect(fixed.substring(0, headEnd).includes('<script')).toBe(false);
    expect(fixed).toMatch(/<body>.*<script>alert\(1\)<\/script>/s);
  });

  it('preserves defer scripts in head', () => {
    const html = '<html><head><script defer src="app.js"></script></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toMatch(/<head>.*<script defer/s);
  });

  it('preserves async scripts in head', () => {
    const html = '<html><head><script async src="app.js"></script></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toMatch(/<head>.*<script async/s);
  });

  it('preserves module scripts in head', () => {
    const html = '<html><head><script type="module" src="app.js"></script></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toMatch(/<head>.*<script type="module"/s);
  });

  it('moves multiple non-defer scripts to body', () => {
    const html = '<html><head><script>var a=1;</script><script>var b=2;</script></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    const headEnd2 = fixed.indexOf('</head>');
    expect(fixed.substring(0, headEnd2).includes('<script')).toBe(false);
    const bodyScripts = fixed.match(/<script>.*?<\/script>/g);
    expect(bodyScripts?.length).toBe(2);
  });

  it('handles self-closing script tags', () => {
    const html = '<html><head><script src="app.js" /></head><body></body></html>';
    const fixed = fixHtmlForLocal(html);
    const headEnd3 = fixed.indexOf('</head>');
    expect(fixed.substring(0, headEnd3).includes('<script')).toBe(false);
    expect(fixed).toMatch(/<body>.*<script/s);
  });

  it('handles empty HTML', () => {
    const html = '';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toBe('');
  });

  it('preserves existing content while fixing paths', () => {
    const html = '<html><head><title>My Game</title></head><body><script src="/assets/app.js"></script></body></html>';
    const fixed = fixHtmlForLocal(html);
    expect(fixed).toContain('<title>My Game</title>');
    expect(fixed).toContain('src="./assets/app.js"');
  });
});
