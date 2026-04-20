import type { AIAdapter } from '../adapters/base.js';
import type { Idea, SubProject } from '../types/index.js';
import { debugLog } from '../debug.js';
import { validateIncubatorOutput } from './incubator-validator.js';
import { IncubationResponseSchema } from './schemas.js';

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
          "target": "Selector, URL, file path, or coordinate for the action",
          "expected": "What kele should observe to consider this criterion PASSED",
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

## Acceptance Criteria Rules
Each sub-project MUST include 3-7 acceptance criteria that kele can EXECUTE automatically:
- For **setup**: verify-file checks ("package.json exists", "index.html has canvas element")
- For **game development**: play-game checks ("canvas renders 8x8 grid", "clicking a gem selects it", "swapping adjacent gems triggers match detection", "3+ matches eliminate and score updates", "gravity refills the board")
- For **deployment** (web/H5): 
  - verify-file: ".github/workflows/deploy.yml exists" (critical)
  - check-text: ".github/workflows/deploy.yml contains actions/deploy-pages" (critical)
  - check-text: ".github/workflows/deploy.yml contains actions/checkout" (critical)
  - check-text: ".github/workflows/deploy.yml contains upload-pages-artifact" (critical)
  - check-text: ".github/workflows/deploy.yml contains configure-pages" (critical)
  - verify-file: "ads.txt exists" (critical)
  - verify-file: "adsense.html exists" (critical)
  - verify-file: "CNAME exists" (non-critical)
  - verify-file: "SETUP.md exists" (critical)
- For **monetization** (web/H5):
  - verify-file: "adsense.html exists and contains adsbygoogle script" (critical)
  - check-text: "adsense.html contains pagead2.googlesyndication.com" (critical)
  - verify-file: "ads.txt exists" (critical)
  - verify-file: "MONETIZE.md exists" (critical)
