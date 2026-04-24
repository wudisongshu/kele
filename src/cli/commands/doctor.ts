/**
 * kele doctor — diagnose environment and configuration.
 */

import { Command } from 'commander';
import { hasAnyProvider, loadConfig } from '../../config/manager.js';

export function setupDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check setup and diagnose issues')
    .action(async () => {
      console.log('🔍 kele 诊断报告\n');

      // Node version
      const nodeVersion = process.version;
      const nodeOk = nodeVersion.startsWith('v20') || nodeVersion.startsWith('v22') || nodeVersion.startsWith('v18');
      console.log(`${nodeOk ? '✅' : '⚠️'} Node.js: ${nodeVersion}`);

      // Config
      const config = loadConfig();
      const providerCount = Object.keys(config.providers).length;
      console.log(`${providerCount > 0 ? '✅' : '❌'} 已配置 provider: ${providerCount} 个`);

      if (providerCount > 0) {
        for (const [name] of Object.keys(config.providers)) {
          try {
            const { createRouterFromConfig } = await import('../../ai/router.js');
            const router = createRouterFromConfig();
            const adapter = router.get(name);
            if (adapter) {
              const result = await adapter.testConnection();
              console.log(`  ${result.ok ? '✅' : '❌'} ${name}: ${result.ok ? '连接正常' : result.error}`);
            }
          } catch (e) {
            console.log(`  ❌ ${name}: 测试连接失败`);
          }
        }
      }

      console.log(`\n${hasAnyProvider() ? '✅' : '⚠️'} 总体状态: ${hasAnyProvider() ? 'Ready' : '需要配置 provider'}`);
    });
}
