/**
 * kele list — list all projects.
 */

import { Command } from 'commander';
import { basename } from 'path';
import { ProjectManager } from '../../project/manager.js';

function isTestProject(rootDir: string): boolean {
  return rootDir.includes('/tmp/') || rootDir.includes('/var/folders/');
}

function formatTypeLabel(p: { type?: string; pages?: string }): string {
  if (p.type === 'complex') {
    let pageCount = 0;
    try {
      const parsed = JSON.parse(p.pages || '[]') as unknown[];
      pageCount = parsed.length;
    } catch {
      // ignore
    }
    return `多页面产品 (${pageCount} 页)`;
  }
  return '单文件游戏';
}

export function setupListCommand(program: Command): void {
  program
    .command('list')
    .description('列出所有项目')
    .option('-a, --all', '显示 /tmp 下的测试项目', false)
    .action((options: { all?: boolean }) => {
      const pm = new ProjectManager();
      let projects = pm.list();
      pm.close();

      const totalCount = projects.length;

      if (!options.all) {
        projects = projects.filter((p) => !isTestProject(p.rootDir));
      }

      if (projects.length === 0) {
        if (totalCount > 0) {
          console.log(`暂无项目（隐藏了 ${totalCount} 个测试项目，加 --all 查看）`);
        } else {
          console.log('暂无项目。用 kele "<你的想法>" 创建一个！');
        }
        return;
      }

      const hiddenCount = totalCount - projects.length;
      const suffix = hiddenCount > 0 ? `（隐藏 ${hiddenCount} 个测试项目）` : '';
      console.log(`项目列表 (${projects.length} 个)${suffix}\n`);
      for (const p of projects) {
        const icon = p.status === 'completed' ? '✅' : p.status === 'failed' ? '❌' : '⏳';
        const typeIcon = p.type === 'complex' ? '🏗️' : '🎮';
        const slug = basename(p.rootDir);
        console.log(`  ${icon} ${typeIcon} ${slug} (${p.id})`);
        console.log(`     ${p.name}`);
        console.log(`     类型: ${formatTypeLabel(p)}`);
        if (p.prompt && p.prompt !== p.name) {
          console.log(`     Prompt: ${p.prompt}`);
        }
        console.log(`     目录: ${p.rootDir}`);
        console.log();
      }
    });
}
