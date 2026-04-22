#!/usr/bin/env node

import { Command } from 'commander';
import { version } from './utils.js';
import { setupCreateCommand } from './commands/create.js';
import { setupConfigCommand } from './commands/config.js';
import { setupListCommand } from './commands/list.js';
import { setupDeleteCommand } from './commands/delete.js';
import { setupShowCommand } from './commands/show.js';
import { setupUpgradeCommand } from './commands/upgrade.js';
import { setupSearchCommand } from './commands/search.js';
import { setupRetryCommand } from './commands/retry.js';
import { setupValidateCommand } from './commands/validate.js';
import { setupSecretsCommand } from './commands/secrets.js';
import { setupDoctorCommand } from './commands/doctor.js';
import { setupCleanCommand } from './commands/clean.js';
import { setupExportCommand } from './commands/export.js';
import { setupInitCommand } from './commands/init.js';
import { setupLogsCommand } from './commands/logs.js';
import { setupStatsCommand } from './commands/stats.js';
import { setupChatCommand } from './commands/chat.js';
import { setupDeployCommand } from './commands/deploy.js';

const program = new Command();

program
  .name('kele')
  .description(`kele v${version} — Idea-to-Monetization AI workflow engine\n\n` +
    `Examples:\n` +
    `  $ kele "做一个塔防游戏"                    # Create a new game\n` +
    `  $ kele "做一个塔防游戏" --mock --yes       # Fast mock mode\n` +
    `  $ kele list                               # List all projects\n` +
    `  $ kele doctor                             # Check setup\n` +
    `  $ kele upgrade <project> <task> "改像素风"  # Upgrade a task\n` +
    `  $ kele retry <project> <task>             # Retry failed task\n` +
    `  $ kele delete <project>                   # Delete a project\n` +
    `  $ kele export <project> [dir]             # Export project files\n` +
    `  $ kele deploy <project> [platform]        # Deploy to production\n` +
    `  $ kele chat [project-id]                  # Interactive chat mode`)
  .version(`${version} (Node ${process.version}, TS 5.9.3, ${process.platform})`, '-v, --version', 'Display version number');

// Register all commands
setupCreateCommand(program);
setupConfigCommand(program);
setupListCommand(program);
setupDeleteCommand(program);
setupShowCommand(program);
setupUpgradeCommand(program);
setupSearchCommand(program);
setupRetryCommand(program);
setupValidateCommand(program);
setupSecretsCommand(program);
setupDoctorCommand(program);
setupCleanCommand(program);
setupExportCommand(program);
setupInitCommand(program);
setupLogsCommand(program);
setupStatsCommand(program);
setupDeployCommand(program);
setupChatCommand(program);

program.parse();
