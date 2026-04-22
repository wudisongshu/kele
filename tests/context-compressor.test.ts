import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getProjectSize,
  shouldCompress,
  getCompressedFileTree,
  generateTaskSummary,
  summarizeRecentTasks,
  compressProjectContext,
  buildProjectContext,
} from '../src/core/context-compressor.js';
import { generateProjectSummary } from '../src/core/file-writer.js';
import type { Project, SubProject, Task } from '../src/types/index.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), `kele-ctx-test-${Date.now()}`);

function makeProject(spCount: number, filesPerSp: number = 0): Project {
  const subProjects: SubProject[] = [];
  for (let i = 0; i < spCount; i++) {
    const spDir = join(TEST_DIR, `sp-${i}`);
    mkdirSync(spDir, { recursive: true });
    for (let j = 0; j < filesPerSp; j++) {
      writeFileSync(join(spDir, `file${j}.ts`), `export const x${j} = ${j};\n`);
    }
    subProjects.push({
      id: `sp-${i}`,
      name: `SubProject ${i}`,
      description: `Description for sub-project ${i}`,
      type: i === 0 ? 'development' : 'testing',
      targetDir: spDir,
      dependencies: i > 0 ? ['sp-0'] : [],
      status: 'completed',
      createdAt: new Date().toISOString(),
    } as SubProject);
  }
  return {
    id: 'proj-1',
    name: 'Test Project',
    idea: {
      id: 'proj-1',
      rawText: 'Test idea',
      type: 'game',
      monetization: 'web',
      complexity: 'medium',
      keywords: [],
      createdAt: new Date().toISOString(),
    },
    subProjects,
    tasks: [],
    status: 'completed',
    rootDir: TEST_DIR,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
});

describe('getProjectSize', () => {
  it('counts sub-projects and files', () => {
    const project = makeProject(2, 3);
    const size = getProjectSize(project);
    expect(size.subProjectCount).toBe(2);
    expect(size.fileCount).toBe(6);
  });

  it('returns zero for empty project', () => {
    const project = makeProject(0);
    const size = getProjectSize(project);
    expect(size.subProjectCount).toBe(0);
    expect(size.fileCount).toBe(0);
  });
});

describe('shouldCompress', () => {
  it('returns false for small projects (<3 sub-projects, <20 files)', () => {
    const project = makeProject(2, 2);
    expect(shouldCompress(project)).toBe(false);
  });

  it('returns true for many sub-projects', () => {
    const project = makeProject(5, 1);
    expect(shouldCompress(project)).toBe(true);
  });

  it('returns true for many files', () => {
    const project = makeProject(1, 25);
    expect(shouldCompress(project)).toBe(true);
  });

  it('respects KELE_CONTEXT_THRESHOLD env var', () => {
    const original = process.env.KELE_CONTEXT_THRESHOLD;
    process.env.KELE_CONTEXT_THRESHOLD = '1';
    const project = makeProject(2, 1);
    expect(shouldCompress(project)).toBe(true);
    if (original === undefined) {
      delete process.env.KELE_CONTEXT_THRESHOLD;
    } else {
      process.env.KELE_CONTEXT_THRESHOLD = original;
    }
  });
});

describe('getCompressedFileTree', () => {
  it('filters out irrelevant files', () => {
    const spDir = join(TEST_DIR, 'sp');
    mkdirSync(spDir, { recursive: true });
    mkdirSync(join(spDir, 'node_modules'), { recursive: true });
    writeFileSync(join(spDir, 'index.ts'), 'export const a = 1;');
    writeFileSync(join(spDir, 'readme.txt'), 'hello'); // irrelevant
    writeFileSync(join(spDir, 'node_modules', 'x.js'), 'x'); // ignored

    const tree = getCompressedFileTree(spDir);
    expect(tree).toContain('index.ts');
    expect(tree).not.toContain('readme.txt');
    expect(tree).not.toContain('node_modules');
  });

  it('tags interface files', () => {
    const spDir = join(TEST_DIR, 'sp');
    mkdirSync(spDir, { recursive: true });
    writeFileSync(join(spDir, 'types.d.ts'), 'export interface X {}');

    const tree = getCompressedFileTree(spDir);
    expect(tree).toContain('types.d.ts');
    expect(tree).toContain('[types]');
  });
});

describe('generateTaskSummary', () => {
  it('summarizes a completed task', () => {
    const task: Task = {
      id: 't1',
      subProjectId: 'sp1',
      title: 'Implement core',
      description: 'Build core logic',
      complexity: 'medium',
      status: 'completed',
      version: 1,
      createdAt: new Date().toISOString(),
      result: 'Generated files: index.ts, game.ts',
    } as Task;
    const summary = generateTaskSummary(task);
    expect(summary).toContain('Implement core');
    expect(summary).toContain('completed');
    expect(summary).toContain('Generated files');
  });

  it('truncates long results', () => {
    const task: Task = {
      id: 't1',
      subProjectId: 'sp1',
      title: 'Long task',
      description: 'desc',
      complexity: 'medium',
      status: 'completed',
      version: 1,
      createdAt: new Date().toISOString(),
      result: 'x'.repeat(500),
    } as Task;
    const summary = generateTaskSummary(task);
    expect(summary).toContain('...');
  });
});

