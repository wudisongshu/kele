/**
 * End-to-end verification: generate a game and verify it's playable in browser.
 */
import { createRegistryFromConfig } from '../dist/adapters/index.js';
import { parseIdea } from '../dist/core/idea-engine.js';
import { incubateWithAI } from '../dist/core/ai-incubator.js';
import { planTasks } from '../dist/core/task-planner.js';
import { executeTask } from '../dist/core/executor.js';
import { KeleDatabase } from '../dist/db/index.js';
import { validateGameInBrowser, quickGameCheck } from '../dist/core/game-validator-browser.js';
import { mkdtempSync, readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TEST_IDEAS = [
  { name: 'Match-3', idea: '一个三消游戏' },
  { name: 'Snake', idea: '一个贪吃蛇游戏' },
  { name: 'Breakout', idea: '一个打砖块游戏' },
];

async function verifyGame(name, ideaText) {
  const tmpDir = mkdtempSync(join(tmpdir(), `kele-verify-${name}-`));
  const registry = createRegistryFromConfig();
  const adapter = registry.get('mock');
  // Force route to mock
  registry.route = () => ({ provider: 'mock', adapter });

  console.log(`\n========== ${name} ==========`);
  console.log('Dir:', tmpDir);

  // Incubate
  const parseResult = parseIdea(ideaText);
  const incubation = await incubateWithAI(parseResult.idea, tmpDir, adapter, 30000);
  if (!incubation.success) {
    console.log('❌ Incubation failed:', incubation.error);
    return false;
  }

  const sp = incubation.subProjects.find(s => s.type === 'development');
  const plan = planTasks(sp, parseResult.idea);
  const task = plan.tasks[0];

  // Build project
  const db = new KeleDatabase();
  const project = {
    id: `verify-${name}`,
    name,
    rootDir: tmpDir,
    idea: parseResult.idea,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subProjects: incubation.subProjects,
    tasks: plan.tasks,
  };

  // Save project structure to DB first (required by foreign key constraints)
  db.saveProject(project);
  for (const sp of project.subProjects) {
    db.saveSubProject(sp, project.id);
  }

  // Execute
  const results = [];
  const result = await executeTask(task, sp, project, {
    registry,
    db,
    onProgress: (msg) => {
      console.log('  ', msg);
      results.push(msg);
    },
  });

  console.log('Task result:', result.success, result.error || '');

  // Browser validation
  const quick = quickGameCheck(sp.targetDir);
  console.log('Quick check:', quick.ok ? '✅' : '❌', quick.issues);

  const browser = await validateGameInBrowser(sp.targetDir);
  console.log('Browser validation:');
  console.log('  Playable:', browser.playable ? '✅' : '❌');
  console.log('  Score:', browser.score);
  console.log('  Errors:', browser.errors);
  console.log('  Details:', JSON.stringify(browser.details, null, 2));

  // Show file structure
  console.log('  Generated files:');
  function list(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) list(p, prefix + entry.name + '/');
      else {
        const size = statSync(p).size;
        console.log(`    ${prefix}${entry.name} (${size} bytes)`);
      }
    }
  }
  try {
    list(sp.targetDir);
  } catch (e) {
    console.log('  (error listing files:', e.message, ')');
  }

  // Check HTML content
  const htmlPath = join(sp.targetDir, 'index.html');
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, 'utf-8');
    const hasInlineScript = html.includes('<script>') && !html.includes('<script src=');
    console.log('  Single-file (inline JS):', hasInlineScript ? '✅' : '❌');
    console.log('  HTML size:', html.length, 'bytes');
  }

  return browser.playable;
}

async function main() {
  let passed = 0;
  for (const { name, idea } of TEST_IDEAS) {
    const ok = await verifyGame(name, idea);
    if (ok) passed++;
  }
  console.log(`\n========== SUMMARY: ${passed}/${TEST_IDEAS.length} playable ==========`);
  process.exit(passed === TEST_IDEAS.length ? 0 : 1);
}

main().catch(console.error);
