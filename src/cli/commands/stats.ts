/**
 * kele stats — show usage statistics.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { KeleDatabase } from '../../db/index.js';

export function runStats(jsonMode = false): void {
  const db = new KeleDatabase();
  const projects = db.listProjects();

  const types = new Map<string, number>();
  const monetizations = new Map<string, number>();
  let totalTasks = 0;
  let completedTasks = 0;
  let failedTasks = 0;

  for (const project of projects) {
    types.set(project.idea.type, (types.get(project.idea.type) || 0) + 1);
    monetizations.set(project.idea.monetization, (monetizations.get(project.idea.monetization) || 0) + 1);

    const tasks = db.getTasks(project.id);
    totalTasks += tasks.length;
    completedTasks += tasks.filter((t) => t.status === 'completed').length;
    failedTasks += tasks.filter((t) => t.status === 'failed').length;
  }

  const typeDistribution = Object.fromEntries(types);
  const monetizationDistribution = Object.fromEntries(monetizations);
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Telemetry summary
  const telemetryFile = join(homedir(), '.kele', 'telemetry.jsonl');
  let telemetryCount = 0;
  if (existsSync(telemetryFile)) {
    const content = readFileSync(telemetryFile, 'utf-8');
    telemetryCount = content.trim().split('\n').filter((l) => l.trim()).length;
  }

  if (jsonMode) {
    const stats = {
      projects: {
        total: projects.length,
        byType: typeDistribution,
        byMonetization: monetizationDistribution,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        failed: failedTasks,
        completionRate: `${completionRate}%`,
      },
      telemetry: { events: telemetryCount },
    };
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log('📊 kele 使用统计\n');
  console.log(`   总项目数: ${projects.length}`);
  console.log(`   总任务数: ${totalTasks}`);
  console.log(`   完成任务: ${completedTasks}`);
  console.log(`   失败任务: ${failedTasks}`);
  if (totalTasks > 0) {
    console.log(`   完成率: ${completionRate}%`);
  }
  console.log();

  if (types.size > 0) {
    console.log('   项目类型分布:');
    for (const [type, count] of types) {
      console.log(`      • ${type}: ${count}`);
    }
    console.log();
  }

  if (monetizations.size > 0) {
    console.log('   变现渠道分布:');
    for (const [m, count] of monetizations) {
      console.log(`      • ${m}: ${count}`);
    }
  }

  if (telemetryCount > 0) {
    console.log(`\n   遥测事件: ${telemetryCount}`);
  }
}
