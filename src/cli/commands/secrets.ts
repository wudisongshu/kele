/**
 * kele secrets — manage platform deployment credentials.
 */

import { Command } from 'commander';
import {
  setPlatformCredentials,
  getPlatformCredentials,
  hasPlatformCredentials,
  PLATFORM_FIELDS,
  getCredentialPrompt,
} from '../../platform-credentials.js';

export function setupSecretsCommand(program: Command): void {
  program
    .command('secrets')
    .description('Manage platform deployment credentials')
    .option('--platform <name>', 'Platform name (wechat-miniprogram, douyin, steam, app-store, google-play)')
    .option('--set <kvs>', 'Set credentials as key=value,key2=value2')
    .action((options: { platform?: string; set?: string }) => {
      if (!options.platform) {
        console.log('🥤 平台凭证管理\n');
        console.log('已配置的平台：');
        for (const platform of Object.keys(PLATFORM_FIELDS)) {
          const ok = hasPlatformCredentials(platform);
          console.log(`  ${ok ? '✅' : '❌'} ${platform}`);
        }
        console.log('\n设置凭证：');
        console.log('  kele secrets --platform wechat-miniprogram --set appId=wx123456789,appSecret=xxx');
        console.log('  kele secrets --platform douyin --set appId=tt123456');
        return;
      }

      if (options.set) {
        const creds: Record<string, string> = {};
        const pairs = options.set.split(',');
        for (const pair of pairs) {
          const [k, v] = pair.split('=');
          if (k && v !== undefined) {
            creds[k.trim()] = v.trim();
          }
        }
        setPlatformCredentials(options.platform, creds);
        console.log(`✅ 已设置 ${options.platform} 凭证`);
        return;
      }

      // Show current credentials (masked)
      const creds = getPlatformCredentials(options.platform);
      if (!creds) {
        console.log(`❌ ${options.platform} 暂无凭证`);
        console.log(getCredentialPrompt(options.platform));
        return;
      }

      console.log(`${options.platform} 凭证：`);
      for (const [k, v] of Object.entries(creds)) {
        const display = v.length > 8 ? v.slice(0, 4) + '****' + v.slice(-4) : '****';
        console.log(`  ${k}: ${display}`);
      }
    });
}
