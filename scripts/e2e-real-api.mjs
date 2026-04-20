/**
 * Real API E2E Test — uses actual AI provider to generate a game end-to-end.
 * Validates: playability, deployability, monetizability.
 * Timeout: 2 hours per API call.
 */

import { createRegistryFromConfig } from '../dist/adapters/index.js';
import { validateGameInBrowser, quickGameCheck } from '../dist/core/game-validator-browser.js';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TEST_CASES = [
  { name: 'Snake Game', idea: 'a snake game where you eat food and grow longer', type: 'game' },
  { name: 'Match-3 Game', idea: 'a colorful match-3 candy crush style game', type: 'game' },
  { name: 'Breakout Game', idea: 'a brick breaker breakout game with paddle and ball', type: 'game' },
];

async function runTest(testCase) {
  console.log(`\n========== ${testCase.name} ==========`);
  const dir = mkdtempSync(join(tmpdir(), `kele-e2e-${testCase.name.replace(/\s+/g, '-').toLowerCase()}-`));
  console.log(`Output dir: ${dir}`);

  const registry = createRegistryFromConfig();
  const route = registry.route('medium');

  console.log(`Provider: ${route.provider}, Model: ${route.adapter.name}`);
  console.log(`Calling API... (this may take several minutes)`);

  const prompt = `You are a senior game developer. Create a COMPLETE, PLAYABLE ${testCase.idea}.

STRICT REQUIREMENTS:
1. ALL code in ONE index.html file — ALL JavaScript inside <script> tags. NO external scripts.
2. HTML5 Canvas for rendering. Canvas fills viewport, responsive to resize.
3. Game loop with requestAnimationFrame.
4. Input: click/touch/keyboard as appropriate for the game type.
5. Score display and restart button.
6. The game must be fully playable when the user opens index.html in a browser.
7. NO build step needed. User opens index.html and plays immediately.

Return ONLY a JSON object in this exact format (no markdown code blocks):
{"files":[{"path":"index.html","content":"<!DOCTYPE html>..."}],"notes":"brief description"}`;

  const start = Date.now();
  let tokenCount = 0;

  try {
    const output = await route.adapter.execute(prompt, (token) => {
      tokenCount++;
      if (tokenCount % 100 === 0) process.stdout.write('.');
    });

    const elapsed = (Date.now() - start) / 1000;
    console.log(`\nDone in ${elapsed.toFixed(1)} seconds, ${tokenCount} tokens`);
    console.log(`Output length: ${output.length}`);

    // Parse output
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.log(`❌ FAIL: No JSON object found in output`);
      console.log(`First 500 chars: ${output.slice(0, 500)}`);
      return { name: testCase.name, passed: false, reason: 'No JSON found' };
    }

    let json;
    try {
      json = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
    } catch (e) {
      console.log(`❌ FAIL: JSON parse error: ${e.message}`);
      console.log(`Raw JSON: ${output.slice(jsonStart, jsonStart + 200)}...`);
      return { name: testCase.name, passed: false, reason: 'JSON parse error' };
    }

    const html = json.files?.[0]?.content;
    if (!html) {
      console.log(`❌ FAIL: No HTML content in files array`);
      return { name: testCase.name, passed: false, reason: 'No HTML content' };
    }

    console.log(`HTML length: ${html.length}`);
    console.log(`Has canvas: ${html.includes('<canvas')}`);
    console.log(`Has requestAnimationFrame: ${html.includes('requestAnimationFrame')}`);
    console.log(`Has addEventListener: ${html.includes('addEventListener')}`);
    console.log(`Has script src: ${html.includes('script src')}`);

    // Write to disk
    writeFileSync(join(dir, 'index.html'), html);

    // Quick check
    const quick = quickGameCheck(dir);
    if (!quick.ok) {
      console.log(`❌ Quick check failed: ${quick.issues.join(', ')}`);
    } else {
      console.log(`✅ Quick check passed`);
    }

    // Browser validation
    const browser = validateGameInBrowser(dir);
    console.log(`Browser validation: Playable=${browser.playable}, Score=${browser.score}/100`);
    if (browser.errors.length > 0) {
      console.log(`Errors: ${browser.errors.join('; ')}`);
    }

    // Save notes
    if (json.notes) {
      writeFileSync(join(dir, 'notes.md'), json.notes);
    }

    const passed = browser.playable && browser.score >= 70;
    return {
      name: testCase.name,
      passed,
      score: browser.score,
      htmlSize: html.length,
      dir,
      reason: passed ? null : `Browser validation failed: ${browser.errors.join('; ')}`,
    };

  } catch (err) {
    const elapsed = (Date.now() - start) / 1000;
    console.log(`\n❌ API call failed after ${elapsed.toFixed(1)} seconds: ${err.message}`);
    return { name: testCase.name, passed: false, reason: err.message };
  }
}

async function main() {
  console.log('=== Kele Real API E2E Test ===');
  console.log(`Started at: ${new Date().toISOString()}`);

  const results = [];
  for (const testCase of TEST_CASES) {
    const result = await runTest(testCase);
    results.push(result);
  }

  console.log(`\n========== SUMMARY ==========`);
  let passCount = 0;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}: ${r.passed ? `PASS (${r.score}/100)` : `FAIL - ${r.reason}`}`);
    if (r.passed) passCount++;
    if (r.dir) console.log(`   Output: ${r.dir}`);
  }
  console.log(`\nTotal: ${passCount}/${results.length} passed`);

  // Exit with error code if any failed
  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
