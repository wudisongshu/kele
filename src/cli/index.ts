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
import { setupStatsCommand } from './commands/stats.js';

const program = new Command();

program
  .name('kele')
  .description(
    'kele — 一句话生成游戏，直接部署上线\n' +
    '\n' +
    '常用命令:\n' +
    '  $ kele "做个贪吃蛇游戏"                  生成游戏\n' +
    '  $ kele "..." --mock                      Mock 模式（不消耗 API）\n' +
    '  $ kele list                              列出所有项目\n' +
    '  $ kele show <项目ID>                      查看项目详情\n' +
    '  $ kele deploy <项目ID>                    部署到线上\n' +
    '  $ kele doctor                            检查环境和配置\n' +
    '  $ kele --help                            查看完整帮助'
  )
  .version('0.3.0', '-v, --version', '显示版本号');

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
setupStatsCommand(program);

// 在 --help 末尾添加完整的中文命令参考
program.addHelpText(
  'after',
  '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
  '【完整命令参考】\n' +
  '\n' +
  '🎮 创建游戏\n' +
  '  kele "<想法>"                          用 AI 生成游戏\n' +
  '  kele "<想法>" --mock                   Mock 模式（不调用真实 API）\n' +
  '  kele "<想法>" --deploy                 生成后立即部署\n' +
  '  kele "<想法>" --deploy github-pages    生成后部署到 GitHub Pages\n' +
  '  kele "<想法>" -o <目录>                指定输出目录\n' +
  '  kele "<想法>" --debug                  开启调试日志\n' +
  '\n' +
  '📂 项目管理\n' +
  '  kele list                              列出所有项目（默认隐藏测试项目）\n' +
  '  kele list --all                        列出全部项目（含测试项目）\n' +
  '  kele show <项目ID>                      查看项目详情、部署历史\n' +
  '  kele rename <项目ID> <新名字>            重命名项目（仅本地）\n' +
  '  kele delete <项目ID> --force            删除项目（文件 + 数据库）\n' +
  '  kele delete --keep-recent 3 --force     只保留最近 3 个项目\n' +
  '\n' +
  '🚀 部署管理\n' +
  '  kele deploy <项目ID>                    部署项目到线上\n' +
  '  kele deploy <项目ID> -p github-pages    指定部署到 GitHub Pages\n' +
  '  kele deploy --refresh                   重新生成导航页\n' +
  '  kele deploy --clean-orphans             清理本地已不存在的线上部署\n' +
  '  kele deploy --prune 5                   只保留最近 5 个部署\n' +
  '  kele deploy --clean-all                 清空所有线上部署（危险）\n' +
  '  kele undeploy <项目ID>                  从 GitHub Pages 撤下项目\n' +
  '  kele platforms                          查看支持的部署平台\n' +
  '\n' +
  '🔧 配置与诊断\n' +
  '  kele config --list                      查看当前配置\n' +
  '  kele config --provider <名> --key <密钥> --url <地址> --model <模型>\n' +
  '                                         配置 AI Provider\n' +
  '  kele config --default <provider>        设置默认 Provider\n' +
  '  kele config --github-repo <owner/repo>  设置 GitHub 仓库\n' +
  '  kele config --github-token <token>      设置 GitHub Token\n' +
  '  kele config --deploy-platform <平台>     设置默认部署平台\n' +
  '  kele doctor                             诊断环境和配置\n' +
  '  kele validate <项目ID>                  验证项目可玩性评分\n' +
  '  kele stats                              查看使用统计\n' +
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
);

program.parse();
