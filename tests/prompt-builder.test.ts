import { describe, it, expect } from 'vitest';
import { buildTaskPrompt, buildFixPrompt } from '../src/core/prompt-builder.js';
import type { Task, SubProject, Project } from '../src/types/index.js';

function makeProject(overrides?: Partial<Project['idea']>): Project {
  return {
    id: 'test-project',
    name: 'Test Project',
    idea: {
      rawText: 'A test idea',
      type: 'tool',
      monetization: 'web',
      complexity: 'medium',
      keywords: ['test'],
      ...overrides,
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    subProjects: [],
    tasks: [],
  };
}

function makeSubProject(type: SubProject['type']): SubProject {
  return {
    id: 'test-sp',
    name: 'Test SubProject',
    description: 'Does something useful',
    type,
    targetDir: '/tmp/test-project/test-sp',
    dependencies: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

function makeTask(title: string): Task {
  return {
    id: 'test-task',
    title,
    description: 'Implement the feature',
    status: 'pending',
    subProjectId: 'test-sp',
    complexity: 'medium',
    createdAt: new Date().toISOString(),
  };
}

describe('buildTaskPrompt', () => {
  it('includes project name and sub-project details', () => {
    const prompt = buildTaskPrompt(makeTask('Core Feature'), makeSubProject('development'), makeProject());
    expect(prompt).toContain('Test Project');
    expect(prompt).toContain('Test SubProject');
    expect(prompt).toContain('Does something useful');
  });

  it('includes JSON format requirement for coding tasks', () => {
    const prompt = buildTaskPrompt(makeTask('Setup'), makeSubProject('setup'), makeProject());
    expect(prompt).toContain('"files"');
    expect(prompt).toContain('CODE QUALITY REQUIREMENTS');
  });

  it('returns instruction-style prompt for non-coding tasks', () => {
    const prompt = buildTaskPrompt(makeTask('Research'), makeSubProject('research'), makeProject());
    expect(prompt).toContain('step-by-step instructions');
    expect(prompt).not.toContain('CODE QUALITY REQUIREMENTS');
  });

  it('adds setup constraint for setup tasks', () => {
    const prompt = buildTaskPrompt(makeTask('Init'), makeSubProject('setup'), makeProject());
    expect(prompt).toContain('SETUP task');
    expect(prompt).toContain('generate ONLY project configuration files');
  });

  it('adds game constraint for game development tasks', () => {
    const project = makeProject({ type: 'game' });
    const prompt = buildTaskPrompt(makeTask('Game Logic'), makeSubProject('development'), project);
    expect(prompt).toContain('game development');
    expect(prompt).toContain('core gameplay loop');
  });

  it('includes platform section for deployment tasks', () => {
    const prompt = buildTaskPrompt(makeTask('Deploy'), makeSubProject('deployment'), makeProject());
    // For 'web' monetization with no credentials, it shows the no-credentials message
    expect(prompt).toContain('DEPLOYABLE CONFIG TEMPLATE');
    expect(prompt).toMatch(/No platform credentials|Platform credentials/);
  });

  it('escapes quotes in user input to prevent prompt injection', () => {
    const project = makeProject({ rawText: 'say "hello" and `code`' });
    const prompt = buildTaskPrompt(makeTask('Feature'), makeSubProject('development'), project);
    // The escaped version should appear in the user idea section
    const ideaSection = prompt.split('User\'s original idea:')[1] || '';
    expect(ideaSection).toContain('\\"hello\\"');
    expect(ideaSection).not.toContain('"hello"');
  });

  it('uses web-scaffold template for setup tasks regardless of monetization', () => {
    const project = makeProject({ monetization: 'douyin-mini-game' });
    const prompt = buildTaskPrompt(makeTask('Init'), makeSubProject('setup'), project);
    expect(prompt).toContain('Standard Web Project');
  });
});

describe('buildFixPrompt', () => {
  it('includes original prompt and error details', () => {
    const original = 'Build a counter app';
    const runResult = { stdout: 'starting', stderr: 'TypeError: x is undefined', exitCode: 1 as number | null };
    const fix = buildFixPrompt(original, runResult);
    expect(fix).toContain('Build a counter app');
    expect(fix).toContain('TypeError: x is undefined');
    expect(fix).toContain('Exit code: 1');
    expect(fix).toContain('PREVIOUS ATTEMPT FAILED AT RUNTIME');
  });

  it('truncates stderr to 800 chars', () => {
    const original = 'task';
    const longErr = 'x'.repeat(1000);
    const runResult = { stdout: '', stderr: longErr, exitCode: 1 as number | null };
    const fix = buildFixPrompt(original, runResult);
    // stderr should be truncated — the 1000-char error should not appear in full
    expect(fix).not.toContain('x'.repeat(900));
  });

  it('handles null exitCode', () => {
    const runResult = { stdout: '', stderr: 'killed', exitCode: null };
    const fix = buildFixPrompt('task', runResult);
    expect(fix).toContain('Exit code: null');
  });
});
