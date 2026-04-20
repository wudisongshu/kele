import { createRegistryFromConfig } from '../dist/adapters/index.js';
import { applyAIOutput } from '../dist/core/file-writer.js';
import { validateTaskOutput } from '../dist/core/task-validator.js';
import { runAcceptanceCriteria } from '../dist/core/acceptance-runner.js';
import { formatPlatformGuideForPrompt, getDeployableConfigTemplate } from '../dist/platform-knowledge.js';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDir = mkdtempSync(join(tmpdir(), 'kele-deploy-r1-'));
const registry = createRegistryFromConfig();
const route = registry.route('medium');

const platformSection = formatPlatformGuideForPrompt('web') || '';
const deployTemplate = getDeployableConfigTemplate('web') || '';

const prompt = `You are a senior software engineer working on the project "game-test".

Sub-project: Deployment
Description: Deploy the game to web
Target directory: ${tmpDir}
Platform template: HTML5 Canvas game template
User's original idea: "一个禅意三消游戏"
${platformSection}

CRITICAL: No platform credentials configured. Generate deployable configs with placeholders AND output a SETUP.md explaining what accounts are needed.

DEPLOYABLE CONFIG TEMPLATE for web:
${deployTemplate}

Task: Generate deployment configuration
Generate ALL configuration files needed for deployment to the target platform.

CODE QUALITY REQUIREMENTS:
1. COMPLETE IMPLEMENTATION: FULLY WORKING code. NO stubs, NO TODOs.
2. deploy.yml must use actions/deploy-pages@v4 for GitHub Pages
3. adsense.html must use standard Google AdSense responsive ad format
4. All configs must use placeholder values for missing credentials
5. SETUP.md must explain how to obtain each credential

CRITICAL: Return your response as a JSON object:
{ "files": [{ "path": "relative/path", "content": "content" }], "notes": "optional" }

MANDATORY CONSTRAINTS:
1. Each file MUST be complete and functional. NO stubs, NO TODOs.
2. If the project already has existing files, preserve them.
`;

console.log('🧪 Round 1: Testing deployment task...');
console.log('Provider:', route.provider);
const start = Date.now();

try {
  const output = await route.adapter.execute(prompt);
  const duration = Date.now() - start;
  console.log('Duration:', (duration/1000).toFixed(1) + 's');

  const files = applyAIOutput(tmpDir, output);
  console.log('Files written:', files.join(', ') || '(none)');

  const validation = validateTaskOutput(tmpDir, 'Generate deployment configuration');
  console.log('Validation:', validation.valid ? 'PASS' : 'FAIL', '(' + validation.score + '/100)');
  if (!validation.valid && validation.issues.length > 0) {
    validation.issues.slice(0, 3).forEach(i => console.log('  Issue:', i));
  }

  const acceptanceCriteria = [
    { description: 'GitHub Actions workflow exists', type: 'functional', action: 'verify-file', target: '.github/workflows/deploy.yml', expected: 'contains on:', critical: true },
    { description: 'Deploy script or CI workflow exists', type: 'functional', action: 'verify-file', target: '.github/workflows/deploy.yml', expected: 'contains deploy', critical: false },
    { description: 'AdSense snippet exists', type: 'functional', action: 'verify-file', target: 'adsense.html', expected: 'contains adsbygoogle', critical: true },
    { description: 'ads.txt exists', type: 'functional', action: 'verify-file', target: 'ads.txt', expected: 'contains google.com', critical: true },
    { description: 'CNAME exists', type: 'functional', action: 'verify-file', target: 'CNAME', expected: 'file exists', critical: false },
    { description: 'Setup guide exists', type: 'functional', action: 'verify-file', target: 'SETUP.md', expected: 'contains Step', critical: true },
    { description: 'Deploy uses actions/deploy-pages', type: 'functional', action: 'check-text', target: '.github/workflows/deploy.yml', expected: 'actions/deploy-pages', critical: true },
    { description: 'Deploy uses actions/checkout', type: 'functional', action: 'check-text', target: '.github/workflows/deploy.yml', expected: 'actions/checkout', critical: true },
    { description: 'Deploy has upload-pages-artifact', type: 'functional', action: 'check-text', target: '.github/workflows/deploy.yml', expected: 'upload-pages-artifact', critical: true },
    { description: 'Deploy has configure-pages', type: 'functional', action: 'check-text', target: '.github/workflows/deploy.yml', expected: 'configure-pages', critical: true },
    { description: 'Deploy has permissions block', type: 'functional', action: 'check-text', target: '.github/workflows/deploy.yml', expected: 'permissions:', critical: true },
    { description: 'AdSense uses standard script', type: 'functional', action: 'check-text', target: 'adsense.html', expected: 'pagead2.googlesyndication.com', critical: true },
    { description: 'AdSense has responsive attributes', type: 'functional', action: 'check-text', target: 'adsense.html', expected: 'data-full-width-responsive', critical: false },
  ];

  const mockSubProject = {
    id: 'deployment', name: 'Deployment', description: 'Deploy', type: 'deployment',
    targetDir: tmpDir, dependencies: [], status: 'pending',
    createdAt: new Date().toISOString(), acceptanceCriteria,
  };
  const acceptance = runAcceptanceCriteria(mockSubProject);
  console.log('Acceptance:', acceptance.passed ? 'PASS' : 'FAIL', '(' + acceptance.score + '/100)');
  acceptance.results.filter(r => !r.passed).forEach(r => {
    console.log('  ✗', r.criterion.description, '-', r.actual);
  });

  console.log('');
  console.log('━━ File Previews ━━');
  function listFiles(dir, prefix = '') {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        listFiles(path, prefix + entry.name + '/');
      } else {
        const content = readFileSync(path, 'utf-8');
        console.log('--- ' + prefix + entry.name + ' (' + content.length + ' chars) ---');
        console.log(content.slice(0, 400));
        if (content.length > 400) console.log('... (truncated)');
        console.log('');
      }
    }
  }
  listFiles(tmpDir);

} catch (err) {
  console.error('ERROR:', err instanceof Error ? err.message : String(err));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
