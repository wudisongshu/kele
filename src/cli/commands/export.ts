/**
 * kele export — export a project as a zip or copy to a target directory.
 */

import { existsSync, cpSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { KeleDatabase } from '../../db/index.js';

export function runExport(projectId: string, targetDir?: string, format?: 'dir' | 'markdown'): void {
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

  if (format === 'markdown') {
    const subProjects = db.getSubProjects(projectId);
    const tasks = db.getTasks(projectId);
    const md = `# ${project.name}\n\n` +
      `## 项目信息\n\n` +
      `- **原始想法**: ${project.idea.rawText}\n` +
      `- **类型**: ${project.idea.type}\n` +
      `- **变现方式**: ${project.idea.monetization}\n` +
      `- **创建时间**: ${project.createdAt}\n` +
      `- **导出时间**: ${new Date().toISOString()}\n\n` +
      `## 子项目 (${subProjects.length})\n\n` +
      subProjects.map(sp => `- **${sp.name}** (${sp.type})\n  - 目标目录: ${sp.targetDir}\n  - 状态: ${sp.status}`).join('\n\n') + '\n\n' +
      `## 任务 (${tasks.length})\n\n` +
      tasks.map(t => `- **${t.id}** (${t.status})${t.aiProvider ? ` — ${t.aiProvider}` : ''}`).join('\n') + '\n';
    const mdPath = join(destDir, `${project.name}-report.md`);
    writeFileSync(mdPath, md, 'utf-8');
    console.log(`✅ Markdown 报告已导出: ${mdPath}`);
    return;
  }

  cpSync(sourceDir, destDir, { recursive: true, force: true });

  // Write a README with project info
  const readme = `# ${project.name}\n\n` +
    `Original idea: ${project.idea.rawText}\n\n` +
    `Type: ${project.idea.type}\n` +
    `Monetization: ${project.idea.monetization}\n` +
    `Created: ${project.createdAt}\n`;
  writeFileSync(join(destDir, 'PROJECT-INFO.md'), readme, 'utf-8');

  // Write structured metadata JSON
  const metadata = {
    name: project.name,
    idea: project.idea,
    createdAt: project.createdAt,
    exportedAt: new Date().toISOString(),
  };
  writeFileSync(join(destDir, 'kele-export.json'), JSON.stringify(metadata, null, 2), 'utf-8');

  console.log(`✅ 项目已导出: ${destDir}`);
  console.log(`   源目录: ${sourceDir}`);
}
