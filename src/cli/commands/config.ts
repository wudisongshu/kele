/**
 * kele config — manage AI provider configuration.
 */

import { Command } from 'commander';
import {
  setProvider,
  removeProvider,
  setDefaultProvider,
  getConfigSummary,
  setAutoYes,
  setTelemetryEnabled,
  setOutputDir,
  setDefaultPlatform,
} from '../../config/index.js';
import { collectHeaders, parseTimeout } from '../utils.js';

export function setupConfigCommand(program: Command): void {
  program
    .command('config')
    .description('Manage AI provider configuration')
    .option('--provider <name>', 'Provider name (e.g. kimi, deepseek, qwen)')
    .option('--key <apiKey>', 'API Key')
    .option('--url <baseURL>', 'Base URL for the API')
    .option('--model <model>', 'Model name')
    .option('--timeout <seconds>', 'Request timeout in seconds (default: 3000 = 50min)', parseTimeout)
    .option('--max-tokens <number>', 'Max tokens per response (default: 100000)', parseInt)
    .option('--header <header>', 'Extra header in key:value format (repeatable)', collectHeaders, {})
    .option('--default <name>', 'Set default provider')
    .option('--remove <name>', 'Remove a provider')
    .option('--auto-yes', 'Enable auto-confirm (skip all checkpoints)')
    .option('--no-auto-yes', 'Disable auto-confirm')
    .option('--telemetry', 'Enable telemetry collection')
    .option('--no-telemetry', 'Disable telemetry collection')
    .option('--output-dir <dir>', 'Set default output directory for projects')
    .option('--list', 'List all configured providers')
    .action((options: {
      provider?: string;
      key?: string;
      url?: string;
      model?: string;
      timeout?: number;
      maxTokens?: number;
      header?: Record<string, string>;
      default?: string;
      remove?: string;
      autoYes?: boolean;
      telemetry?: boolean;
      outputDir?: string;
      platform?: string;
      list?: boolean;
    }) => {
      if (options.list) {
        console.log('🥤 已配置的 Providers\n');
        console.log(getConfigSummary());
        return;
      }

      if (options.autoYes === true) {
        setAutoYes(true);
        console.log('✅ 已开启免确认模式（所有 checkpoint 自动通过）');
        return;
      }
      if (options.autoYes === false) {
        setAutoYes(false);
        console.log('✅ 已关闭免确认模式');
        return;
      }

      if (options.telemetry === true) {
        setTelemetryEnabled(true);
        console.log('✅ 已开启遥测数据收集');
        return;
      }
      if (options.telemetry === false) {
        setTelemetryEnabled(false);
        console.log('✅ 已关闭遥测数据收集');
        return;
      }

      if (options.outputDir) {
        setOutputDir(options.outputDir);
        console.log(`✅ 默认输出目录已设为: ${options.outputDir}`);
        return;
      }

      if (options.platform) {
        const validPlatforms = ['web', 'wechat-miniprogram', 'douyin', 'steam', 'app-store', 'google-play', 'discord-bot', 'telegram-bot', 'itchio', 'github-sponsors'];
        if (!validPlatforms.includes(options.platform)) {
          console.error(`❌ 无效的平台: ${options.platform}`);
          console.error(`   支持的平台: ${validPlatforms.join(', ')}`);
          process.exit(1);
        }
        setDefaultPlatform(options.platform);
        console.log(`✅ 默认变现平台已设为: ${options.platform}`);
        return;
      }

      if (!options.provider && !options.default && !options.remove) {
        console.log('🥤 kele 配置\n');
        console.log(getConfigSummary());
        console.log('\n添加 provider：');
        console.log('  kele config --provider kimi --key sk-xxx --url https://api.moonshot.cn/v1 --model moonshot-v1-128k');
        console.log('  kele config --provider kimi-code --key sk-xxx --url https://api.kimi.com/coding/v1 --model kimi-for-coding');
        console.log('  kele config --provider deepseek --key sk-xxx --url https://api.deepseek.com/v1 --model deepseek-chat');
        console.log('  kele config --provider qwen --key sk-xxx --url https://dashscope.aliyuncs.com/compatible-mode/v1 --model qwen-turbo');
        console.log('\n设置默认变现平台：');
        console.log('  kele config --platform web');
        console.log('  kele config --platform steam');
        console.log('\n免确认模式（跳过所有 checkpoint）：');
        console.log('  kele config --auto-yes');
        console.log('  kele config --no-auto-yes');
        return;
      }

      if (options.remove) {
        removeProvider(options.remove);
        console.log(`✅ 已移除 provider: ${options.remove}`);
        return;
      }

      if (options.default) {
        setDefaultProvider(options.default);
        console.log(`✅ 默认 provider 已设为: ${options.default}`);
        return;
      }

      if (options.provider) {
        if (!options.key || !options.url || !options.model) {
          console.error('❌ 添加 provider 需要提供 --key, --url, --model');
          process.exit(1);
        }

        setProvider(options.provider, {
          apiKey: options.key,
          baseURL: options.url,
          model: options.model,
          timeout: options.timeout,
          maxTokens: options.maxTokens,
          headers: options.header && Object.keys(options.header).length > 0 ? options.header : undefined,
        });

        console.log(`✅ 已配置 provider: ${options.provider}`);
        console.log(`   model: ${options.model}`);
        console.log(`   url: ${options.url}`);
      }
    });
}
