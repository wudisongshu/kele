/**
 * kele show — show project details.
 */

import { Command } from 'commander';
import { ProjectManager } from '../../project/manager.js';

export function setupShowCommand(program: Command): void {
  program
    .command('show <id>')
    .description('查看项目详情和部署历史')
    .action((id: string) => {
      const pm = new ProjectManager();
      const project = pm.findByIdentifier(id);
      pm.close();

      if (!project) {
        console.log(`❌ 未找到项目: ${id}`);
        return;
      }

      const typeLabel = project.type === 'complex' ? '多页面产品' : '单文件游戏';
      console.log(`项目: ${project.name}`);
      console.log(`类型: ${typeLabel}`);
      if (project.prompt && project.prompt !== project.name) {
        console.log(`Prompt: ${project.prompt}`);
      }
      console.log(`ID: ${project.id}`);
      console.log(`描述: ${project.description}`);
      console.log(`状态: ${project.status}`);
      console.log(`目录: ${project.rootDir}`);
      console.log(`创建时间: ${project.createdAt}`);

      if (project.type === 'complex' && project.pages) {
        try {
          const pages = JSON.parse(project.pages) as Array<{ name: string; fileName: string }>;
          console.log(`\n子页面 (${pages.length} 个):`);
          for (const p of pages) {
            console.log(`  - ${p.name} (${p.fileName})`);
          }
        } catch {
          // ignore malformed pages JSON
        }
      }

      if (project.deployments.length > 0) {
        console.log('\n部署历史:');
        for (const d of project.deployments) {
          const time = new Date(d.deployedAt).toLocaleString('zh-CN');
          console.log(`  - ${d.platform}: ${d.url}`);
          console.log(`    时间: ${time}`);
        }
      }
    });
}
