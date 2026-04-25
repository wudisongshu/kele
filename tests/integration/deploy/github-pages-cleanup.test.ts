import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execaCalls: { cmd: string; args: string[]; cwd?: string }[] = [];

vi.mock('execa', () => ({
  execa: vi.fn(async (cmd: string, args: string[], opts?: { cwd?: string }) => {
    execaCalls.push({ cmd, args: args || [], cwd: opts?.cwd });

    // Pre-populate mock deploy dir with game subdirs when git init runs
    if (cmd === 'git' && args[0] === 'init' && opts?.cwd) {
      mkdirSync(join(opts.cwd, 'proj-abc'), { recursive: true });
      mkdirSync(join(opts.cwd, 'proj-old'), { recursive: true });
    }

    if (cmd === 'git' && args[0] === 'fetch') {
      return { stdout: '', stderr: '' };
    }
    if (cmd === 'git' && args[0] === 'status') {
      return { stdout: 'D  proj-old/\n', stderr: '' };
    }

    return { stdout: '', stderr: '' };
  }),
}));

import {
  undeployGitHubPages,
  pruneGitHubPages,
  cleanAllGitHubPages,
} from '../../../src/deploy/platforms/github-pages.js';

describe('Integration: GitHub Pages cleanup', () => {
  beforeEach(() => {
    execaCalls.length = 0;
  });

  afterEach(() => {
    // nothing persistent
  });

  it('undeploy returns error when token is missing', async () => {
    const result = await undeployGitHubPages('proj-abc', {});
    expect(result.removed).toBe(false);
    expect(result.message).toContain('GitHub token 未配置');
  });

  it('undeploy runs correct git command sequence', async () => {
    const result = await undeployGitHubPages('proj-abc', {
      token: 'ghp_test',
      repo: 'owner/repo',
    });

    const cmds = execaCalls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(cmds.some((c) => c.includes('git init'))).toBe(true);
    expect(cmds.some((c) => c.includes('git fetch'))).toBe(true);
    expect(cmds.some((c) => c.includes('git add .'))).toBe(true);
    expect(cmds.some((c) => c.includes('git commit'))).toBe(true);
    expect(cmds.some((c) => c.includes('git push origin HEAD:gh-pages'))).toBe(true);
  });

  it('undeploy returns false when project not on gh-pages', async () => {
    const result = await undeployGitHubPages('nonexistent-proj', {
      token: 'ghp_test',
      repo: 'owner/repo',
    });
    expect(result.removed).toBe(false);
    expect(result.message).toContain('不存在');
  });

  it('prune runs correct git command sequence', async () => {
    const result = await pruneGitHubPages(2, {
      token: 'ghp_test',
      repo: 'owner/repo',
    });

    const cmds = execaCalls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(cmds.some((c) => c.includes('git init'))).toBe(true);
    expect(cmds.some((c) => c.includes('git fetch'))).toBe(true);
    expect(cmds.some((c) => c.includes('git add .'))).toBe(true);
    expect(cmds.some((c) => c.includes('git commit'))).toBe(true);
    expect(cmds.some((c) => c.includes('git push origin HEAD:gh-pages'))).toBe(true);
  });

  it('clean-all runs correct git command sequence', async () => {
    const result = await cleanAllGitHubPages({
      token: 'ghp_test',
      repo: 'owner/repo',
    });

    const cmds = execaCalls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(cmds.some((c) => c.includes('git init'))).toBe(true);
    expect(cmds.some((c) => c.includes('git fetch'))).toBe(true);
    expect(cmds.some((c) => c.includes('git add .'))).toBe(true);
    expect(cmds.some((c) => c.includes('git commit'))).toBe(true);
    expect(cmds.some((c) => c.includes('git push origin HEAD:gh-pages'))).toBe(true);
  });

  it('token is sanitized in error messages', async () => {
    // Override mock to make push fail
    const { execa } = await import('execa');
    vi.mocked(execa).mockImplementation(async (cmd: string, args: string[], opts?: { cwd?: string }) => {
      execaCalls.push({ cmd, args: args || [], cwd: opts?.cwd });
      if (cmd === 'git' && args[0] === 'push') {
        throw new Error('fatal: unable to access https://ghp_secret@github.com/...');
      }
      if (cmd === 'git' && args[0] === 'init' && opts?.cwd) {
        mkdirSync(join(opts.cwd, 'proj-abc'), { recursive: true });
      }
      if (cmd === 'git' && args[0] === 'fetch') return { stdout: '', stderr: '' };
      if (cmd === 'git' && args[0] === 'status') return { stdout: 'M  x\n', stderr: '' };
      return { stdout: '', stderr: '' };
    });

    const result = await undeployGitHubPages('proj-abc', {
      token: 'ghp_secret',
      repo: 'owner/repo',
    });

    expect(result.removed).toBe(false);
    expect(result.message).toContain('***');
    expect(result.message).not.toContain('ghp_secret');
  });
});
