/**
 * kele config — manage configuration.
 */

import { Command } from 'commander';
import {
  setProvider,
  removeProvider,
  setDefaultProvider,
  getConfigSummary,
  setOutputDir,
  setAutoYes,
  setDefaultPlatform,
  setGitHubConfig,
  setVercelConfig,
  setNetlifyConfig,
} from '../../config/manager.js';

export function setupConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('管理 kele 配置（AI Provider、部署平台等）');

  configCmd
    .option('--provider <name>', 'Provider name')
    .option('--key <key>', 'API key')
    .option('--url <url>', 'Base URL')
    .option('--model <model>', 'Model name')
    .option('--remove <name>', 'Remove a provider')
    .option('--default <name>', 'Set default provider')
    .option('--output <dir>', 'Set output directory')
    .option('--auto-yes', 'Enable auto-yes mode')
    .option('--deploy-platform <name>', 'Set default deploy platform')
    .option('--github-repo <repo>', 'Set GitHub repo (owner/repo)')
    .option('--github-token <token>', 'Set GitHub token')
    .option('--vercel-token <token>', 'Set Vercel token')
    .option('--netlify-token <token>', 'Set Netlify token')
    .option('--netlify-site <id>', 'Set Netlify site ID')
    .option('--list', 'List current config')
    .action((options: {
      provider?: string;
      key?: string;
      url?: string;
      model?: string;
      remove?: string;
      default?: string;
      output?: string;
      autoYes?: boolean;
      deployPlatform?: string;
      githubRepo?: string;
      githubToken?: string;
      vercelToken?: string;
      netlifyToken?: string;
      netlifySite?: string;
      list?: boolean;
    }) => {
      if (options.list) {
        console.log(getConfigSummary());
        return;
      }

      if (options.deployPlatform) {
        setDefaultPlatform(options.deployPlatform);
        console.log(`✅ 默认部署平台已设置为: ${options.deployPlatform}`);
        return;
      }

      if (options.githubRepo || options.githubToken) {
        setGitHubConfig(options.githubRepo, options.githubToken);
        console.log('✅ GitHub 配置已更新');
        return;
      }

      if (options.vercelToken) {
        setVercelConfig(options.vercelToken);
        console.log('✅ Vercel 配置已更新');
        return;
      }

      if (options.netlifyToken || options.netlifySite) {
        setNetlifyConfig(options.netlifyToken, options.netlifySite);
        console.log('✅ Netlify 配置已更新');
        return;
      }

      if (options.remove) {
        removeProvider(options.remove);
        console.log(`✅ 已移除 provider: ${options.remove}`);
        return;
      }

      if (options.default) {
        setDefaultProvider(options.default);
        console.log(`✅ 默认 provider 已设置为: ${options.default}`);
        return;
      }

      if (options.output) {
        setOutputDir(options.output);
        console.log(`✅ 输出目录已设置为: ${options.output}`);
        return;
      }

      if (options.autoYes) {
        setAutoYes(true);
        console.log('✅ 已启用自动确认模式');
        return;
      }

      if (options.provider && options.key && options.url && options.model) {
        setProvider(options.provider, {
          apiKey: options.key,
          baseURL: options.url,
          model: options.model,
        });
        console.log(`✅ 已配置 provider: ${options.provider}`);
        console.log(`   model: ${options.model}`);
        console.log(`   url: ${options.url}`);
        return;
      }

      console.log('用法:');
      console.log('  kele config --provider <name> --key <key> --url <url> --model <model>');
      console.log('  kele config --default <name>');
      console.log('  kele config --remove <name>');
      console.log('  kele config --output <dir>');
      console.log('  kele config --deploy-platform <static|github-pages|vercel|netlify>');
      console.log('  kele config --github-repo <owner/repo>');
      console.log('  kele config --vercel-token <token>');
      console.log('  kele config --netlify-token <token>');
      console.log('  kele config --list');
    });
}
