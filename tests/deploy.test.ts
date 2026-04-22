import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDeployStrategy,
  listDeployPlatforms,
  detectPlatformFromProject,
  type DeployOptions,
} from '../src/core/deploy-strategies.js';
import { setupDeployCommand } from '../src/cli/commands/deploy.js';
import { Command } from 'commander';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), `kele-deploy-test-${Date.now()}`);

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
});

describe('deploy strategies registry', () => {
  it('lists all supported platforms', () => {
    const platforms = listDeployPlatforms();
    expect(platforms).toContain('github-pages');
    expect(platforms).toContain('wechat-miniprogram');
    expect(platforms).toContain('itchio');
    expect(platforms).toContain('vps');
    expect(platforms.length).toBe(4);
  });

  it('returns strategy for known platforms', () => {
    const gh = getDeployStrategy('github-pages');
    expect(gh).toBeDefined();
    expect(gh!.name).toBe('github-pages');
    expect(gh!.label).toBe('GitHub Pages');

    const wc = getDeployStrategy('wechat-miniprogram');
    expect(wc).toBeDefined();
    expect(wc!.name).toBe('wechat-miniprogram');

    const itch = getDeployStrategy('itchio');
    expect(itch).toBeDefined();

    const vps = getDeployStrategy('vps');
    expect(vps).toBeDefined();
  });

  it('returns undefined for unknown platform', () => {
    expect(getDeployStrategy('unknown-platform')).toBeUndefined();
  });
});

describe('detectPlatformFromProject', () => {
  it('maps web to github-pages', () => {
    expect(detectPlatformFromProject('web')).toBe('github-pages');
  });

  it('maps wechat-miniprogram to itself', () => {
    expect(detectPlatformFromProject('wechat-miniprogram')).toBe('wechat-miniprogram');
  });

  it('maps itchio to itself', () => {
    expect(detectPlatformFromProject('itchio')).toBe('itchio');
  });

  it('returns undefined for bot platforms (not yet supported)', () => {
    expect(detectPlatformFromProject('discord-bot')).toBeUndefined();
    expect(detectPlatformFromProject('telegram-bot')).toBeUndefined();
  });

  it('returns undefined for unsupported platforms', () => {
    expect(detectPlatformFromProject('douyin')).toBeUndefined();
    expect(detectPlatformFromProject('steam')).toBeUndefined();
    expect(detectPlatformFromProject('unknown')).toBeUndefined();
  });
});

describe('github-pages strategy', () => {
  it('checks prerequisites on empty dir', async () => {
    const strategy = getDeployStrategy('github-pages')!;
    const result = await strategy.checkPrerequisites(TEST_DIR);
    expect(result.ready).toBe(false); // missing deploy workflow
    const workflowCheck = result.checks.find(c => c.name === 'deploy_workflow');
    expect(workflowCheck).toBeDefined();
    expect(workflowCheck!.passed).toBe(false);
    expect(workflowCheck!.required).toBe(true);
  });

  it('checks prerequisites when workflow exists', async () => {
    mkdirSync(join(TEST_DIR, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(TEST_DIR, '.github', 'workflows', 'deploy.yml'), 'name: Deploy\n');

    const strategy = getDeployStrategy('github-pages')!;
    const result = await strategy.checkPrerequisites(TEST_DIR);
    expect(result.ready).toBe(true);
    const workflowCheck = result.checks.find(c => c.name === 'deploy_workflow');
    expect(workflowCheck!.passed).toBe(true);
  });

  it('validates project with static checks', async () => {
    writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body>test</body></html>');
    const strategy = getDeployStrategy('github-pages')!;
    const result = await strategy.validateProject(TEST_DIR, 'tool');
    // Static validation may fail on minimal fixture, but checks should run
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.checks.length).toBeGreaterThan(0);
    const staticCheck = result.checks.find(c => c.name === 'static_validation');
    expect(staticCheck).toBeDefined();
  });

  it('dry-run deploy returns success without executing', async () => {
    const strategy = getDeployStrategy('github-pages')!;
    const result = await strategy.deploy(TEST_DIR, { dryRun: true, verbose: false });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.platform).toBe('github-pages');
    expect(result.message).toContain('DRY-RUN');
  });

  it('returns deploy guide', () => {
    const strategy = getDeployStrategy('github-pages')!;
    const guide = strategy.getDeployGuide(TEST_DIR);
    expect(guide).toContain('GitHub Pages');
    expect(guide).toContain('git push');
  });
});

