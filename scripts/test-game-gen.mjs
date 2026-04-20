import { createRegistryFromConfig } from '../dist/adapters/index.js';
import { parseIdea } from '../dist/core/idea-engine.js';
import { incubateWithAI } from '../dist/core/ai-incubator.js';
import { planTasks } from '../dist/core/task-planner.js';
import { executeTask } from '../dist/core/executor.js';
import { KeleDatabase } from '../dist/db/index.js';
import { mkdtempSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = mkdtempSync(join(tmpdir(), 'kele-game-test-'));
console.log('Project dir:', tmpDir);

const registry = createRegistryFromConfig();
const adapter = registry.get('mock');

const parseResult = parseIdea('一个三消游戏');
const idea = parseResult.idea;

const incubation = await incubateWithAI(idea, tmpDir, adapter, 30000);
console.log('Incubation success:', incubation.success);

const sp = incubation.subProjects.find(s => s.type === 'development');
console.log('Dev sub-project:', sp?.name, sp?.targetDir);

const plan = planTasks(sp, idea);
console.log('Tasks planned:', plan.tasks?.length);

const task = plan.tasks[0];

const db = new KeleDatabase();
const project = {
  id: 'test-game',
  name: 'Match-3 Game',
  idea,
  status: 'active',
  createdAt: new Date().toISOString(),
  subProjects: incubation.subProjects,
  tasks: plan.tasks,
};

const result = await executeTask(task, sp, project, {
  registry,
  db,
  onProgress: (msg) => console.log('  ', msg),
});

console.log('\nTask result:', result.success, result.error);

// List and inspect generated files
function listFiles(dir, prefix = '') {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        listFiles(path, prefix + entry.name + '/');
      } else {
        console.log('  FILE:', prefix + entry.name);
        // Show first 500 chars of HTML/JS files
        if (entry.name.endsWith('.html') || entry.name.endsWith('.js')) {
          const content = readFileSync(path, 'utf-8').slice(0, 500);
          console.log('  CONTENT:', content.replace(/\n/g, ' ').slice(0, 300));
        }
      }
    }
  } catch (e) {}
}

console.log('\n--- Generated Files ---');
listFiles(sp.targetDir);
