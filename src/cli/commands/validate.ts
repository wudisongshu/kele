/**
 * kele validate — validate project quality and output a score report.
 */

import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { validateTaskOutput } from '../../core/task-validator.js';
import { validateGameInBrowser } from '../../core/game-validator-browser.js';
import { KeleDatabase } from '../../db/index.js';

export function setupValidateCommand(program: Command): void {
  program
    .command('validate')
    .argument('<project-id>', 'Project ID to validate')
    .description('Validate project quality and output a score report')
    .option('--fix', 'Auto-fix issues by retrying failed tasks')
    .action(async (projectId: string, opts: { fix?: boolean }) => {
      const db = new KeleDatabase();
      const project = db.getProject(projectId);

      if (!project) {
        console.error(`❌ 项目不存在: ${projectId}`);
        process.exit(1);
      }

      const subProjects = db.getSubProjects(projectId);
      console.log(`🔍 验证项目: ${project.name}\n`);

      let totalScore = 0;
      let spCount = 0;

      for (const sp of subProjects) {
        spCount++;
        console.log(`  📁 ${sp.name}`);
        const staticResult = validateTaskOutput(sp.targetDir, sp.name);
        const staticScore = staticResult.valid ? 100 : Math.max(0, 100 - staticResult.issues.length * 10);
        console.log(`     静态检查: ${staticResult.valid ? '✅' : '⚠️'} (${staticScore}/100)`);
        if (staticResult.issues.length > 0) {
          for (const issue of staticResult.issues.slice(0, 3)) {
            console.log(`       - ${issue}`);
          }
        }

        let browserScore = staticScore;
        if (project.idea.type === 'game') {
          const browserResult = await validateGameInBrowser(sp.targetDir);
          browserScore = browserResult.score;
          console.log(`     游戏验证: ${browserResult.playable ? '✅' : '⚠️'} (${browserScore}/100)`);
          if (browserResult.errors.length > 0) {
            for (const err of browserResult.errors.slice(0, 3)) {
              console.log(`       - ${err}`);
            }
          }
        }

        // PWA validation for web projects
        if (project.idea.monetization === 'web' || project.idea.monetization === 'unknown') {
          const hasManifest = existsSync(join(sp.targetDir, 'manifest.json'));
          const hasSW = existsSync(join(sp.targetDir, 'sw.js'));
          if (hasManifest || hasSW) {
            console.log(`     PWA 支持: ${hasManifest ? '✅ manifest' : '⚠️ manifest'} ${hasSW ? '✅ sw.js' : '⚠️ sw.js'}`);
          }
        }

        totalScore += browserScore;
      }

      const avgScore = spCount > 0 ? Math.round(totalScore / spCount) : 0;
      console.log(`\n📊 项目总分: ${avgScore}/100`);
      if (avgScore >= 90) {
        console.log('   🏆 优秀 — 项目质量很高');
      } else if (avgScore >= 70) {
        console.log('   ✅ 良好 — 项目可以正常运行');
      } else if (avgScore >= 50) {
        console.log('   ⚠️  一般 — 建议用 kele upgrade 改进');
      } else {
        console.log('   ❌ 较差 — 建议用 kele retry 重试');
      }

      if (opts.fix && avgScore < 80) {
        console.log('\n🔧 --fix 模式: 自动修复低分任务...');
        const tasks = db.getTasks(projectId).filter(t => t.status === 'failed' || t.status === 'completed');
        const lowScoreTasks = tasks.filter(t => {
          const sp = subProjects.find(s => s.id === t.subProjectId);
          if (!sp) return false;
          const r = validateTaskOutput(sp.targetDir, sp.name);
          return !r.valid;
        });
        if (lowScoreTasks.length > 0) {
          console.log(`   发现 ${lowScoreTasks.length} 个需要修复的任务`);
          for (const t of lowScoreTasks) {
            console.log(`   → 运行: kele retry ${projectId} ${t.id}`);
          }
        } else {
          console.log('   所有任务静态检查通过，无需修复');
        }
      }
    });
}
