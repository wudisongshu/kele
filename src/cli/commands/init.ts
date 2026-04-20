/**
 * kele init — initialize a kele project from an existing directory.
 */

import { existsSync, readdirSync } from 'fs';

export function runInit(targetDir?: string): void {
  const dir = targetDir || process.cwd();

  if (!existsSync(dir)) {
    console.error(`❌ 目录不存在: ${dir}`);
    process.exit(1);
  }

  const entries = readdirSync(dir);
  console.log(`📁 初始化 kele 项目: ${dir}\n`);
  console.log(`   发现 ${entries.length} 个文件/目录:`);
  for (const entry of entries.slice(0, 20)) {
    console.log(`      • ${entry}`);
  }
  if (entries.length > 20) {
    console.log(`      ... 还有 ${entries.length - 20} 个`);
  }

  // Detect project type from files
  let detectedType = 'unknown';
  if (entries.some(e => e.endsWith('.html') || e === 'index.html')) detectedType = 'web';
  if (entries.some(e => e === 'package.json')) detectedType = 'node';
  if (entries.some(e => e === 'app.json')) detectedType = 'miniprogram';
  if (entries.some(e => e === 'Cargo.toml')) detectedType = 'rust';
  if (entries.some(e => e === 'go.mod')) detectedType = 'go';
  if (entries.some(e => e === 'requirements.txt' || e === 'pyproject.toml')) detectedType = 'python';
  console.log(`\n   检测到项目类型: ${detectedType}`);

  console.log(`\n💡 使用 kele "你的改进想法" 来升级这个项目`);
  console.log(`   或使用 kele upgrade <project-id> <task-id> "改进内容"`);
}
