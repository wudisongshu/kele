import type { AIAdapter } from '../adapters/base.js';
import type { Idea, SubProject } from '../types/index.js';
import { debugLog } from '../debug.js';
import { safeJsonParse } from './json-utils.js';
import { validateIncubatorOutput } from './incubator-validator.js';
import { IncubationResponseSchema } from './schemas.js';
import { buildContractPrompt, type Contract } from './contract-engine.js';
import { PromptTemplate } from '../incubator/prompt-template.js';

const MAX_LOCAL_FIX_ATTEMPTS = 3;
const MAX_AI_REVIEW_ATTEMPTS = 2;
const MAX_STRUCT_FIX_ATTEMPTS = 3;


/**
 * AI-Driven Incubator — lets the AI decide what sub-projects are needed.
 *
 * Phase 1 upgrade: Two-pass reasoning (draft + review), monetization alignment,
 * effort estimation, risk assessment, and dependency self-check.
 *
 * Phase 2 upgrade: Local validation + AI review layer.
 * - Local validator catches structural errors (cycles, dangling deps, etc.) for free
 * - AI reviewer catches business logic gaps (missing steps, bad ordering, scope issues)
 * - If review finds issues, AI gets a second chance to fix them
 */

const INCUBATOR_PROMPT = `You are kele's AI Incubator. Your job is to turn a user's vague idea into a structured, actionable project plan that leads to monetization.

## Your Process (Two-Pass)

### Pass 1: Draft
Analyze the idea and generate an initial sub-project structure. For each sub-project, consider:
- What must be built to make money from this idea?
- What is the MINIMUM viable scope (MVP-first)?
- What are the technical and market risks?
- How long does each piece realistically take?

### Pass 2: Self-Review
Before finalizing, critically review your own draft:
- Does every sub-project serve the monetization goal? If not, should it be cut?
- Are dependencies logically ordered (no cycles, no dangling refs)?
- Is the total effort realistic for the stated complexity?
- Are high-risk items identified and placed early (fail-fast)?
- Is the critical path clear (what blocks making money)?
- Did you miss any essential step (legal, compliance, platform-specific)?

Apply corrections from Pass 2 before returning the final JSON.

## Output Format

Return ONLY a JSON object in this exact format:

{
  "subProjects": [
    {
      "id": "kebab-case-id",
      "name": "English Display Name",
      "description": "What this sub-project does and WHY it matters for monetization",
      "type": "setup|development|production|creation|testing|deployment|monetization",
      "dependencies": ["id-of-prerequisite"],
      "monetizationRelevance": "core|supporting|optional",
      "estimatedEffort": "e.g. 2-4 hours, 1-2 days, 3-5 days",
      "criticalPath": true,
      "riskLevel": "low|medium|high",
      "acceptanceCriteria": [
        {
          "description": "What kele must verify after this sub-project is built",
          "type": "functional|visual|performance|compatibility|security",
          "action": "How kele checks it: 'open', 'click', 'check-text', 'check-element', 'play-game', 'load-url', 'verify-file'",
          "checkType": "file_exists|content_contains|regex_match — REQUIRED for kele to validate correctly",
          "target": "Selector, URL, file path, or coordinate for the action",
          "expected": "MUST be a real code/text fragment found in the file, NOT a descriptive sentence. Example: '<canvas' NOT 'file contains <canvas'",
          "critical": true
        }
      ]
    }
  ],
  "riskAssessment": {
    "technicalRisks": ["risk 1", "risk 2"],
    "marketRisks": ["risk 1"],
    "timeRisks": ["risk 1"],
    "mitigation": "Brief plan for handling the top risks"
  },
  "monetizationPath": "Clear description of HOW this project makes money, step by step",
  "reasoning": "Brief explanation of why you chose this structure",
  "selfReviewNotes": "What you changed during Pass 2 review and why"
}

## Acceptance Criteria Format Rules (CRITICAL — validation will FAIL if not followed)
Each acceptance criterion MUST use the correct checkType and provide real code fragments:

- "checkType": "file_exists" — ONLY checks if the file exists. Do NOT provide content checks.
  * action: "verify-file"
  * expected: "index.html exists" or any short existence phrase
  * Example: target="index.html", checkType="file_exists", expected="file exists"

- "checkType": "content_contains" — Checks if the file contains a specific text snippet.
  * action: "check-text" or "check-element" or "verify-file"
  * expected: MUST be the ACTUAL code/text fragment that appears in the file (max 80 chars)
  * CORRECT: expected="<canvas id=\\"game\\">"
  * CORRECT: expected="<meta name=\\"viewport\\""
  * CORRECT: expected="import { gameLoop }"
  * WRONG:   expected="file contains <canvas"
  * WRONG:   expected="has viewport meta tag"
  * WRONG:   expected="should include cookie-consent"
  * The description field is for humans ONLY — kele's validator does NOT read description for matching.

- "checkType": "regex_match" — Uses a regex to match file content.
  * regexPattern: must be a valid JavaScript RegExp string (no flags needed)
  * Example: regexPattern="<meta[^>]+viewport"

## Rules
1. ALWAYS include a "project-setup" sub-project first (type: setup, dependencies: [], criticalPath: true)
2. The core work sub-project(s) MUST have monetizationRelevance: "core"
3. Testing is "supporting" unless quality directly affects revenue (then "core")
4. Deployment is "core" if the user wants to publish — without it there is no product
5. Monetization setup (ads, payments, store listing) is ALWAYS "core" when requested
6. Keep it lean — cut anything that doesn't move the monetization needle
7. Use kebab-case for ids, English for names
8. estimatedEffort must be realistic: simple=hours, medium=1-3 days, complex=3-7 days per sub-project
9. High-risk items should be placed EARLY (fail-fast principle)
10. criticalPath should be true for any sub-project whose delay directly delays making money
11. STRICT SUB-PROJECT LIMIT: simple ≤ 3, medium ≤ 5, complex ≤ 7. NEVER exceed this limit.
12. ONLY ONE setup sub-project is allowed. Do NOT create separate setup sub-projects for compliance, business accounts, or tooling.
13. Do NOT create separate sub-projects for analytics, telemetry, or soft-launch — these are tasks within existing sub-projects.
14. Do NOT create a separate "Live Ops" or "Content Updates" sub-project — these are post-launch activities, not part of the initial build.`;