- action must be one of: "open", "click", "check-text", "check-element", "play-game", "load-url", "verify-file"
- target should be specific enough for automation (CSS selector, file path, or URL)
- critical=true for criteria that block acceptance; critical=false for nice-to-have

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
  adapter: AIAdapter
): Promise<AIIncubateResult> {
  const validationMeta = {
    localValid: false,
    localErrors: [] as string[],
    localWarnings: [] as string[],
    aiApproved: false,
    aiIssues: [] as string[],
    revisions: 0,
  };

  // --- Attempt 1: Generate initial plan ---
  let result = await tryIncubate(idea, rootDir, adapter);
  if (!result.success) {
    return { ...result, validation: validationMeta };
  }

  // --- Local validation (free, fast) ---
  const localValidation = validateIncubatorOutput(result.subProjects!, idea);
  validationMeta.localValid = localValidation.valid;
  validationMeta.localErrors = localValidation.errors;
  validationMeta.localWarnings = localValidation.warnings;

  if (!localValidation.valid) {
    // Structural errors — AI needs to fix them
    const fixed = await tryFixIncubator(
      idea,
      rootDir,
      adapter,
      result.subProjects!,
      localValidation.errors,
      localValidation.warnings,
      result.reasoning ?? '',
      result.monetizationPath ?? ''
    );
    if (fixed.success && fixed.subProjects) {
      result = fixed;
      validationMeta.revisions++;
      // Re-validate after fix
      const reValidation = validateIncubatorOutput(result.subProjects!, idea);
      validationMeta.localValid = reValidation.valid;
      validationMeta.localErrors = reValidation.errors;
      validationMeta.localWarnings = reValidation.warnings;
    }
  }

  // If still structurally invalid after fix attempt, return with error
  if (!validationMeta.localValid) {
    return {
      success: false,
      error: `孵化器输出验证失败: ${validationMeta.localErrors.join('; ')}`,
      validation: validationMeta,
    };
  }

  // --- AI review (only if local validation passed but has warnings, or for complex ideas) ---
  const needsAiReview =
    localValidation.warnings.length > 0 || idea.complexity === 'complex';

  if (needsAiReview) {
    const review = await reviewIncubatorOutput(adapter, result.subProjects!, idea);
    validationMeta.aiApproved = review.approved;
    validationMeta.aiIssues = review.issues;

    if (!review.approved && review.suggestions.length > 0) {
      // Try to fix based on AI review
      const fixed = await tryFixIncubator(
        idea,
        rootDir,
        adapter,
        result.subProjects!,
        review.issues,
        review.suggestions,
        result.reasoning ?? '',
        result.monetizationPath ?? ''
      );
      if (fixed.success && fixed.subProjects) {
        result = fixed;
        validationMeta.revisions++;
        // Re-validate after AI-guided fix
        const reValidation = validateIncubatorOutput(result.subProjects!, idea);
        validationMeta.localValid = reValidation.valid;
        validationMeta.localErrors = reValidation.errors;
        validationMeta.localWarnings = reValidation.warnings;

        // If AI fix introduced structural errors, fail fast
        if (!validationMeta.localValid) {
          return {
            success: false,
            error: `AI review fix broke structure: ${validationMeta.localErrors.join('; ')}`,
            validation: validationMeta,
          };
        }
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
  adapter: AIAdapter
): Promise<AIIncubateResult> {
  try {
    const prompt = `${INCUBATOR_PROMPT}\n\nUser idea: "${idea.rawText}"\nDetected type: ${idea.type}\nDetected complexity: ${idea.complexity}\nMonetization channel: ${idea.monetization}`;

    debugLog('AI Incubator Prompt', prompt);
    const response = await adapter.execute(prompt);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    return parseIncubationResponse(jsonStr, rootDir);
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
  monetizationPath: string
): Promise<AIIncubateResult> {
  try {
    const fixPrompt = `${INCUBATOR_PROMPT}\n\n` +
      `FIX REQUEST: The following project plan has issues that need correction.\n\n` +
      `Current plan:\n${JSON.stringify({ subProjects: currentSubProjects, reasoning, monetizationPath }, null, 2)}\n\n` +
      `Errors to fix:\n${errors.map((e) => `- ${e}`).join('\n')}\n\n` +
      `Warnings to address:\n${warnings.map((w) => `- ${w}`).join('\n')}\n\n` +
      `Please return a corrected JSON in the same format.`;

    debugLog('AI Incubator Fix Prompt', fixPrompt);
    const response = await adapter.execute(fixPrompt);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;
    return parseIncubationResponse(jsonStr, rootDir);
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
  idea: Idea
): Promise<{ approved: boolean; severity: string; issues: string[]; suggestions: string[] }> {
  try {
    const reviewPrompt = `${REVIEW_PROMPT}\n\nUser idea: "${idea.rawText}"\nComplexity: ${idea.complexity}\nMonetization: ${idea.monetization}\n\nProject plan:\n${JSON.stringify(subProjects, null, 2)}`;

    debugLog('AI Incubator Review Prompt', reviewPrompt);
    const response = await adapter.execute(reviewPrompt);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;

    const parsed = JSON.parse(jsonStr) as {
      approved: boolean;
      severity?: string;
      issues: string[];
      suggestions: string[];
    };

    return {
      approved: parsed.approved ?? true,
      severity: parsed.severity ?? 'minor',
      issues: parsed.issues ?? [],
      suggestions: parsed.suggestions ?? [],
    };
  } catch {
    // If review fails, assume approved to avoid blocking
    return { approved: true, severity: 'minor', issues: [], suggestions: [] };
  }
}

function parseIncubationResponse(jsonStr: string, rootDir: string): AIIncubateResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
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
    targetDir: `${rootDir}/${tpl.id}`,
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

function normalizeRelevance(value?: string): 'core' | 'supporting' | 'optional' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'core') return 'core';
  if (lower === 'supporting') return 'supporting';
  if (lower === 'optional') return 'optional';
  return undefined;
}

function normalizeRiskLevel(value?: string): 'low' | 'medium' | 'high' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower === 'low') return 'low';
  if (lower === 'medium') return 'medium';
  if (lower === 'high') return 'high';
  return undefined;
}

function normalizeAcceptanceType(value?: string): 'functional' | 'visual' | 'performance' | 'compatibility' | 'security' {
  if (!value) return 'functional';
  const lower = value.toLowerCase();
  if (lower === 'visual') return 'visual';
  if (lower === 'performance') return 'performance';
  if (lower === 'compatibility') return 'compatibility';
  if (lower === 'security') return 'security';
  return 'functional';
}
