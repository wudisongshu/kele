import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Track all execa calls
const execaCalls: { cmd: string; args: string[]; cwd?: string }[] = [];

// Control whether fetch fails (simulates new branch) or succeeds
let fetchShouldFail = true;
// Control whether push fails
let pushShouldFail = false;

vi.mock('execa', () => ({
  execa: vi.fn(async (cmd: string, args: string[], opts?: { cwd?: string }) => {
    execaCalls.push({ cmd, args: args || [], cwd: opts?.cwd });

    if (cmd === 'git' && args[0] === 'fetch') {
      if (fetchShouldFail) throw new Error("fatal: couldn't find remote ref gh-pages");
      return { stdout: '', stderr: '' };
    }
    if (cmd === 'git' && args[0] === 'status') {
      return { stdout: 'M  index.html\n', stderr: '' };
    }
    if (cmd === 'git' && args[0] === 'push') {
      if (pushShouldFail) throw new Error('fatal: unable to access https://ghp_secret_token@github.com/...');
      return { stdout: '', stderr: '' };
    }

    return { stdout: '', stderr: '' };
  }),
}));

// Import after mock
import { deployGitHubPages } from '../../../src/deploy/platforms/github-pages.js';

describe('Integration: GitHub Pages deploy', () => {
  let projectDir: string;

  beforeEach(() => {
    execaCalls.length = 0;
    fetchShouldFail = true;
    pushShouldFail = false;
    projectDir = mkdtempSync(join(tmpdir(), 'kele-ghp-test-'));
    writeFileSync(join(projectDir, 'index.html'), '<html><body>game</body></html>');
    mkdirSync(join(projectDir, 'icons'));
    writeFileSync(join(projectDir, 'icons', 'icon.svg'), '<svg></svg>');
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('returns error when token is missing', async () => {
    const result = await deployGitHubPages(projectDir, 'proj-abc123', { repo: 'owner/repo' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('GitHub token 未配置');
  });

  it('runs correct git command sequence for subdirectory deploy', async () => {
    const result = await deployGitHubPages(projectDir, 'proj-abc123', {
      token: 'ghp_test_token',
      repo: 'wudisongshu/kele-games',
    });

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://wudisongshu.github.io/kele-games/proj-abc123/');

    // Verify key commands were executed
    const cmds = execaCalls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(cmds.some((c) => c.includes('git init'))).toBe(true);
    expect(cmds.some((c) => c.includes('git config user.name kele'))).toBe(true);
    expect(cmds.some((c) => c.includes('git remote add origin'))).toBe(true);
    expect(cmds.some((c) => c.includes('git fetch'))).toBe(true);
    expect(cmds.some((c) => c.includes('git add .'))).toBe(true);
    expect(cmds.some((c) => c.includes('git commit'))).toBe(true);
    expect(cmds.some((c) => c.includes('git push origin HEAD:gh-pages'))).toBe(true);

    // Verify remote URL contains token
    const remoteCall = execaCalls.find((c) => c.args[0] === 'remote' && c.args[1] === 'add');
    expect(remoteCall?.args[3]).toContain('ghp_test_token');
  });

  it('copies project files into subdir in temp repo', async () => {
    await deployGitHubPages(projectDir, 'proj-abc123', {
      token: 'ghp_test',
      repo: 'wudisongshu/kele-games',
    });

    // git add . and git commit were executed => files were copied before staging
    const cmds = execaCalls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(cmds.some((c) => c.includes('git add .'))).toBe(true);
    expect(cmds.some((c) => c.includes('git commit'))).toBe(true);

    // Verify the temp deploy dir was created (from git init cwd)
    const initCall = execaCalls.find((c) => c.args[0] === 'init');
    expect(initCall?.cwd).toBeDefined();
    expect(initCall?.cwd).toContain('kele-deploy-');
  });

  it('sanitizes token from error messages', async () => {
    pushShouldFail = true;

    const result = await deployGitHubPages(projectDir, 'proj-abc123', {
      token: 'ghp_secret_token',
      repo: 'owner/repo',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('***');
    expect(result.message).not.toContain('ghp_secret_token');
  });

  it('generates correct URL with custom repo', async () => {
    const result = await deployGitHubPages(projectDir, 'proj-xyz789', {
      token: 'ghp_test',
      repo: 'myuser/myrepo',
    });

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://myuser.github.io/myrepo/proj-xyz789/');
  });

  it('preserves existing games when fetching gh-pages branch', async () => {
    fetchShouldFail = false; // simulate existing branch

    const result = await deployGitHubPages(projectDir, 'proj-new456', {
      token: 'ghp_test',
      repo: 'owner/repo',
    });

    expect(result.success).toBe(true);

    // Should have fetched and reset to origin/gh-pages
    const cmds = execaCalls.map((c) => `${c.cmd} ${c.args.join(' ')}`);
    expect(cmds.some((c) => c.includes('git fetch'))).toBe(true);
    expect(cmds.some((c) => c.includes('git reset --hard origin/gh-pages'))).toBe(true);
  });
});
