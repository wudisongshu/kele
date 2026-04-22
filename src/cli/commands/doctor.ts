/**
 * kele doctor — diagnose common issues with the environment.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Command } from 'commander';
import { debugLog } from '../../debug.js';

export function runDoctor(fix = false): void {
  let issues: string[] = [];
  const checks: string[] = [];

  // Check 1: Node.js version
  const nodeVersion = process.version;
  checks.push(`Node.js: ${nodeVersion}`);
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (major < 18) {
    issues.push(`Node.js ${nodeVersion} is too old. kele requires Node.js 18+`);
  }

  // Check 1b: Available memory
  const memMB = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
  checks.push(`Memory: ${memMB}MB heap`);
  if (memMB < 256) {
    issues.push('Available memory is very low. AI generation may fail.');
  }

  // Check 1c: Disk space (rough estimate via tmpdir)
  try {
    const { statfsSync } = require('fs');
    const tmpStat = statfsSync(require('os').tmpdir());
    const freeGB = (tmpStat.bavail * tmpStat.bsize) / (1024 * 1024 * 1024);
    checks.push(`Disk: ${freeGB.toFixed(1)}GB free`);
    if (freeGB < 1) {
      issues.push('Disk space is very low. Project generation may fail.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog('Doctor statfsSync unavailable', msg);
    // statfsSync may not be available on all platforms
  }

  // Check 2: Config file
  const configPath = join(homedir(), '.kele', 'config.json');
  if (existsSync(configPath)) {
    checks.push(`Config: ${configPath} exists`);
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (config.providers) {
        const providers = Object.keys(config.providers);
        checks.push(`Providers: ${providers.join(', ')}`);
        for (const name of providers) {
          const p = config.providers[name];
          if (!p.apiKey || p.apiKey.length < 10) {
            issues.push(`Provider "${name}" has no API key configured`);
          }
        }
      } else {
        issues.push('No providers configured');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Doctor config parse failed', msg);
      issues.push('Config file is invalid JSON');
    }
  } else {
    issues.push(`Config missing: ${configPath}. Run: kele config --provider <name> --key <key> --url <url> --model <model>`);
  }

  // Check 3: Database
  const dbPath = join(homedir(), '.kele', 'kele.db');
  if (existsSync(dbPath)) {
    checks.push(`Database: ${dbPath} exists`);
  } else if (fix) {
    mkdirSync(join(homedir(), '.kele'), { recursive: true });
    checks.push(`Database: ${dbPath} directory created`);
  } else {
    checks.push(`Database: ${dbPath} will be created on first run`);
  }

  // Check 4: Output directory
  const outputDir = join(homedir(), 'kele-projects');
  if (existsSync(outputDir)) {
    checks.push(`Output dir: ${outputDir} exists`);
  } else if (fix) {
    mkdirSync(outputDir, { recursive: true });
    checks.push(`Output dir: ${outputDir} created`);
  } else {
    checks.push(`Output dir: ${outputDir} will be created on first run`);
  }

  // Check 5: Debug logs
  const debugDir = join(homedir(), '.kele', 'debug');
  if (existsSync(debugDir)) {
    try {
      const { readdirSync, statSync } = require('fs');
      const files = readdirSync(debugDir);
      const totalSize = files.reduce((sum: number, f: string) => {
        try { return sum + statSync(join(debugDir, f)).size; } catch (err) { debugLog(`Doctor stat failed: ${f}`, err instanceof Error ? err.message : String(err)); return sum; }
      }, 0);
      const sizeMB = (totalSize / 1024 / 1024).toFixed(1);
      checks.push(`Debug logs: ${files.length} files, ${sizeMB}MB in ${debugDir}`);
      if (parseFloat(sizeMB) > 100) {
        issues.push(`Debug logs are ${sizeMB}MB. Run: rm -rf ${debugDir}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Doctor debug dir read failed', msg);
      checks.push(`Debug logs: ${debugDir} exists`);
    }
  } else {
    checks.push(`Debug logs: ${debugDir} will be created when --debug is used`);
  }

  if (fix && issues.length > 0) {
    const autoFixable = issues.filter(i => i.includes('Config missing') || i.includes('No providers configured'));
    if (autoFixable.length > 0) {
      const configDir = join(homedir(), '.kele');
      mkdirSync(configDir, { recursive: true });
      const defaultConfig = { providers: {}, defaultProvider: '', telemetry: true };
      writeFileSync(join(configDir, 'config.json'), JSON.stringify(defaultConfig, null, 2) + '\n');
      checks.push('Auto-fix: created default config.json');
      issues = issues.filter(i => !autoFixable.includes(i));
    }
  }

  // Report
  console.log(fix ? '🔬 kele doctor --fix\n' : '🔬 kele doctor\n');
  for (const check of checks) {
    console.log(`   ✅ ${check}`);
  }

  if (issues.length > 0) {
    console.log(`\n⚠️  ${issues.length} issue(s) found:\n`);
    for (const issue of issues) {
      console.log(`   ❌ ${issue}`);
    }
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed. kele is ready!');
  }
}

export function setupDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Diagnose environment and configuration issues')
    .option('--fix', 'Auto-fix common issues (create directories, default config)')
    .action((opts: { fix?: boolean }) => {
      runDoctor(opts.fix);
    });
}
