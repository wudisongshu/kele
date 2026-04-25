/**
 * kele delete — delete project(s).
 *
 * Usage:
 *   kele delete <id>          Delete a single project
 *   kele delete <id> --force  Skip confirmation
 *   kele delete --keep-recent 3 --force  Keep only 3 most recent projects
 */

import { Command } from 'commander';
import { existsSync, rmSync } from 'fs';
import { ProjectManager } from '../../project/manager.js';
import { error, success } from '../../utils/logger.js';

function isTestProject(rootDir: string): boolean {
  return rootDir.includes('/tmp/') || rootDir.includes('/var/folders/');
}

export function setupDeleteCommand(program: Command): void {
  program
    .command('delete [id]')
    .description('Delete a project or bulk clean old projects')
    .option('-f, --force', 'Skip confirmation', false)
    .option('--keep-recent <n>', 'Keep only the N most recent projects')
    .action(async (id: string | undefined, options: { force: boolean; keepRecent?: string }) => {
      const pm = new ProjectManager();

      // Bulk mode: --keep-recent
      if (options.keepRecent !== undefined) {
        const keepCount = parseInt(options.keepRecent, 10);
        if (Number.isNaN(keepCount) || keepCount < 0) {
          error('--keep-recent 必须是有效的非负整数');
          pm.close();
          process.exit(1);
        }

        await handleBulkDelete(pm, keepCount, options.force);
        pm.close();
        return;
      }

      // Single mode: require id
      if (!id) {
        error('请提供项目 ID，或使用 --keep-recent 批量清理');
        pm.close();
        process.exit(1);
      }

      const project = pm.findByIdentifier(id);
      if (!project) {
        error(`未找到项目: ${id}`);
        pm.close();
        process.exit(1);
      }

      // Show info and confirm
      if (!options.force) {
        console.log(`⚠️  即将删除项目: ${project.name} (${project.id})`);
        console.log(`   目录: ${project.rootDir}`);
        if (project.deployments.length > 0) {
          console.log(`   部署: ${project.deployments.map((d) => d.url).join(', ')}`);
        }
        console.log('\n   使用 --force 跳过确认');
        pm.close();
        process.exit(0);
      }

      // Execute delete
      await deleteProject(pm, project.id, project.rootDir);
      pm.close();
    });
}

async function handleBulkDelete(pm: ProjectManager, keepCount: number, force: boolean): Promise<void> {
  let projects = pm.list().filter((p) => !isTestProject(p.rootDir));

  // Sort by createdAt desc (newest first)
  projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (projects.length === 0) {
    console.log('📭 没有可删除的项目');
    return;
  }

  const toDelete = projects.slice(keepCount);
  if (toDelete.length === 0) {
    console.log(`✅ 共 ${projects.length} 个项目，无需清理`);
    return;
  }

  console.log(`⚠️  保留最近 ${keepCount} 个项目，将删除 ${toDelete.length} 个项目:`);
  for (const p of toDelete) {
    console.log(`   - ${p.id}: ${p.name}`);
  }

  if (!force) {
    console.log('\n添加 --force 直接删除，或单独删除指定项目');
    return;
  }

  let deleted = 0;
  let failed = 0;
  for (const p of toDelete) {
    try {
      await deleteProject(pm, p.id, p.rootDir, /* silent */ true);
      deleted++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌ 删除失败 ${p.id}: ${msg}`);
      failed++;
    }
  }

  console.log(`\n清理完成: 删除 ${deleted} 个，失败 ${failed} 个`);
}

async function deleteProject(pm: ProjectManager, id: string, rootDir: string, silent = false): Promise<void> {
  // 1. Remove local directory if exists
  if (existsSync(rootDir)) {
    rmSync(rootDir, { recursive: true, force: true });
  }

  // 2. Remove from database
  pm.delete(id);

  if (!silent) {
    success(`已删除: ${id}`);
    console.log('   本地文件已移除');
  }
}