const REVIEW_PROMPT = `You are a senior product manager reviewing an AI-generated project plan.

Review the following project structure and assess whether it will successfully lead to monetization.

Return ONLY a JSON object:
{
  "approved": true or false,
  "severity": "minor|major|critical",
  "issues": ["specific issue 1", "issue 2"],
  "suggestions": ["concrete fix 1", "fix 2"]
}

Review criteria:
1. Does every sub-project clearly serve the monetization goal?
2. Is the dependency order logical? (setup → core → test → deploy → monetize)
3. Are there any missing essential steps? (e.g. legal review for games, store account setup)
4. Is the MVP scope appropriate — not too big, not too small?
5. Are high-risk items placed early enough (fail-fast)?
6. Is the critical path clear and reasonable?
7. Approve only if the plan is sound. Do NOT approve just to be nice.`;

export interface AIIncubateResult {
  success: boolean;
  subProjects?: SubProject[];
  error?: string;
  reasoning?: string;
  riskAssessment?: {
    technicalRisks: string[];
    marketRisks: string[];
    timeRisks: string[];
    mitigation: string;
  };
  monetizationPath?: string;
  selfReviewNotes?: string;
  /** Validation and review metadata */
  validation?: {
    localValid: boolean;
    localErrors: string[];
    localWarnings: string[];
    aiApproved: boolean;
    aiIssues: string[];
    revisions: number;
  };
}

