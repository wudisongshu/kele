import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PromptTemplate } from '../../src/incubator/prompt-template.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PromptTemplate', () => {
  let testDir: string;
  let template: PromptTemplate;

  beforeEach(() => {
    testDir = join(tmpdir(), `kele-prompt-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, '_partials'), { recursive: true });
    template = new PromptTemplate(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('loads an existing template', async () => {
    writeFileSync(join(testDir, 'system-setup.md'), 'Hello {{projectName}}', 'utf-8');
    const result = await template.load('setup');
    expect(result).toContain('Hello {{projectName}}');
  });

  it('falls back to system-default.md when template not found', async () => {
    writeFileSync(join(testDir, 'system-default.md'), 'Default fallback', 'utf-8');
    const result = await template.load('nonexistent');
    expect(result).toContain('Default fallback');
  });

  it('throws when neither template nor fallback exists', async () => {
    await expect(template.load('missing')).rejects.toThrow('neither');
  });

  it('renders string variables', () => {
    const result = template.render('Hello {{name}}', { name: 'kele' });
    expect(result).toBe('Hello kele');
  });

  it('renders array variables as markdown list', () => {
    const result = template.render('Files:\n{{files}}', { files: ['a.js', 'b.css'] });
    expect(result).toBe('Files:\n- a.js\n- b.css');
  });

  it('leaves missing variables as-is', () => {
    const result = template.render('Hello {{name}}', {});
    expect(result).toBe('Hello {{name}}');
  });

  it('resolves partials', async () => {
    writeFileSync(join(testDir, 'system-setup.md'), 'Rules:\n{{> common-rules}}', 'utf-8');
    writeFileSync(join(testDir, '_partials', 'common-rules.md'), '- Rule 1\n- Rule 2', 'utf-8');
    const result = await template.load('setup');
    expect(result).toContain('- Rule 1');
    expect(result).toContain('- Rule 2');
  });

  it('caches loaded templates in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    writeFileSync(join(testDir, 'system-setup.md'), 'Cached content', 'utf-8');
    const first = await template.load('setup');
    // Modify file after first load
    writeFileSync(join(testDir, 'system-setup.md'), 'Modified content', 'utf-8');
    const second = await template.load('setup');
    expect(second).toBe('Cached content');

    process.env.NODE_ENV = originalEnv;
  });

  it('reloads templates in development mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const devTemplate = new PromptTemplate(testDir);

    writeFileSync(join(testDir, 'system-setup.md'), 'Original content', 'utf-8');
    const first = await devTemplate.load('setup');
    expect(first).toBe('Original content');

    writeFileSync(join(testDir, 'system-setup.md'), 'Hot-reloaded content', 'utf-8');
    const second = await devTemplate.load('setup');
    expect(second).toBe('Hot-reloaded content');

    process.env.NODE_ENV = originalEnv;
  });

  it('getSystemMessage loads and renders in one call', async () => {
    writeFileSync(join(testDir, 'system-setup.md'), 'Project: {{projectName}}\nWhitelist:\n{{whitelist}}', 'utf-8');
    const result = await template.getSystemMessage('setup', {
      projectName: 'TestGame',
      whitelist: ['index.html', 'game.js'],
    });
    expect(result).toContain('Project: TestGame');
    expect(result).toContain('- index.html');
    expect(result).toContain('- game.js');
  });

  it('clearCache resets both caches', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    writeFileSync(join(testDir, 'system-setup.md'), 'Old', 'utf-8');
    await template.load('setup');
    template.clearCache();
    writeFileSync(join(testDir, 'system-setup.md'), 'New', 'utf-8');
    const result = await template.load('setup');
    expect(result).toBe('New');

    process.env.NODE_ENV = originalEnv;
  });
});
