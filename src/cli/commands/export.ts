/**
 * kele export — export a project as a zip or copy to a target directory.
 */

import { existsSync, cpSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { Command } from 'commander';
import { KeleDatabase } from '../../db/index.js';
import { debugLog } from '../../debug.js';

export function runExport(projectId: string, targetDir?: string, format?: 'dir' | 'markdown' | 'zip' | 'json'): void {
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

  if (format === 'json') {
    const subProjects = db.getSubProjects(projectId);
    const tasks = db.getTasks(projectId);
    const payload = {
      project: {
        id: project.id,
        name: project.name,
        idea: project.idea,
        createdAt: project.createdAt,
      },
      subProjects: subProjects.map(sp => ({
        id: sp.id,
        name: sp.name,
        type: sp.type,
        targetDir: sp.targetDir,
        status: sp.status,
      })),
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        aiProvider: t.aiProvider,
        complexity: t.complexity,
      })),
      exportedAt: new Date().toISOString(),
    };
    const jsonPath = join(destDir, `${project.name}.json`);
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`✅ JSON 元数据已导出: ${jsonPath}`);
    return;
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

  if (format === 'zip') {
    // Use shell tar command for zip-like archive
    const { execSync } = require('child_process');
    const archivePath = join(destDir, `${project.name}.tar.gz`);
    try {
      execSync(`tar -czf "${archivePath}" -C "${dirname(sourceDir)}" "${project.name}"`, { stdio: 'ignore' });
      console.log(`✅ 项目已打包: ${archivePath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Export tar command failed', msg);
      console.error(`❌ 打包失败，请确保系统支持 tar 命令`);
      process.exit(1);
    }
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

export function setupExportCommand(program: Command): void {
  program
    .command('export')
    .argument('<project-id>', 'Project ID to export')
    .argument('[target-dir]', 'Target directory (default: ./<project-name>-export)')
    .description('Export a project to a directory')
    .option('--format <type>', 'Export format: dir (default), markdown, zip, or json')
    .action((projectId: string, targetDir?: string, opts?: { format?: string }) => {
      const validFormats = ['dir', 'markdown', 'zip', 'json'];
      const format = validFormats.includes(opts?.format || '') ? (opts?.format as 'dir' | 'markdown' | 'zip' | 'json') : 'dir';
      runExport(projectId, targetDir, format);
    });
}