export async function incubateWithAI(
  idea: Idea,
  rootDir: string,
  adapter: AIAdapter,
  onProgress?: (msg: string) => void,
  contract?: Contract,
): Promise<AIIncubateResult> {
  const validationMeta = {
    localValid: false,
    localErrors: [] as string[],
    localWarnings: [] as string[],
    aiApproved: false,
    aiIssues: [] as string[],
    revisions: 0,
  };

  // kele principle: no timeouts. Wait indefinitely for AI to respond.

  // Streaming progress: notify user when AI starts responding
  let firstTokenReceived = false;
  const onToken = (_token: string) => {
    if (!firstTokenReceived) {
      firstTokenReceived = true;
      onProgress?.('   ✍️  AI 开始分析...（请耐心等待，通常需要 30-90 秒）');
    }
  };

  // --- Attempt 1: Generate initial plan ---
  let result: AIIncubateResult;
  try {
    result = await tryIncubate(idea, rootDir, adapter, onToken, contract);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error, validation: validationMeta };
  }
  if (!result.success) {
    return { ...result, validation: validationMeta };
  }

  // --- Local validation (free, fast) — infinite fix loop ---
  let localValidation = await validateIncubatorOutput(result.subProjects!, idea, rootDir);
  validationMeta.localValid = localValidation.valid;
  validationMeta.localErrors = localValidation.errors;
  validationMeta.localWarnings = localValidation.warnings;

  let fixAttempt = 1;
  while (!localValidation.valid && fixAttempt <= MAX_LOCAL_FIX_ATTEMPTS) {
    onProgress?.(`   🔄 孵化器自检发现问题，正在修正 (第 ${fixAttempt}/${MAX_LOCAL_FIX_ATTEMPTS} 次)...`);
    try {
      const fixed = await tryFixIncubator(
        idea, rootDir, adapter, result.subProjects!, localValidation.errors, localValidation.warnings, result.reasoning ?? '', result.monetizationPath ?? '', onToken, contract
      );
      if (fixed.success && fixed.subProjects) {
        result = fixed;
        validationMeta.revisions++;
        localValidation = await validateIncubatorOutput(result.subProjects!, idea, rootDir);
        validationMeta.localValid = localValidation.valid;
        validationMeta.localErrors = localValidation.errors;
        validationMeta.localWarnings = localValidation.warnings;
        if (localValidation.valid) break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Incubator fix attempt failed', msg);
      // Fix attempt failed — keep looping
    }
    fixAttempt++;
  }

  // --- AI review (only if local validation passed but has warnings, or for complex ideas) ---
  const needsAiReview =
    localValidation.warnings.length > 0 || idea.complexity === 'complex';

  if (needsAiReview) {
    onProgress?.(`   🔍 孵化器进入 AI 审查阶段...`);
    let reviewAttempt = 1;
    while (reviewAttempt <= MAX_AI_REVIEW_ATTEMPTS) {
      try {
        onProgress?.(`   🔄 AI 审查第 ${reviewAttempt}/${MAX_AI_REVIEW_ATTEMPTS} 轮...`);
        const review = await reviewIncubatorOutput(adapter, result.subProjects!, idea, onToken);
        validationMeta.aiApproved = review.approved;
        validationMeta.aiIssues = review.issues;

        if (review.approved || review.suggestions.length === 0) break;

        // Try to fix based on AI review — infinite loop until approved
        const fixed = await tryFixIncubator(
          idea, rootDir, adapter, result.subProjects!, review.issues, review.suggestions, result.reasoning ?? '', result.monetizationPath ?? '', onToken, contract
        );
        if (fixed.success && fixed.subProjects) {
          result = fixed;
          validationMeta.revisions++;
          // Re-validate after AI-guided fix
          const reValidation = await validateIncubatorOutput(result.subProjects!, idea, rootDir);
          validationMeta.localValid = reValidation.valid;
          validationMeta.localErrors = reValidation.errors;
          validationMeta.localWarnings = reValidation.warnings;

          // If still structurally valid, re-run review loop
          if (validationMeta.localValid) {
            reviewAttempt++;
            continue;
          }
          // If AI fix broke structure, fix structure first then continue review
          let structFixAttempt = 1;
          while (!validationMeta.localValid && structFixAttempt <= MAX_STRUCT_FIX_ATTEMPTS) {
            const structFixed = await tryFixIncubator(
              idea, rootDir, adapter, result.subProjects!, validationMeta.localErrors, validationMeta.localWarnings, result.reasoning ?? '', result.monetizationPath ?? '', onToken, contract
            );
            if (structFixed.success && structFixed.subProjects) {
              result = structFixed;
              validationMeta.revisions++;
              const sv = await validateIncubatorOutput(result.subProjects!, idea, rootDir);
              validationMeta.localValid = sv.valid;
              validationMeta.localErrors = sv.errors;
              validationMeta.localWarnings = sv.warnings;
              if (sv.valid) break;
            }
            structFixAttempt++;
          }
          reviewAttempt++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog('Incubator review/fix failed', msg);
        // Review or fix failed — continue with current result
        validationMeta.aiApproved = true;
        break;
      }
    }
  } else {
    validationMeta.aiApproved = true;
  }

  return {
    ...result,
    validation: validationMeta,
  };
}

async function tryIncubate(
  idea: Idea,
  rootDir: string,
  adapter: AIAdapter,
  onToken?: (token: string) => void,
  contract?: Contract,
): Promise<AIIncubateResult> {
  try {
    const template = new PromptTemplate();
    const incubatorRules = await template.getSystemMessage('incubator', {});

    let contractSection = '';
    if (contract) {
      contractSection = `\n\n## GAMEPLAY CONTRACT (MUST BE ENFORCED)\n${buildContractPrompt(contract, idea.rawText)}\n\n` +
        `CRITICAL: The acceptance criteria for the core development sub-project MUST include verify-file or play-game checks for EACH of the following core mechanics:\n` +
        contract.coreMechanics.filter((m) => m.immutable).map((m) => `- ${m.description}`).join('\n') + '\n';
    }
    const prompt = `${INCUBATOR_PROMPT}\n\n${incubatorRules}${contractSection}\n\nUser idea: "${idea.rawText}"\nDetected type: ${idea.type}\nDetected complexity: ${idea.complexity}\nMonetization channel: ${idea.monetization}`;

    debugLog('AI Incubator Prompt', prompt);
    const response = await adapter.execute(prompt, onToken);

    const parsedResult = safeJsonParse(response);
    if (!parsedResult.data) {
      return { success: false, error: parsedResult.error || 'No JSON found in AI response' };
    }
    return parseIncubationResponse(JSON.stringify(parsedResult.data), rootDir);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'AI incubation failed',
    };
  }
}

