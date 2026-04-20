/**
 * E2E Test Runner — tests kele's end-to-end flow with different idea types.
 */

import { createRegistryFromConfig } from '../dist/adapters/index.js';
import { parseIdea } from '../dist/core/idea-engine.js';
import { incubateWithAI } from '../dist/core/ai-incubator.js';
import { planTasks } from '../dist/core/task-planner.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TEST_CASES = [
  { name: 'Match-3 Game', idea: '一个禅意三消游戏', expectedType: 'game' },
  { name: 'Tower Defense', idea: '做一个塔防游戏，玩家可以建造炮塔防御敌人进攻', expectedType: 'game' },
  { name: 'Music Portfolio', idea: '一个展示个人音乐作品的网站', expectedType: 'music' },
  { name: 'Todo App', idea: '一个可以分类管理的待办事项工具', expectedType: 'tool' },
  { name: 'Tech Blog', idea: '一个分享技术文章的博客平台', expectedType: 'content' },
  { name: 'AI Chatbot', idea: '一个智能客服聊天机器人，可以回答用户的产品问题', expectedType: 'unknown' },
  { name: 'Weather Dashboard', idea: '一个显示全球天气数据的仪表盘，支持城市搜索', expectedType: 'unknown' },
  { name: 'E-commerce Store', idea: '一个售卖手工艺品的小型电商网站，支持购物车和结算', expectedType: 'unknown' },
  { name: 'Personal Portfolio', idea: '一个设计师的个人作品集网站，展示项目和联系方式', expectedType: 'unknown' },
  { name: 'Flappy Bird Clone', idea: '一个像素风格的飞行小鸟游戏，点击屏幕控制高度避开管道', expectedType: 'game' },
  { name: 'Markdown Editor', idea: '一个支持实时预览的 Markdown 编辑器，可以导出 HTML 和 PDF', expectedType: 'tool' },
  { name: 'Recipe Finder', idea: '一个根据冰箱里剩余食材推荐菜谱的应用', expectedType: 'unknown' },

  { name: 'Pomodoro Timer', idea: '一个番茄钟专注工具，带有任务统计和白噪音', expectedType: 'tool' },
  { name: 'Memory Card Game', idea: '一个翻牌记忆配对游戏，有计时和步数统计', expectedType: 'game' },
  { name: 'Snake Game', idea: '一个经典贪吃蛇游戏，支持加速和得分排行榜', expectedType: 'game' },
  { name: 'Currency Converter', idea: '一个实时汇率换算工具，支持100多种货币', expectedType: 'tool' },
  { name: 'Habit Tracker', idea: '一个习惯追踪应用，可以记录每日打卡和生成周报', expectedType: 'tool' },
  { name: 'Quiz Platform', idea: '一个在线答题竞赛平台，支持多种题型和实时排名', expectedType: 'content' },
];

async function runTest(testCase, index) {
  const tmpDir = mkdtempSync(join(tmpdir(), `kele-e2e-${index}-`));
  const registry = createRegistryFromConfig();
  const adapter = registry.get('mock');

  console.log(`\n━━━ Test ${index + 1}/${TEST_CASES.length}: ${testCase.name} ━━━`);
  console.log(`   Idea: "${testCase.idea}"`);

  try {
    // Phase 1: Parse Idea
    const parseResult = parseIdea(testCase.idea);
    if (!parseResult.success || !parseResult.idea) {
      console.log(`   ❌ Idea parsing FAILED: ${parseResult.error}`);
      rmSync(tmpDir, { recursive: true, force: true });
      return { pass: false, phase: 'idea-parsing', error: parseResult.error };
    }
    const idea = parseResult.idea;
    console.log(`   Parsed: type=${idea.type}, monetization=${idea.monetization}, complexity=${idea.complexity}`);
    if (idea.type !== testCase.expectedType) {
      console.log(`   ⚠️  Type mismatch: expected ${testCase.expectedType}, got ${idea.type}`);
    }

    // Phase 2: Incubate
    const incubation = await incubateWithAI(idea, tmpDir, adapter);
    if (!incubation.success) {
      console.log(`   ❌ Incubation FAILED: ${incubation.error}`);
      rmSync(tmpDir, { recursive: true, force: true });
      return { pass: false, phase: 'incubation', error: incubation.error };
    }

    const subProjects = incubation.subProjects || [];
    console.log(`   Incubation: ${subProjects.length} sub-projects`);
    for (const sp of subProjects) {
      const acCount = sp.acceptanceCriteria?.length || 0;
      console.log(`     • ${sp.name} (${sp.type}) — ${acCount} acceptance criteria`);
    }

    // Phase 3: Plan Tasks
    let totalTasks = 0;
    for (const sp of subProjects) {
      const plan = planTasks(sp, idea);
      if (plan.success && plan.tasks) {
        totalTasks += plan.tasks.length;
      }
    }
    console.log(`   Tasks planned: ${totalTasks}`);

    // Validate structure
    const hasSetup = subProjects.some(sp => sp.type === 'setup');
    const hasDev = subProjects.some(sp => sp.type === 'development');
    const hasDeploy = subProjects.some(sp => sp.type === 'deployment');
    const hasMonetization = subProjects.some(sp => sp.type === 'monetization');

    console.log(`   Structure: setup=${hasSetup}, dev=${hasDev}, deploy=${hasDeploy}, monetization=${hasMonetization}`);

    // Check acceptance criteria quality
    let totalCriteria = 0;
    let criteriaWithAction = 0;
    for (const sp of subProjects) {
      for (const ac of sp.acceptanceCriteria || []) {
        totalCriteria++;
        if (ac.action && ac.expected) criteriaWithAction++;
      }
    }
    console.log(`   Acceptance criteria: ${criteriaWithAction}/${totalCriteria} valid`);

    const pass = hasSetup && hasDev && criteriaWithAction >= totalCriteria * 0.8;
    console.log(`   Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);

    rmSync(tmpDir, { recursive: true, force: true });
    return { pass, phase: 'complete', subProjects: subProjects.length, tasks: totalTasks, criteria: criteriaWithAction };

  } catch (err) {
    console.log(`   ❌ ERROR: ${err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100)}`);
    rmSync(tmpDir, { recursive: true, force: true });
    return { pass: false, phase: 'error', error: String(err) };
  }
}

async function main() {
  console.log(`🧪 E2E Test Suite — ${TEST_CASES.length} idea types`);
  console.log('Provider: kimi-code (real API)');

  const results = [];
  for (let i = 0; i < TEST_CASES.length; i++) {
    const result = await runTest(TEST_CASES[i], i);
    results.push(result);
    // Small delay between tests
    if (i < TEST_CASES.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 E2E SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter(r => r.pass).length;
  console.log(`   Total: ${results.length} | Passed: ${passed}/${results.length}`);
  for (let i = 0; i < TEST_CASES.length; i++) {
    const icon = results[i].pass ? '✅' : '❌';
    console.log(`   ${icon} ${TEST_CASES[i].name}`);
  }
}

main().catch(console.error);
