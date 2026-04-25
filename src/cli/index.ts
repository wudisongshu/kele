#!/usr/bin/env node

import { Command } from 'commander';
import { setupCreateCommand } from './commands/create.js';
import { setupListCommand } from './commands/list.js';
import { setupShowCommand } from './commands/show.js';
import { setupConfigCommand } from './commands/config.js';
import { setupValidateCommand } from './commands/validate.js';
import { setupDoctorCommand } from './commands/doctor.js';
import { setupDeployCommand } from './commands/deploy.js';
import { setupUndeployCommand } from './commands/undeploy.js';
import { setupPlatformsCommand } from './commands/platforms.js';
import { setupRenameCommand } from './commands/rename.js';
import { setupDeleteCommand } from './commands/delete.js';

const program = new Command();

program
  .name('kele')
  .description('kele — Idea-to-Game AI engine\n\nExamples:\n  $ kele "做一个贪吃蛇游戏"\n  $ kele "做一个贪吃蛇游戏" --mock --yes\n  $ kele list\n  $ kele doctor')
  .version('0.3.0', '-v, --version', 'Display version number');

setupCreateCommand(program);
setupListCommand(program);
setupShowCommand(program);
setupConfigCommand(program);
setupValidateCommand(program);
setupDoctorCommand(program);
setupDeployCommand(program);
setupUndeployCommand(program);
setupPlatformsCommand(program);
setupRenameCommand(program);
setupDeleteCommand(program);

program.parse();