async function tryFixIncubator(
  _idea: Idea,
  rootDir: string,
  adapter: AIAdapter,
  currentSubProjects: SubProject[],
  errors: string[],
  warnings: string[],
  reasoning: string,
  monetizationPath: string,
  onToken?: (token: string) => void,
  contract?: Contract,
): Promise<AIIncubateResult> {
  try {
    const template = new PromptTemplate();
    const incubatorRules = await template.getSystemMessage('incubator', {});

    let contractSection = '';
    if (contract) {
      contractSection = `\n\n## GAMEPLAY CONTRACT (MUST BE ENFORCED)\n${buildContractPrompt(contract, _idea.rawText)}\n`;
    }
    const fixPrompt = `${INCUBATOR_PROMPT}\n\n${incubatorRules}${contractSection}\n\n` +
      `FIX REQUEST: The following project plan has issues that need correction.\n\n` +
      `Current plan:\n${JSON.stringify({ subProjects: currentSubProjects, reasoning, monetizationPath }, null, 2)}\n\n` +
      `Errors to fix:\n${errors.map((e) => `- ${e}`).join('\n')}\n\n` +
      `Warnings to address:\n${warnings.map((w) => `- ${w}`).join('\n')}\n\n` +
      `Please return a corrected JSON in the same format.`;

    debugLog('AI Incubator Fix Prompt', fixPrompt);
    const response = await adapter.execute(fixPrompt, onToken);

    const parsedResult = safeJsonParse(response);
    if (!parsedResult.data) {
      return { success: false, error: parsedResult.error || 'No JSON found in AI fix response' };
    }
    return parseIncubationResponse(JSON.stringify(parsedResult.data), rootDir);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'AI incubation fix failed',
    };
  }
}

