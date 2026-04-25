/**
 * Orchestrator — generate complex multi-page products from a single prompt.
 *
 * Core flow:
 * 1. analyzeRequirements() — AI breaks idea into page list
 * 2. splitIntoTasks() — build per-page generation prompts
 * 3. generatePage() — call AI, extract HTML, validate, write file
 * 4. assembleProduct() — build index.html nav + inject shared nav + data bridge
 * 5. Save project metadata
 */

import { join } from 'path';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import type { AIAdapter } from '../ai/provider.js';
import type { OrchestrateResult, GeneratedPage, GenerationTask } from './types.js';
import { analyzeRequirements } from './analyzer.js';
import { splitIntoTasks } from './splitter.js';
import { assembleProduct } from './assembler.js';
import { extractCode, validateSyntax, extractGameTitle } from '../core/generator.js';
import { injectPWATags, generatePWA } from '../pwa/generator.js';

export { analyzeRequirements, splitIntoTasks, assembleProduct };
export type { OrchestrateResult, GeneratedPage, GenerationTask };

export async function orchestrateComplexProduct(
  provider: AIAdapter,
  userPrompt: string,
  projectPath: string,
): Promise<OrchestrateResult> {
  const projectId = generateProjectId();
  const fullProjectPath = join(projectPath, `complex-${projectId}`);
  mkdirSync(fullProjectPath, { recursive: true });

  // 1. Analyze
  console.log('🧠 分析需求...');
  let requirements: { name: string; description: string; icon?: string }[];
  try {
    requirements = await analyzeRequirements(provider, userPrompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, projectPath: fullProjectPath, projectId, productName: userPrompt, pages: [], failedPages: [], error: `需求分析失败: ${msg}` };
  }

  if (requirements.length === 0) {
    return { success: false, projectPath: fullProjectPath, projectId, productName: userPrompt, pages: [], failedPages: [], error: '需求分析返回空页面列表' };
  }

  console.log(`📋 产品将包含 ${requirements.length} 个页面:`);
  for (const req of requirements) {
    console.log(`   - ${req.name}: ${req.description}`);
  }

  // 2. Split into tasks
  const tasks = splitIntoTasks(requirements);

  // 3. Generate each page
  const generatedPages: GeneratedPage[] = [];
  const failedPages: string[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    console.log(`\n🎨 生成页面 ${i + 1}/${tasks.length}: ${task.name}`);

    const page = await generatePage(provider, task, fullProjectPath);
    if (page) {
      generatedPages.push(page);
    } else {
      failedPages.push(task.name);
      console.log(`⚠️  ${task.name} 生成失败，跳过`);
    }
  }

  if (generatedPages.length === 0) {
    return { success: false, projectPath: fullProjectPath, projectId, productName: userPrompt, pages: [], failedPages, error: '所有页面生成失败' };
  }

  // 4. Extract product name from first page title
  let productName = userPrompt;
  if (generatedPages.length > 0) {
    const firstPagePath = join(fullProjectPath, generatedPages[0].fileName);
    try {
      const firstHtml = readFileSync(firstPagePath, 'utf-8');
      const titleMatch = firstHtml.match(/<title>([^<]*)<\/title>/i);
      if (titleMatch && titleMatch[1].trim()) {
        productName = titleMatch[1].trim();
      }
    } catch {
      // fallback to userPrompt
    }
  }

  // 5. Assemble
  console.log('🔧 组装产品...');
  assembleProduct(fullProjectPath, generatedPages, productName);

  // 5. Inject PWA into main entry
  try {
    const mainHtmlPath = join(fullProjectPath, 'index.html');
    const mainHtml = readFileSync(mainHtmlPath, 'utf-8');
    const injected = injectPWATags(mainHtml);
    writeFileSync(mainHtmlPath, injected, 'utf-8');

    const productTitle = generatedPages[0]?.title || userPrompt;
    await generatePWA(fullProjectPath, {
      name: productTitle,
      shortName: productTitle.slice(0, 12),
      description: userPrompt,
    });
  } catch {
    // PWA injection is non-fatal
  }

  console.log(`\n✅ 复杂产品生成完成: complex-${projectId}`);
  console.log(`   包含 ${generatedPages.length} 个页面${failedPages.length > 0 ? `，${failedPages.length} 个失败` : ''}`);
  console.log(`   目录: ${fullProjectPath}`);

  return {
    success: true,
    projectPath: fullProjectPath,
    projectId: `complex-${projectId}`,
    productName: userPrompt,
    pages: generatedPages,
    failedPages,
  };
}

async function generatePage(
  provider: AIAdapter,
  task: GenerationTask,
  projectPath: string,
): Promise<GeneratedPage | null> {
  const outputPath = join(projectPath, task.outputFile);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Use streaming to avoid gateway timeouts during long generations
      let tokenCount = 0;
      const rawCode = await provider.execute(task.prompt, (_token: string) => {
        tokenCount++;
        if (tokenCount % 100 === 0) process.stdout.write('.');
      });
      if (tokenCount >= 100) process.stdout.write('\n');
      const code = extractCode(rawCode);

      if (!code || code.length < 100) {
        console.log(`   尝试 ${attempt}: AI 返回为空或太短`);
        continue;
      }

      const syntaxResult = validateSyntax(code);
      if (!syntaxResult.valid) {
        console.log(`   尝试 ${attempt}: JS 语法错误 — ${syntaxResult.error}`);
        continue;
      }

      writeFileSync(outputPath, code, 'utf-8');

      const title = extractGameTitle(code) || task.name;
      return {
        name: task.name,
        fileName: task.outputFile,
        description: task.name, // Short name, not the full prompt
        icon: '📄',
        title,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`   尝试 ${attempt}: 生成异常 — ${msg}`);
    }
  }

  return null;
}

function generateProjectId(): string {
  return `${Date.now().toString(36)}-${randomBytes(2).toString('hex')}`;
}
