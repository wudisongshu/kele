/**
 * kele logs — view recent log entries.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Command } from 'commander';

export function runLogs(lines: number = 20, levelFilter?: string): void {
  const logDir = join(homedir(), '.kele', 'logs');
  const date = new Date().toISOString().split('T')[0];
  const logFile = join(logDir, `kele-${date}.log`);

  if (!existsSync(logFile)) {
    console.log('📭 今日暂无日志');
    return;
  }

  const content = readFileSync(logFile, 'utf-8');
  let entries = content.trim().split('\n').filter((l) => l.trim());

  // Filter by level if specified
  if (levelFilter) {
    const filter = levelFilter.toLowerCase();
    entries = entries.filter((entry) => {
      try {
        const parsed = JSON.parse(entry);
        return parsed.level?.toLowerCase() === filter;
      } catch {
        return false;
      }
    });
  }

  if (entries.length === 0) {
    console.log('📭 日志文件为空');
    return;
  }

  const filterLabel = levelFilter ? ` (${levelFilter})` : '';
  console.log(`📋 最近 ${Math.min(lines, entries.length)} 条日志${filterLabel}:\n`);
  const recent = entries.slice(-lines);
  for (const entry of recent) {
    try {
      const parsed = JSON.parse(entry);
      const ts = parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : '?';
      const level = parsed.level?.toUpperCase() || 'INFO';
      const icon = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : 'ℹ️';
      console.log(`   ${icon} [${ts}] ${parsed.message}`);
    } catch {
      console.log(`   📝 ${entry.slice(0, 120)}`);
    }
  }
}

export function setupLogsCommand(program: Command): void {
  program
    .command('logs')
    .option('-n, --lines <number>', 'Number of lines to show', '20')
    .description('View recent log entries')
    .action((options: { lines: string }) => {
      runLogs(parseInt(options.lines, 10));
    });
}