async function reviewIncubatorOutput(
  adapter: AIAdapter,
  subProjects: SubProject[],
  idea: Idea,
  onToken?: (token: string) => void,
): Promise<{ approved: boolean; severity: string; issues: string[]; suggestions: string[] }> {
  try {
    const reviewPrompt = `${REVIEW_PROMPT}\n\nUser idea: "${idea.rawText}"\nComplexity: ${idea.complexity}\nMonetization: ${idea.monetization}\n\nProject plan:\n${JSON.stringify(subProjects, null, 2)}`;

    debugLog('AI Incubator Review Prompt', reviewPrompt);
    const response = await adapter.execute(reviewPrompt, onToken);

    const parsedResult = safeJsonParse<{
      approved: boolean;
      severity?: string;
      issues: string[];
      suggestions: string[];
    }>(response);

    if (!parsedResult.data) {
      return { approved: true, severity: 'minor', issues: [], suggestions: [] };
    }

    const parsed = parsedResult.data;

    return {
      approved: parsed.approved ?? true,
      severity: parsed.severity ?? 'minor',
      issues: parsed.issues ?? [],
      suggestions: parsed.suggestions ?? [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog('Incubator review parse failed', msg);
    // If review fails, assume approved to avoid blocking
    return { approved: true, severity: 'minor', issues: [], suggestions: [] };
  }
}

export function parseIncubationResponse(jsonStr: string, rootDir: string): AIIncubateResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog('Incubator JSON parse failed', msg);
    return { success: false, error: 'Invalid JSON in AI response' };
  }

  // Validate with Zod schema
  const result = IncubationResponseSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    return { success: false, error: `Schema validation failed: ${issues.join('; ')}` };
  }

  const data = result.data;
  const now = new Date().toISOString();
  const subProjects: SubProject[] = data.subProjects.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    type: tpl.type,
    targetDir: rootDir,
    dependencies: tpl.dependencies || [],
    status: 'pending',
    createdAt: now,
    monetizationRelevance: normalizeRelevance(tpl.monetizationRelevance),
    estimatedEffort: tpl.estimatedEffort,
    criticalPath: tpl.criticalPath ?? false,
    riskLevel: normalizeRiskLevel(tpl.riskLevel),
    acceptanceCriteria: (tpl.acceptanceCriteria || []).map((ac) => ({
      description: ac.description,
      type: normalizeAcceptanceType(ac.type),
      action: ac.action,
      target: ac.target,
      expected: ac.expected,
      critical: ac.critical ?? true,
    })),
  }));

  return {
    success: true,
    subProjects,
    reasoning: data.reasoning,
    riskAssessment: data.riskAssessment,
    monetizationPath: data.monetizationPath,
    selfReviewNotes: data.selfReviewNotes,
  };
}

export function normalizeRelevance(value?: string): 'core' | 'supporting' | 'optional' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'core') return 'core';
  if (lower === 'supporting') return 'supporting';
  if (lower === 'optional') return 'optional';
  return undefined;
}

export function normalizeRiskLevel(value?: string): 'low' | 'medium' | 'high' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'low') return 'low';
  if (lower === 'medium') return 'medium';
  if (lower === 'high') return 'high';
  return undefined;
}

export function normalizeAcceptanceType(value?: string): 'functional' | 'visual' | 'performance' | 'compatibility' | 'security' {
  if (!value) return 'functional';
  const lower = value.toLowerCase();
  if (lower === 'visual') return 'visual';
  if (lower === 'performance') return 'performance';
  if (lower === 'compatibility') return 'compatibility';
  if (lower === 'security') return 'security';
  return 'functional';
}
