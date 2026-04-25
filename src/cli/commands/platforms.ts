/**
 * kele platforms — list supported deployment platforms and their status.
 */

import { Command } from 'commander';
import { getPlatformStatuses } from '../../deploy/index.js';

export function setupPlatformsCommand(program: Command): void {
  program
    .command('platforms')
    .description('List supported deployment platforms')
    .action(() => {
      console.log('支持的部署平台:\n');
      for (const status of getPlatformStatuses()) {
        const icon = status.available ? '✅' : '❌';
        console.log(`  ${icon} ${status.name}`);
        console.log(`     ${status.message}`);
        console.log();
      }
    });
}
