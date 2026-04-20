/**
 * kele export — export a project as a zip or copy to a target directory.
 */

import { existsSync, cpSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { KeleDatabase } from '../../db/index.js';

export function runExport(projectId: string, targetDir?: string): void {
  const db = new KeleDatabase();
  const project = db.getProject(projectId);

  if (!project) {
    console.error(`❌ 项目不存在: ${projectId}`);
    console.log('   用 kele list 查看所有项目');
    process.exit(1);
  }

  const sourceDir = project.rootDir;
  if (!existsSync(sourceDir)) {
    console.error(`❌ 项目目录不存在: ${sourceDir}`);
    process.exit(1);
  }

  const destDir = targetDir || join(process.cwd(), `${project.name}-export`);

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  cpSync(sourceDir, destDir, { recursive: true, force: true });

  // Write a README with project info
  const readme = `# ${project.name}\n\n` +
    `Original idea: ${project.idea.rawText}\n\n` +
    `Type: ${project.idea.type}\n` +
    `Monetization: ${project.idea.monetization}\n` +
    `Created: ${project.createdAt}\n`;
  writeFileSync(join(destDir, 'PROJECT-INFO.md'), readme, 'utf-8');

  console.log(`✅ 项目已导出: ${destDir}`);
  console.log(`   源目录: ${sourceDir}`);
}