describe('wechat-miniprogram strategy', () => {
  it('checks prerequisites on empty dir', async () => {
    const strategy = getDeployStrategy('wechat-miniprogram')!;
    const result = await strategy.checkPrerequisites(TEST_DIR);
    expect(result.ready).toBe(false);
    const cliCheck = result.checks.find(c => c.name === 'wechat_devtool_cli');
    expect(cliCheck).toBeDefined();
    expect(cliCheck!.required).toBe(true);
  });

  it('dry-run deploy returns success without executing', async () => {
    const strategy = getDeployStrategy('wechat-miniprogram')!;
    const result = await strategy.deploy(TEST_DIR, { dryRun: true, verbose: false });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.message).toContain('DRY-RUN');
  });

  it('returns deploy guide', () => {
    const strategy = getDeployStrategy('wechat-miniprogram')!;
    const guide = strategy.getDeployGuide(TEST_DIR);
    expect(guide).toContain('微信');
  });
});

describe('itchio strategy', () => {
  it('checks prerequisites on empty dir', async () => {
    const strategy = getDeployStrategy('itchio')!;
    const result = await strategy.checkPrerequisites(TEST_DIR);
    expect(result.ready).toBe(false);
    const butlerCheck = result.checks.find(c => c.name === 'butler_cli');
    expect(butlerCheck).toBeDefined();
    expect(butlerCheck!.required).toBe(true);
  });

  it('dry-run deploy returns success without executing', async () => {
    const strategy = getDeployStrategy('itchio')!;
    const result = await strategy.deploy(TEST_DIR, { dryRun: true, verbose: false });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.message).toContain('DRY-RUN');
  });

  it('returns deploy guide', () => {
    const strategy = getDeployStrategy('itchio')!;
    const guide = strategy.getDeployGuide(TEST_DIR);
    expect(guide).toContain('itch.io');
    expect(guide).toContain('butler');
  });
});

describe('vps strategy', () => {
  it('checks prerequisites on empty dir', async () => {
    const strategy = getDeployStrategy('vps')!;
    const result = await strategy.checkPrerequisites(TEST_DIR);
    // rsync/ssh may or may not be available in test env; just verify structure
    const sshCheck = result.checks.find(c => c.name === 'ssh');
    expect(sshCheck).toBeDefined();
    expect(sshCheck!.required).toBe(true);
    const rsyncCheck = result.checks.find(c => c.name === 'rsync');
    expect(rsyncCheck).toBeDefined();
    expect(rsyncCheck!.required).toBe(true);
  });

  it('dry-run deploy returns success without executing', async () => {
    const strategy = getDeployStrategy('vps')!;
    const result = await strategy.deploy(TEST_DIR, { dryRun: true, verbose: false });
    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.message).toContain('DRY-RUN');
  });

  it('real deploy fails without host configured', async () => {
    const strategy = getDeployStrategy('vps')!;
    const result = await strategy.deploy(TEST_DIR, { dryRun: false, verbose: false });
    expect(result.success).toBe(false);
    expect(result.message).toContain('未配置');
  });

  it('returns deploy guide', () => {
    const strategy = getDeployStrategy('vps')!;
    const guide = strategy.getDeployGuide(TEST_DIR);
    expect(guide).toContain('VPS');
    expect(guide).toContain('部署');
  });
});

describe('CLI command setup', () => {
  it('registers deploy command on program', () => {
    const program = new Command();
    setupDeployCommand(program);
    const commands = program.commands.map(c => c.name());
    expect(commands).toContain('deploy');
  });
});