describe('summarizeRecentTasks', () => {
  it('returns last 3 completed tasks', () => {
    const tasks: Task[] = [
      { id: 't1', status: 'completed', title: 'A', createdAt: '2024-01-01T00:00:00Z', result: 'done' } as Task,
      { id: 't2', status: 'completed', title: 'B', createdAt: '2024-01-02T00:00:00Z', result: 'done' } as Task,
      { id: 't3', status: 'completed', title: 'C', createdAt: '2024-01-03T00:00:00Z', result: 'done' } as Task,
      { id: 't4', status: 'completed', title: 'D', createdAt: '2024-01-04T00:00:00Z', result: 'done' } as Task,
    ];
    const summary = summarizeRecentTasks(tasks);
    expect(summary).toContain('D');
    expect(summary).toContain('C');
    expect(summary).toContain('B');
    expect(summary).not.toContain('A');
  });

  it('handles no completed tasks', () => {
    const tasks: Task[] = [
      { id: 't1', status: 'pending', title: 'A', createdAt: '2024-01-01T00:00:00Z' } as Task,
    ];
    expect(summarizeRecentTasks(tasks)).toBe('No recent completed tasks.');
  });
});

describe('compressProjectContext', () => {
  it('compresses large project and reduces length', () => {
    const project = makeProject(5, 4);
    const currentSp = project.subProjects[1]; // sp-1 depends on sp-0
    const task: Task = {
      id: 't1',
      subProjectId: currentSp.id,
      title: 'Current task',
      description: 'desc',
      complexity: 'medium',
      status: 'running',
      version: 1,
      createdAt: new Date().toISOString(),
    } as Task;

    const result = compressProjectContext(project, currentSp, task);
    expect(result.wasCompressed).toBe(true);
    expect(result.context).toContain('CURRENT SUB-PROJECT');
    expect(result.context).toContain('DIRECT DEPENDENCIES');
    expect(result.context).toContain('OTHER SUB-PROJECTS');
    expect(result.context).toContain('RECENT TASKS');
    expect(result.compressedLength).toBeLessThan(result.originalLength);
  });

  it('preserves dependency info', () => {
    const project = makeProject(4, 2);
    const currentSp = project.subProjects[1]; // depends on sp-0
    const task: Task = {
      id: 't1',
      subProjectId: currentSp.id,
      title: 'Task',
      description: 'desc',
      complexity: 'medium',
      status: 'running',
      version: 1,
      createdAt: new Date().toISOString(),
    } as Task;

    const result = compressProjectContext(project, currentSp, task);
    expect(result.context).toContain('SubProject 0');
    expect(result.context).toContain('Deps: sp-0');
  });
});

describe('buildProjectContext', () => {
  it('returns compressed context for large projects', () => {
    const project = makeProject(5, 3);
    const currentSp = project.subProjects[0];
    const task: Task = {
      id: 't1',
      subProjectId: currentSp.id,
      title: 'Task',
      description: 'desc',
      complexity: 'medium',
      status: 'running',
      version: 1,
      createdAt: new Date().toISOString(),
    } as Task;

    const result = buildProjectContext(project, currentSp, task);
    expect(result.compressed).toBe(true);
    expect(result.savedPercent).toBeGreaterThanOrEqual(0);
    expect(result.context).toContain('CURRENT SUB-PROJECT');
  });

  it('returns full context for small projects', () => {
    const project = makeProject(2, 2);
    const currentSp = project.subProjects[0];
    const task: Task = {
      id: 't1',
      subProjectId: currentSp.id,
      title: 'Task',
      description: 'desc',
      complexity: 'medium',
      status: 'running',
      version: 1,
      createdAt: new Date().toISOString(),
    } as Task;

    const result = buildProjectContext(project, currentSp, task);
    expect(result.compressed).toBe(false);
    expect(result.context).toContain('ALL SUB-PROJECTS');
  });
});

describe('generateProjectSummary (file-writer)', () => {
  it('generates summary with key files', () => {
    const spDir = join(TEST_DIR, 'summary-sp');
    mkdirSync(spDir, { recursive: true });
    writeFileSync(join(spDir, 'index.ts'), 'export const app = {};');
    writeFileSync(join(spDir, 'types.d.ts'), 'export interface User { name: string; }');
    writeFileSync(join(spDir, 'README.md'), '# Readme');

    const summary = generateProjectSummary(spDir, 'Summary SP', 'A test project');
    expect(summary).toContain('Project Summary: Summary SP');
    expect(summary).toContain('Description');
    expect(summary).toContain('A test project');
    expect(summary).toContain('index.ts');
    expect(summary).toContain('types.d.ts');
    expect(summary).not.toContain('README.md'); // not a source file
  });

  it('writes PROJECT_SUMMARY.md to disk', () => {
    const spDir = join(TEST_DIR, 'summary-sp2');
    mkdirSync(spDir, { recursive: true });
    writeFileSync(join(spDir, 'main.ts'), 'console.log(1);');

    generateProjectSummary(spDir, 'SP2', 'desc');
    const written = existsSync(join(spDir, 'PROJECT_SUMMARY.md'));
    expect(written).toBe(true);
  });

  it('extracts interface snippets', () => {
    const spDir = join(TEST_DIR, 'summary-sp3');
    mkdirSync(spDir, { recursive: true });
    writeFileSync(join(spDir, 'types.ts'), 'export interface GameState {\n  score: number;\n}\nexport function init() {}');

    const summary = generateProjectSummary(spDir, 'SP3', 'desc');
    expect(summary).toContain('Public Interfaces');
    expect(summary).toContain('GameState');
  });

  it('returns empty string for missing dir', () => {
    const summary = generateProjectSummary('/nonexistent/path');
    expect(summary).toBe('');
  });
});
