/**
 * kele doctor — diagnose environment and configuration.
 */

import { Command } from 'commander';
import { hasAnyProvider, loadConfig } from '../../config/manager.js';
import { execSync } from 'child_process';

function hasGit(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function setupDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('检查环境配置和诊断问题')
    .action(async () => {
      console.log('🔍 kele 诊断报告\n');

      // Node version
      const nodeVersion = process.version;
      const nodeOk = nodeVersion.startsWith('v20') || nodeVersion.startsWith('v22') || nodeVersion.startsWith('v18');
      console.log(`${nodeOk ? '✅' : '⚠️'} Node.js: ${nodeVersion}`);

      // Git
      const gitInstalled = hasGit();
      console.log(`${gitInstalled ? '✅' : '❌'} git: ${gitInstalled ? '已安装' : '未安装'}`);

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

      // GitHub Pages config
      const hasGhToken = !!config.github?.token;
      const hasGhRepo = !!config.github?.repo;
      console.log(`\n${hasGhToken ? '✅' : '❌'} GitHub token: ${hasGhToken ? '已配置' : '未配置'}`);
      console.log(`${hasGhRepo ? '✅' : '⚠️'} GitHub repo: ${hasGhRepo ? config.github!.repo : '使用默认 wudisongshu/kele-games'}`);

      if (hasGhToken && hasGhRepo) {
        console.log('⚠️  建议运行 kele deploy <project-id> --platform github-pages 验证 token 是否有效');
      }

      console.log(`\n${hasAnyProvider() ? '✅' : '⚠️'} 总体状态: ${hasAnyProvider() ? 'Ready' : '需要配置 provider'}`);
    });
}
