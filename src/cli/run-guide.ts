import { existsSync, readdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface RunEntry {
  dir: string;
  type: 'npm' | 'html' | 'python' | 'go' | 'none';
  entryFile?: string;
}

/**
 * Score a directory name by priority for run entry selection.
 */
function dirPriority(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('game')) return 100;
  if (lower.includes('app')) return 90;
  if (lower.includes('dev')) return 80;
  if (lower.includes('frontend')) return 70;
  if (lower.includes('client')) return 60;
  if (lower.includes('web')) return 50;
  return 0;
}

/**
 * Find the best entry point to run a project locally.
 * Scans rootDir and immediate subdirectories for package.json, index.html, main.py, main.go.
 */
export function findRunEntry(rootDir: string): RunEntry {
  const candidates: Array<{ dir: string; type: 'npm' | 'html' | 'python' | 'go'; entryFile?: string; priority: number }> = [];

  // Check rootDir
  if (existsSync(join(rootDir, 'package.json'))) {
    candidates.push({ dir: rootDir, type: 'npm', priority: dirPriority('root') });
  }
  if (existsSync(join(rootDir, 'index.html'))) {
    candidates.push({ dir: rootDir, type: 'html', entryFile: 'index.html', priority: dirPriority('root') + 10 });
  }
  if (existsSync(join(rootDir, 'main.py'))) {
    candidates.push({ dir: rootDir, type: 'python', entryFile: 'main.py', priority: dirPriority('root') + 10 });
  }
  if (existsSync(join(rootDir, 'main.go'))) {
    candidates.push({ dir: rootDir, type: 'go', entryFile: 'main.go', priority: dirPriority('root') + 10 });
  }

  // Scan immediate subdirectories
  try {
    const entries = readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDir = join(rootDir, entry.name);
      const priority = dirPriority(entry.name);

      if (existsSync(join(subDir, 'package.json'))) {
        candidates.push({ dir: subDir, type: 'npm', priority });
      }
      if (existsSync(join(subDir, 'index.html'))) {
        candidates.push({ dir: subDir, type: 'html', entryFile: 'index.html', priority: priority + 10 });
      }
      if (existsSync(join(subDir, 'game-dev', 'index.html'))) {
        candidates.push({ dir: join(subDir, 'game-dev'), type: 'html', entryFile: 'index.html', priority: priority + 20 });
      }
      if (existsSync(join(subDir, 'main.py'))) {
        candidates.push({ dir: subDir, type: 'python', entryFile: 'main.py', priority: priority + 10 });
      }
      if (existsSync(join(subDir, 'main.go'))) {
        candidates.push({ dir: subDir, type: 'go', entryFile: 'main.go', priority: priority + 10 });
      }
    }
  } catch {
    // Ignore read errors
  }

  if (candidates.length === 0) {
    return { dir: rootDir, type: 'none' };
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const best = candidates[0];
  return { dir: best.dir, type: best.type, entryFile: best.entryFile };
}

/**
 * Print a local run guide based on what files were generated.
 */
export async function printLocalRunGuide(rootDir: string): Promise<void> {
  const runEntry = findRunEntry(rootDir);

  console.log('\n🚀 本地运行指南');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (runEntry.type === 'npm') {
    try {
      const pkgRaw = await readFile(join(runEntry.dir, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgRaw);
      const hasDev = pkg.scripts?.dev;
      const hasStart = pkg.scripts?.start;
      console.log(`   cd "${runEntry.dir}"`);
      if (!existsSync(join(runEntry.dir, 'node_modules'))) {
        console.log('   npm install');
      }
      if (hasDev) {
        console.log('   npm run dev');
      } else if (hasStart) {
        console.log('   npm start');
      } else {
        console.log('   npx serve .   # 或 python3 -m http.server 8080');
      }
    } catch {
      console.log(`   cd "${runEntry.dir}"`);
      console.log('   npm install && npm run dev');
    }
  } else if (runEntry.type === 'html') {
    console.log(`   cd "${runEntry.dir}"`);
    console.log('   # 最简单的方式：直接双击打开 index.html');
    console.log('   open index.html');
    console.log('   # 或者用本地服务器（某些功能可能需要）：');
    console.log('   python3 -m http.server 8080');
    console.log('   # 然后浏览器打开 http://localhost:8080');
  } else if (runEntry.type === 'python') {
    console.log(`   cd "${runEntry.dir}"`);
    console.log(`   python3 ${runEntry.entryFile}`);
  } else if (runEntry.type === 'go') {
    console.log(`   cd "${runEntry.dir}"`);
    console.log(`   go run ${runEntry.entryFile}`);
  } else {
    console.log(`   cd "${rootDir}"`);
    console.log('   请查看项目内的 README 文件获取运行方式');
  }

  console.log('\n   配置免确认模式（以后不再询问）：');
  console.log('   kele config --auto-yes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
