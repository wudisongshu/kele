/**
 * kele search — search projects by name or keywords.
 */

import { Command } from 'commander';
import { KeleDatabase } from '../../db/index.js';

export function setupSearchCommand(program: Command): void {
  program
    .command('search')
    .argument('<query>', 'Search query for projects')
    .description('Search projects by name or keywords')
    .option('--type <type>', 'Filter by project type (game, tool, bot, etc.)')
    .action((query: string, opts: { type?: string }) => {
      const db = new KeleDatabase();
      const projects = db.listProjects();
      const lowerQuery = query.toLowerCase();
      let matches = projects.filter((p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.idea?.keywords?.some((k: string) => k.toLowerCase().includes(lowerQuery)) ||
        p.idea?.rawText?.toLowerCase().includes(lowerQuery)
      );
      if (opts.type) {
        matches = matches.filter((p) => p.idea.type === opts.type);
      }
      if (matches.length === 0) {
        console.log(`🔍 未找到匹配 "${query}" 的项目`);
        return;
      }
      console.log(`🔍 找到 ${matches.length} 个匹配项目:\n`);
      for (const p of matches) {
        console.log(`  📁 ${p.name} (${p.id})`);
        console.log(`     ${p.idea?.rawText?.slice(0, 60) || 'No description'}...`);
      }
    });
}
