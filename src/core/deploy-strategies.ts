/**
 * Deploy Strategies — platform-specific deployment logic.
 *
 * Each strategy encapsulates:
 * - Prerequisite checks (credentials, CLI tools, config files)
 * - Project validation (build, static checks)
 * - Actual deployment (or dry-run simulation)
 * - Human-readable deployment guide
 *
 * Supported platforms:
 * - github-pages (GitHub Actions → GitHub Pages)
 * - wechat-miniprogram (微信开发者工具 CLI)
 * - itchio (butler push)
 * - vps (rsync + ssh)
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { validateTaskOutput } from './task-validator.js';
import { validateGameInBrowser } from './game-validator-browser.js';
import { checkMonetizationReadiness } from './monetization-readiness.js';
import {
  getPlatformCredentials,
  hasPlatformCredentials,
} from '../platform-credentials.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DeployOptions {
  dryRun: boolean;
  verbose: boolean;
}

export interface PrerequisiteResult {
  ready: boolean;
  checks: PrerequisiteCheck[];
}

export interface PrerequisiteCheck {
  name: string;
  passed: boolean;
  required: boolean;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  score: number;
  checks: ValidationCheck[];
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface DeployResult {
  success: boolean;
  platform: string;
  message: string;
  command?: string;
  output?: string;
  dryRun: boolean;
}

export interface DeployStrategy {
  readonly name: string;
  readonly label: string;

  checkPrerequisites(projectDir: string): Promise<PrerequisiteResult>;
  validateProject(projectDir: string, projectType?: string): Promise<ValidationResult>;
  deploy(projectDir: string, opts: DeployOptions): Promise<DeployResult>;
  getDeployGuide(projectDir: string): string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hasCliTool(command: string): boolean {
  try {
    execSync(`${command} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runBuildStep(projectDir: string): ValidationCheck {
  const pkgPath = join(projectDir, 'package.json');
  if (!existsSync(pkgPath)) {
    return { name: 'build_step', passed: true, message: 'No build step (static project)' };
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (pkg.scripts?.build) {
      try {
        execSync('npm run build', { cwd: projectDir, stdio: 'pipe', timeout: 120000 });
        return { name: 'build_step', passed: true, message: 'Build passed' };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { name: 'build_step', passed: false, message: `Build failed: ${msg}` };
      }
    }
    return { name: 'build_step', passed: true, message: 'No build script (static project)' };
  } catch {
    return { name: 'build_step', passed: true, message: 'No build step (static project)' };
  }
}

async function runBrowserValidation(projectDir: string, projectType?: string): Promise<ValidationCheck> {
  if (projectType !== 'game') {
    return { name: 'browser_validation', passed: true, message: 'Skipped (not a game)' };
  }
  const result = await validateGameInBrowser(projectDir);
  return {
    name: 'browser_validation',
    passed: result.playable,
    message: result.playable
      ? `Browser validation passed (${result.score}/100)`
      : `Browser validation failed: ${result.errors.slice(0, 2).join('; ')}`,
  };
}

function runMonetizationCheck(projectDir: string, platform: string): ValidationCheck {
  const result = checkMonetizationReadiness(projectDir, platform);
  return {
    name: 'monetization_readiness',
    passed: result.score >= 50,
    message: `Monetization readiness: ${result.score}/100 (${result.monetizable ? 'OK' : 'Low'})`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub Pages Strategy
// ─────────────────────────────────────────────────────────────────────────────

const githubPagesStrategy: DeployStrategy = {
  name: 'github-pages',
  label: 'GitHub Pages',

  async checkPrerequisites(projectDir: string): Promise<PrerequisiteResult> {
    const checks: PrerequisiteCheck[] = [];

    // Check git repo
    const isGitRepo = existsSync(join(projectDir, '.git'));
    checks.push({
      name: 'git_repo',
      passed: isGitRepo,
      required: false,
      message: isGitRepo ? 'Git repository detected' : 'No git repo — will need `git init && git push`',
    });

    // Check GitHub CLI (optional but nice)
    const hasGh = hasCliTool('gh');
    checks.push({
      name: 'gh_cli',
      passed: hasGh,
      required: false,
      message: hasGh ? 'GitHub CLI (gh) available' : 'GitHub CLI not installed — manual push required',
    });

    // Check deploy workflow exists
    const hasWorkflow = existsSync(join(projectDir, '.github/workflows/deploy.yml'));
    checks.push({
      name: 'deploy_workflow',
      passed: hasWorkflow,
      required: true,
      message: hasWorkflow
        ? 'GitHub Actions workflow found'
        : 'Missing .github/workflows/deploy.yml — AI should have generated this',
    });

    // Check GitHub credentials (optional)
    const hasGhCreds = hasPlatformCredentials('github-sponsors'); // re-use presence as proxy
    checks.push({
      name: 'github_auth',
      passed: hasGh || hasGhCreds,
      required: false,
      message: hasGh || hasGhCreds ? 'GitHub auth available' : 'No GitHub auth — will need manual push',
    });

    const ready = checks.filter((c) => c.required).every((c) => c.passed);
    return { ready, checks };
  },

  async validateProject(projectDir: string, projectType?: string): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    const staticResult = validateTaskOutput(projectDir, 'github-pages');
    checks.push({
      name: 'static_validation',
      passed: staticResult.valid,
      message: staticResult.valid ? 'Static checks passed' : `Issues: ${staticResult.issues.slice(0, 3).join('; ')}`,
    });

    checks.push(runBuildStep(projectDir));
    checks.push(await runBrowserValidation(projectDir, projectType));
    checks.push(runMonetizationCheck(projectDir, 'web'));

    const passed = checks.filter((c) => c.passed).length;
    const score = Math.round((passed / checks.length) * 100);
    const valid = score >= 60;
    return { valid, score, checks };
  },

  async deploy(projectDir: string, opts: DeployOptions): Promise<DeployResult> {
    if (opts.dryRun) {
      return {
        success: true,
        platform: 'github-pages',
        message: '[DRY-RUN] Would push to GitHub and trigger GitHub Actions workflow',
        dryRun: true,
      };
    }

    // Try to use gh CLI for one-command deploy
    if (hasCliTool('gh')) {
      try {
        const remoteUrl = execSync('git remote get-url origin', { cwd: projectDir, encoding: 'utf-8', stdio: 'pipe' }).trim();
        if (!remoteUrl) {
          return {
            success: false,
            platform: 'github-pages',
            message: 'No GitHub remote configured. Run: gh repo create && git push -u origin main',
            dryRun: false,
          };
        }
        // Push and trigger workflow
        execSync('git add -A && git commit -m "Deploy via kele" || true && git push', {
          cwd: projectDir,
          stdio: opts.verbose ? 'inherit' : 'pipe',
          timeout: 120000,
        });
        return {
          success: true,
          platform: 'github-pages',
          message: 'Pushed to GitHub. GitHub Actions will deploy to Pages.',
          dryRun: false,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          success: false,
          platform: 'github-pages',
          message: `Git push failed: ${msg}`,
          dryRun: false,
        };
      }
    }

    return {
      success: false,
      platform: 'github-pages',
      message: 'GitHub CLI (gh) not installed. Install it or push manually:\n  git remote add origin <url>\n  git push -u origin main',
      dryRun: false,
    };
  },

  getDeployGuide(projectDir: string): string {
    return `
🚀 GitHub Pages 部署指南
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: 初始化 Git 仓库（如果还没有）
   cd ${projectDir}
   git init
   git add -A
   git commit -m "Initial commit"

Step 2: 创建 GitHub 仓库
   gh repo create my-project --public --source=. --push
   # 或手动在 GitHub 创建仓库后：
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main

Step 3: 启用 GitHub Pages
   - 打开仓库 Settings → Pages
   - Source: GitHub Actions
   - 确认 .github/workflows/deploy.yml 已提交

Step 4: 等待部署完成
   - Actions 标签页查看构建状态
   - 部署成功后访问 https://<user>.github.io/<repo>/

💰 变现: 将 ads.txt 放到域名根目录，替换 AdSense 占位 ID
`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// WeChat Mini Program Strategy
// ─────────────────────────────────────────────────────────────────────────────

const wechatStrategy: DeployStrategy = {
  name: 'wechat-miniprogram',
  label: '微信小游戏',

  async checkPrerequisites(projectDir: string): Promise<PrerequisiteResult> {
    const checks: PrerequisiteCheck[] = [];

    const hasCli = hasCliTool('cli'); // WeChat devtool CLI
    checks.push({
      name: 'wechat_devtool_cli',
      passed: hasCli,
      required: true,
      message: hasCli
        ? '微信开发者工具 CLI (cli) 可用'
        : '未安装微信开发者工具 CLI。下载: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html',
    });

    const hasProjectConfig = existsSync(join(projectDir, 'project.config.json'));
    checks.push({
      name: 'project_config',
      passed: hasProjectConfig,
      required: true,
      message: hasProjectConfig ? 'project.config.json 存在' : '缺少 project.config.json',
    });

    const hasGameJson = existsSync(join(projectDir, 'game.json'));
    checks.push({
      name: 'game_json',
      passed: hasGameJson,
      required: true,
      message: hasGameJson ? 'game.json 存在' : '缺少 game.json',
    });

    const creds = getPlatformCredentials('wechat-miniprogram');
    const hasAppId = !!creds?.appId;
    checks.push({
      name: 'appid_configured',
      passed: hasAppId,
      required: false,
      message: hasAppId ? `AppID: ${creds!.appId}` : '未配置 AppID — 设置: kele secrets --platform wechat-miniprogram --set appId=wx...',
    });

    const ready = checks.filter((c) => c.required).every((c) => c.passed);
    return { ready, checks };
  },

  async validateProject(projectDir: string, _projectType?: string): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    const staticResult = validateTaskOutput(projectDir, 'wechat-miniprogram');
    checks.push({
      name: 'static_validation',
      passed: staticResult.valid,
      message: staticResult.valid ? '静态检查通过' : `问题: ${staticResult.issues.slice(0, 3).join('; ')}`,
    });

    // WeChat games don't run in browser, skip browser validation
    checks.push({
      name: 'browser_validation',
      passed: true,
      message: 'Skipped (WeChat mini-game)',
    });

    checks.push(runMonetizationCheck(projectDir, 'wechat-miniprogram'));

    const passed = checks.filter((c) => c.passed).length;
    const score = Math.round((passed / checks.length) * 100);
    const valid = score >= 60;
    return { valid, score, checks };
  },

  async deploy(projectDir: string, opts: DeployOptions): Promise<DeployResult> {
    if (opts.dryRun) {
      return {
        success: true,
        platform: 'wechat-miniprogram',
        message: '[DRY-RUN] Would upload code to WeChat using: cli -u <version>@<projectDir> --upload-desc "kele deploy"',
        dryRun: true,
      };
    }

    if (!hasCliTool('cli')) {
      return {
        success: false,
        platform: 'wechat-miniprogram',
        message: '微信开发者工具 CLI 未安装。请下载安装后再部署。',
        dryRun: false,
      };
    }

    const creds = getPlatformCredentials('wechat-miniprogram');
    const appId = creds?.appId;

    // We use the CLI upload command
    // cli -u <version>@<projectDir> --upload-desc "kele deploy"
    try {
      const version = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '01';
      const cmd = `cli -u ${version}@${projectDir} --upload-desc "kele deploy"`;
      if (appId) {
        // CLI may need appid passed differently depending on version
      }
      const output = execSync(cmd, { stdio: opts.verbose ? 'inherit' : 'pipe', encoding: 'utf-8', timeout: 300000 });
      return {
        success: true,
        platform: 'wechat-miniprogram',
        message: '代码已上传到微信后台，请在微信公众平台提交审核。',
        output: output.slice(0, 500),
        dryRun: false,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        platform: 'wechat-miniprogram',
        message: `上传失败: ${msg}`,
        dryRun: false,
      };
    }
  },

  getDeployGuide(projectDir: string): string {
    return `
🚀 微信小游戏部署指南
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: 安装微信开发者工具
   https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

Step 2: 配置 AppID
   kele secrets --platform wechat-miniprogram --set appId=wx123456789

Step 3: 导入项目
   打开微信开发者工具 → 导入 ${projectDir}
   或命令行: cli -o ${projectDir}

Step 4: 上传代码
   cli -u 20260101@${projectDir} --upload-desc "kele deploy"

Step 5: 提交审核
   登录 mp.weixin.qq.com → 版本管理 → 提交审核

⚠️  注意：
   - 个人主体无法接入支付
   - 上架需软著 + ICP备案（AI代码需人工改造后才能申请软著）
   - 可先部署为H5网页游戏积累用户
`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// itch.io Strategy
// ─────────────────────────────────────────────────────────────────────────────

const itchioStrategy: DeployStrategy = {
  name: 'itchio',
  label: 'itch.io',

  async checkPrerequisites(projectDir: string): Promise<PrerequisiteResult> {
    const checks: PrerequisiteCheck[] = [];

    const hasButler = hasCliTool('butler');
    checks.push({
      name: 'butler_cli',
      passed: hasButler,
      required: true,
      message: hasButler
        ? 'butler CLI 可用'
        : '未安装 butler。安装: https://itch.io/docs/butler/installing.html',
    });

    const hasItchToml = existsSync(join(projectDir, '.itch.toml'));
    checks.push({
      name: 'itch_toml',
      passed: hasItchToml,
      required: false,
      message: hasItchToml ? '.itch.toml 存在' : '无 .itch.toml（可选）',
    });

    const creds = getPlatformCredentials('itchio');
    const hasApiKey = !!creds?.apiKey;
    checks.push({
      name: 'itchio_api_key',
      passed: hasApiKey,
      required: false,
      message: hasApiKey ? 'itch.io API Key 已配置' : '未配置 API Key — 设置: kele secrets --platform itchio --set apiKey=xxx',
    });

    const ready = checks.filter((c) => c.required).every((c) => c.passed);
    return { ready, checks };
  },

  async validateProject(projectDir: string, projectType?: string): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    const staticResult = validateTaskOutput(projectDir, 'itchio');
    checks.push({
      name: 'static_validation',
      passed: staticResult.valid,
      message: staticResult.valid ? '静态检查通过' : `问题: ${staticResult.issues.slice(0, 3).join('; ')}`,
    });

    checks.push(runBuildStep(projectDir));
    checks.push(await runBrowserValidation(projectDir, projectType));
    checks.push(runMonetizationCheck(projectDir, 'web'));

    const passed = checks.filter((c) => c.passed).length;
    const score = Math.round((passed / checks.length) * 100);
    const valid = score >= 60;
    return { valid, score, checks };
  },

  async deploy(projectDir: string, opts: DeployOptions): Promise<DeployResult> {
    if (opts.dryRun) {
      return {
        success: true,
        platform: 'itchio',
        message: '[DRY-RUN] Would run: butler push <projectDir> <user>/<project>:html',
        dryRun: true,
      };
    }

    if (!hasCliTool('butler')) {
      return {
        success: false,
        platform: 'itchio',
        message: 'butler CLI 未安装。安装: https://itch.io/docs/butler/installing.html',
        dryRun: false,
      };
    }

    // Try to infer itch username/project from package.json or directory name
    let itchUser = 'YOUR_ITCH_USERNAME';
    let itchProject = 'YOUR_PROJECT';
    try {
      const pkgPath = join(projectDir, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        itchProject = pkg.name || itchProject;
      }
    } catch { /* ignore */ }

    const cmd = `butler push "${projectDir}" ${itchUser}/${itchProject}:html`;

    return {
      success: false,
      platform: 'itchio',
      message: `请在 itch.io 创建项目后运行:\n  ${cmd}\n\n或者设置项目名后重试。`,
      command: cmd,
      dryRun: false,
    };
  },

  getDeployGuide(_projectDir: string): string {
    return `
🚀 itch.io 部署指南
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: 安装 butler
   https://itch.io/docs/butler/installing.html

Step 2: 登录 butler
   butler login

Step 3: 在 itch.io 创建项目
   https://itch.io/game/new
   选择 "HTML" 类型

Step 4: 推送构建
   butler push "${_projectDir}" <username>/<project>:html

Step 5: 设置价格（可选）
   - 在 itch.io 后台设置售价或接受捐赠
   - 建议 also enable "Name your own price"

💰 收益：itch.io 抽成 0%（除非你选择加入），PayPal/Payoneer 提现
`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// VPS Strategy
// ─────────────────────────────────────────────────────────────────────────────

const vpsStrategy: DeployStrategy = {
  name: 'vps',
  label: 'VPS / 自建服务器',

  async checkPrerequisites(_projectDir: string): Promise<PrerequisiteResult> {
    const checks: PrerequisiteCheck[] = [];

    const hasRsync = hasCliTool('rsync');
    checks.push({
      name: 'rsync',
      passed: hasRsync,
      required: true,
      message: hasRsync ? 'rsync 可用' : '未安装 rsync',
    });

    const hasSsh = hasCliTool('ssh');
    checks.push({
      name: 'ssh',
      passed: hasSsh,
      required: true,
      message: hasSsh ? 'ssh 可用' : '未安装 ssh',
    });

    const creds = getPlatformCredentials('vps');
    const hasHost = !!creds?.host;
    checks.push({
      name: 'vps_host',
      passed: hasHost,
      required: false,
      message: hasHost ? `服务器: ${creds!.host}` : '未配置服务器地址 — 设置: kele secrets --platform vps --set host=user@server.com,path=/var/www/html',
    });

    const ready = checks.filter((c) => c.required).every((c) => c.passed);
    return { ready, checks };
  },

  async validateProject(projectDir: string, projectType?: string): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];

    const staticResult = validateTaskOutput(projectDir, 'vps');
    checks.push({
      name: 'static_validation',
      passed: staticResult.valid,
      message: staticResult.valid ? '静态检查通过' : `问题: ${staticResult.issues.slice(0, 3).join('; ')}`,
    });

    checks.push(runBuildStep(projectDir));
    checks.push(await runBrowserValidation(projectDir, projectType));
    checks.push(runMonetizationCheck(projectDir, 'web'));

    const passed = checks.filter((c) => c.passed).length;
    const score = Math.round((passed / checks.length) * 100);
    const valid = score >= 60;
    return { valid, score, checks };
  },

  async deploy(projectDir: string, opts: DeployOptions): Promise<DeployResult> {
    if (opts.dryRun) {
      return {
        success: true,
        platform: 'vps',
        message: '[DRY-RUN] Would run: rsync -avz --delete <projectDir>/ <host>:<path>/',
        dryRun: true,
      };
    }

    const creds = getPlatformCredentials('vps');
    const host = creds?.host;
    const path = creds?.path || '/var/www/html';

    if (!host) {
      return {
        success: false,
        platform: 'vps',
        message: '未配置 VPS 信息。设置: kele secrets --platform vps --set host=user@server.com,path=/var/www/html',
        dryRun: false,
      };
    }

    try {
      const cmd = `rsync -avz --delete "${projectDir}/" "${host}:${path}/"`;
      const output = execSync(cmd, { stdio: opts.verbose ? 'inherit' : 'pipe', encoding: 'utf-8', timeout: 300000 });
      return {
        success: true,
        platform: 'vps',
        message: `已同步到 ${host}:${path}`,
        output: output.slice(0, 500),
        dryRun: false,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        platform: 'vps',
        message: `rsync 失败: ${msg}`,
        dryRun: false,
      };
    }
  },

  getDeployGuide(_projectDir: string): string {
    return `
🚀 VPS 部署指南
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: 配置服务器信息
   kele secrets --platform vps --set host=user@your-server.com,path=/var/www/html

Step 2: 确保 SSH 免密登录
   ssh-copy-id user@your-server.com

Step 3: 确保目标目录可写
   ssh user@your-server.com "mkdir -p /var/www/html && chown \$USER /var/www/html"

Step 4: 部署
   kele deploy <project-id> vps

可选：配置 Nginx
   server {
     listen 80;
     server_name your-domain.com;
     root /var/www/html;
     index index.html;
     location / { try_files \$uri \$uri/ /index.html; }
   }

💰 变现: 自托管 AdSense、affiliate、付费墙均可
`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Registry
// ─────────────────────────────────────────────────────────────────────────────

const STRATEGIES: Record<string, DeployStrategy> = {
  'github-pages': githubPagesStrategy,
  'wechat-miniprogram': wechatStrategy,
  'itchio': itchioStrategy,
  'vps': vpsStrategy,
};

export function getDeployStrategy(platform: string): DeployStrategy | undefined {
  return STRATEGIES[platform];
}

export function listDeployPlatforms(): string[] {
  return Object.keys(STRATEGIES);
}

export function detectPlatformFromProject(monetization: string): string | undefined {
  switch (monetization) {
    case 'web':
      return 'github-pages';
    case 'wechat-miniprogram':
      return 'wechat-miniprogram';
    case 'douyin':
      return undefined; // not supported by deploy command yet
    case 'itchio':
      return 'itchio';
    case 'discord-bot':
    case 'telegram-bot':
      return 'vps';
    default:
      return undefined;
  }
}
