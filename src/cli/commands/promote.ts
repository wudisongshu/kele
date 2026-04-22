/**
 * kele promote — auto-generate marketing assets and channel plans.
 *
 * Solves the #1 problem for indie developers: "nobody knows my product exists".
 * Generates ready-to-post copy, video scripts, screenshot guides, SEO configs,
 * and a day-by-day posting schedule.
 */

import { Command } from 'commander';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { KeleDatabase } from '../../db/index.js';
import type { Project } from '../../types/index.js';
import {
  generateMarketingPlan,
  writeMarketingAssets,
  formatMarketingPlan,
} from '../../core/marketing-engine.js';

export function setupPromoteCommand(program: Command): void {
  program
    .command('promote')
    .argument('<project-id>', 'Project ID to promote')
    .description('Generate marketing assets and promotion plan for a project')
    .option('--channel <channel>', 'Only generate for a specific channel (twitter, reddit, douyin, etc.)')
    .option('--schedule', 'Generate posting schedule with optimal timing', false)
    .option('--output <dir>', 'Custom output directory for marketing assets')
    .action(async (projectId: string, options: { channel?: string; schedule: boolean; output?: string }) => {
      const db = new KeleDatabase();
      const base = db.getProject(projectId);

      if (!base) {
        console.error(`❌ 项目不存在: ${projectId}`);
        console.log('   使用 kele list 查看所有项目');
        process.exit(1);
      }

      const project: Project = {
        ...base,
        subProjects: db.getSubProjects(projectId),
        tasks: db.getTasks(projectId),
      };

      console.log(`🚀 正在为 "${project.name}" 生成运营方案...\n`);

      // Generate marketing plan
      const { assets, channels, schedule } = generateMarketingPlan(project);

      // Filter by channel if specified
      let filteredChannels = channels;
      if (options.channel) {
        const chId = options.channel.toLowerCase();
        filteredChannels = channels.filter((c) => c.id === chId || c.name.toLowerCase().includes(chId));
        if (filteredChannels.length === 0) {
          console.error(`❌ 未知渠道: ${options.channel}`);
          console.log(`   可用渠道: ${channels.map((c) => c.id).join(', ')}`);
          process.exit(1);
        }
        console.log(`   📌 仅生成 ${options.channel} 渠道素材\n`);
      }

      // Determine output directory
      const outputDir = options.output || join(project.rootDir, 'marketing');
      mkdirSync(outputDir, { recursive: true });

      // Write assets to disk
      const filteredSchedule = options.channel
        ? schedule.filter((s) => filteredChannels.some((c) => s.channel === c.name))
        : schedule;

      writeMarketingAssets(project, assets, filteredChannels, filteredSchedule, outputDir);

      // Print terminal summary
      console.log(formatMarketingPlan(assets, filteredChannels, filteredSchedule));

      console.log(`📁 所有素材已保存到: ${outputDir}\n`);

      // Print channel-specific tips
      if (!options.channel) {
        console.log('💡 快速开始建议：');
        const top3 = filteredChannels.slice(0, 3);
        for (const ch of top3) {
          console.log(`   • ${ch.name}: ${ch.specificTips[0]}`);
        }
        console.log();
      }

      // Print schedule if requested
      if (options.schedule) {
        console.log('📅 完整发布日历:');
        for (const s of filteredSchedule) {
          console.log(`   Day ${s.day}: ${s.channel} | ${s.time} | ${s.contentType}`);
        }
        console.log();
      }

      console.log('🎉 运营方案生成完成！复制文案，按截图指南录制素材，按计划发布。');
    });
}
