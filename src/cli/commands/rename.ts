/**
 * kele rename — rename a project.
 */

import { Command } from 'commander';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ProjectManager } from '../../project/manager.js';
import { success, error } from '../../utils/logger.js';

export function setupRenameCommand(program: Command): void {
  program
    .command('rename <id> <new-name>')
    .description('重命名项目（仅本地，需重新 deploy 更新线上）')
    .action((id: string, newName: string) => {
      const pm = new ProjectManager();
      const project = pm.findByIdentifier(id);

      if (!project) {
        error(`未找到项目: ${id}`);
        pm.close();
        process.exit(1);
      }

      const oldName = project.name;

      // 1. Update database
      pm.updateName(project.id, newName);

      // 2. Update local manifest.json
      const manifestPath = join(project.rootDir, 'manifest.json');
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
          manifest.name = newName;
          manifest.short_name = newName.slice(0, 12);
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        } catch {
          // ignore malformed manifest
        }
      }

      // 3. Update local index.html <title>
      const indexPath = join(project.rootDir, 'index.html');
      if (existsSync(indexPath)) {
        try {
          let html = readFileSync(indexPath, 'utf-8');
          html = html.replace(/<title>[^<]*<\/title>/i, `<title>${newName}</title>`);
          writeFileSync(indexPath, html, 'utf-8');
        } catch {
          // ignore read/write errors
        }
      }

      pm.close();

      success(`已重命名: ${oldName} → ${newName}`);
      console.log(`   如果已部署，请运行 kele deploy ${project.id} 更新线上版本`);
    });
}
