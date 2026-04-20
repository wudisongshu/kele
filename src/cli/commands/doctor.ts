/**
 * kele doctor — diagnose common issues with the environment.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export function runDoctor(): void {
  const issues: string[] = [];
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
    } catch {
      issues.push('Config file is invalid JSON');
    }
  } else {
    issues.push(`Config missing: ${configPath}. Run: kele config --provider <name> --key <key> --url <url> --model <model>`);
  }

  // Check 3: Database
  const dbPath = join(homedir(), '.kele', 'kele.db');
  if (existsSync(dbPath)) {
    checks.push(`Database: ${dbPath} exists`);
  } else {
    checks.push(`Database: ${dbPath} will be created on first run`);
  }

  // Check 4: Output directory
  const outputDir = join(homedir(), 'kele-projects');
  if (existsSync(outputDir)) {
    checks.push(`Output dir: ${outputDir} exists`);
  } else {
    checks.push(`Output dir: ${outputDir} will be created on first run`);
  }

  // Report
  console.log('🔬 kele doctor\n');
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
