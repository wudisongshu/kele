/**
 * kele delete — delete a project and all its data.
 */

import { Command } from 'commander';
import { rmSync } from 'fs';
import { KeleDatabase } from '../../db/index.js';
import { debugLog } from '../../debug.js';

export function setupDeleteCommand(program: Command): void {
  program
    .command('delete')
    .argument('<project-id>', 'Project ID to delete')
    .description('Delete a project and all its data')
    .option('--force', 'Skip confirmation and delete project files too', false)
    .action((projectId: string, opts: { force?: boolean }) => {
      const db = new KeleDatabase();
      const project = db.getProject(projectId);

      if (!project) {
        console.error(`❌ 项目不存在: ${projectId}`);
        console.log('   用 kele list 查看所有项目');
        process.exit(1);
      }

      if (!opts.force) {
        console.log(`⚠️  即将删除项目: ${project.name}`);
        console.log(`   ID: ${project.id}`);
        console.log(`   目录: ${project.rootDir}`);
        console.log();
      }

      db.deleteProject(projectId);

      if (opts.force) {
        try {
          rmSync(project.rootDir, { recursive: true, force: true });
          console.log(`✅ 项目已彻底删除: ${project.name}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          debugLog(`Delete rm failed: ${project.rootDir}`, msg);
          console.log(`✅ 数据库记录已删除，但文件清理失败: ${project.rootDir}`);
        }
      } else {
        console.log(`✅ 项目已删除: ${project.name}`);
        console.log(`   💡 提示: 项目文件仍保留在 ${project.rootDir}`);
        console.log(`      如需彻底清理，请手动删除该目录。`);
      }
    });
}
