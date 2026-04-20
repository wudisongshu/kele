#!/usr/bin/env node
/**
 * Deployment Test Runner — iterate on deployment quality 20+ times.
 */

import { createRegistryFromConfig } from '../src/config.js';
import { applyAIOutput } from '../src/core/file-writer.js';
import { runAcceptanceCriteria } from '../src/core/acceptance-runner.js';
import { validateTaskOutput } from '../src/core/task-validator.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

interface TestResult {
  round: number;
  provider: string;
  tokens: number;
  durationMs: number;
  filesWritten: string[];
  validationScore: number;
  validationPassed: boolean;
  acceptancePassed: boolean;
  acceptanceScore: number;
  failedCriteria: string[];
}

const DEPLOYMENT_PROMPT = `You are a senior DevOps engineer. Generate deployment configuration for an HTML5 match-3 game.

PROJECT CONTEXT:
- Game name: "禅意三消"
- Game type: HTML5 Canvas game (index.html + canvas.js)
- Target platform: web (deploy to GitHub Pages)
- No credentials configured — use placeholders

REQUIRED OUTPUT FILES:
1. .github/workflows/deploy.yml — GitHub Actions CI/CD workflow using actions/deploy-pages@v4
2. deploy.sh — Local deployment script (bash)
3. project.config.json — Platform configuration
4. game.json — Game metadata manifest
5. adsense.html — Google AdSense responsive ad unit snippet
6. CNAME — Custom domain placeholder
7. SETUP.md — Step-by-step setup guide

CODE QUALITY REQUIREMENTS:
1. COMPLETE IMPLEMENTATION: FULLY WORKING code. NO stubs, NO TODOs.
2. deploy.sh must check for required tools and env vars
3. deploy.yml must trigger on push to main branch, use actions/deploy-pages@v4
4. adsense.html must use standard Google AdSense responsive ad format
5. All configs must use placeholder values for missing credentials
6. SETUP.md must explain how to obtain each credential

CRITICAL: Return your response as a JSON object in this exact format:
{
  "files": [
    { "path": "relative/path/to/file", "content": "file content here" }
  ],
  "notes": "optional notes"
}`;

const ACCEPTANCE_CRITERIA = [
  { description: 'GitHub Actions workflow exists', type: 'functional' as const, action: 'verify-file', target: '.github/workflows/deploy.yml', expected: 'contains push trigger and deploy steps', critical: true },
  { description: 'Deploy script exists', type: 'functional' as const, action: 'verify-file', target: 'deploy.sh', expected: 'contains deploy command', critical: true },
  { description: 'Platform config exists', type: 'functional' as const, action: 'verify-file', target: 'project.config.json', expected: 'contains platform and build config', critical: true },
  { description: 'Game manifest exists', type: 'functional' as const, action: 'verify-file', target: 'game.json', expected: 'contains game metadata', critical: true },
  { description: 'AdSense snippet exists', type: 'functional' as const, action: 'verify-file', target: 'adsense.html', expected: 'contains adsbygoogle script', critical: true },
  { description: 'CNAME file exists', type: 'functional' as const, action: 'verify-file', target: 'CNAME', expected: 'file exists', critical: false },
  { description: 'Setup guide exists', type: 'functional' as const, action: 'verify-file', target: 'SETUP.md', expected: 'contains credential instructions', critical: true },
  { description: 'Deploy workflow uses actions/deploy-pages', type: 'functional' as const, action: 'check-text', target: '.github/workflows/deploy.yml', expected: 'actions/deploy-pages', critical: true },
  { description: 'AdSense code uses standard format', type: 'functional' as const, action: 'check-text', target: 'adsense.html', expected: 'pagead2.googlesyndication.com, adsbygoogle', critical: true },
];

async function runSingleTest(round: number, useReal: boolean): Promise<TestResult> {
  const tmpDir = mkdtempSync(join(tmpdir(), `kele-deploy-test-${round}-`));
  const registry = createRegistryFromConfig();
  const route = useReal ? registry.route('medium') : registry.get('mock')!;

  const startTime = Date.now();
  let tokens = 0;

  const onToken = () => { tokens++; };

  try {
    const output = await route.adapter.execute(DEPLOYMENT_PROMPT, onToken);
    const durationMs = Date.now() - startTime;
    const filesWritten = applyAIOutput(tmpDir, output);

    const validation = validateTaskOutput(tmpDir, 'Generate deployment configuration');

    const mockSubProject = {
      id: 'deployment', name: 'Deployment', description: 'Deploy', type: 'deployment',
      targetDir: tmpDir, dependencies: [], status: 'pending' as const,
      createdAt: new Date().toISOString(), acceptanceCriteria: ACCEPTANCE_CRITERIA,
    };
    const acceptance = runAcceptanceCriteria(mockSubProject);

    const result: TestResult = {
      round, provider: route.provider, tokens, durationMs, filesWritten,
      validationScore: validation.score, validationPassed: validation.valid,
      acceptancePassed: acceptance.passed, acceptanceScore: acceptance.score,
      failedCriteria: acceptance.results.filter(r => !r.passed).map(r => r.criterion.description),
    };

    rmSync(tmpDir, { recursive: true, force: true });
    return result;
  } catch (err) {
    rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

async function main() {
  const useReal = process.argv[2] === 'real';
  const rounds = parseInt(process.argv[3] || '1', 10);

  console.log(`🧪 Deployment Test Runner — ${useReal ? 'REAL API' : 'MOCK'} x${rounds}`);
  console.log('');

  const results: TestResult[] = [];
  for (let i = 1; i <= rounds; i++) {
    console.log(`--- Round ${i}/${rounds} ---`);
    try {
      const r = await runSingleTest(i, useReal);
      results.push(r);
      console.log(`   ✅ ${r.provider} | ${r.tokens} tokens | ${(r.durationMs/1000).toFixed(1)}s`);
      console.log(`   Files: ${r.filesWritten.join(', ') || '(none)'}`);
      console.log(`   Validation: ${r.validationPassed ? 'PASS' : 'FAIL'} (${r.validationScore}/100)`);
      console.log(`   Acceptance: ${r.acceptancePassed ? 'PASS' : 'FAIL'} (${r.acceptanceScore}/100)`);
      if (r.failedCriteria.length > 0) {
        console.log(`   Failed: ${r.failedCriteria.join(', ')}`);
      }
    } catch (err) {
      console.log(`   ❌ ERROR: ${err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100)}`);
    }
    console.log('');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  const passed = results.filter(r => r.acceptancePassed).length;
  const avgScore = results.reduce((s, r) => s + r.acceptanceScore, 0) / results.length || 0;
  console.log(`   Rounds: ${results.length} | Passed: ${passed}/${results.length} | Avg: ${avgScore.toFixed(1)}/100`);
}

main().catch(console.error);
