/**
 * kele stats — show usage statistics.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { KeleDatabase } from '../../db/index.js';

export function runStats(): void {
  const db = new KeleDatabase();
  const projects = db.listProjects();

  console.log('📊 kele 使用统计\n');

  // Project counts
  console.log(`   总项目数: ${projects.length}`);

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

  console.log(`   总任务数: ${totalTasks}`);
  console.log(`   完成任务: ${completedTasks}`);
  console.log(`   失败任务: ${failedTasks}`);
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

  // Telemetry summary
  const telemetryFile = join(homedir(), '.kele', 'telemetry.jsonl');
  if (existsSync(telemetryFile)) {
    const content = readFileSync(telemetryFile, 'utf-8');
    const entries = content.trim().split('\n').filter((l) => l.trim());
    console.log(`\n   遥测事件: ${entries.length}`);
  }
}
