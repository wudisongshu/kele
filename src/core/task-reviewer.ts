import type { AIAdapter } from '../adapters/base.js';
import type { Task, SubProject, Project } from '../types/index.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { debugLog } from '../debug.js';
import { safeJsonParse } from './json-utils.js';

export interface TaskReviewResult {
  verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  score: number; // 1-10
  completeness: 'complete' | 'partial' | 'missing';
  meetsRequirements: boolean;
  issues: string[];
  fixInstructions: string;
}

const REVIEW_PROMPT = `You are kele's Task Quality Reviewer. Your job is to critically evaluate whether a completed task meets its requirements.

Review the task output against:
1. Completeness — does it contain all expected files, code, or content?
2. Correctness — does the code look runnable? Are there obvious bugs, syntax errors, or missing imports?
3. Requirements — does the output match what the task asked for?
4. Compatibility — is it consistent with the project's overall goal and previous work?
5. PWA Support — for web projects, does it include manifest.json and Service Worker for offline play?

Be STRICT but fair. A "PASS" means the task is genuinely complete and usable. "PARTIAL" means it mostly works but needs minor fixes. "FAIL" means it's incomplete, broken, or wrong.

Return ONLY a JSON object:
{
  "verdict": "PASS|PARTIAL|FAIL",
  "score": 1-10,
  "completeness": "complete|partial|missing",
  "meetsRequirements": true|false,
  "issues": ["specific issue 1", "issue 2"],
  "fixInstructions": "Clear, actionable instructions for fixing the issues. Be specific about what files to change and how."
}`;

/**
 * Review a completed task's output.
 */
export async function reviewTaskOutput(
  task: Task,
  subProject: SubProject,
  project: Project,
  adapter: AIAdapter
): Promise<TaskReviewResult> {
  try {
    // Gather task output (files written to targetDir)
    const outputSummary = gatherOutputSummary(subProject.targetDir);

    const prompt = `${REVIEW_PROMPT}\n\n` +
      `Project: "${project.name}"\n` +
      `Sub-project: ${subProject.name} (${subProject.type})\n` +
      `Task: ${task.title}\n` +
      `Task description: ${task.description}\n` +
      `Project goal: "${project.idea.rawText}"\n\n` +
      `Task output (files in ${subProject.targetDir}):\n${outputSummary}\n\n` +
      `Evaluate this task output.`;

    debugLog(`Task Review Prompt [${subProject.name} / ${task.title}]`, prompt);
    const response = await adapter.execute(prompt);

    const parsedResult = safeJsonParse<{
      verdict?: string;
      score?: number;
      completeness?: string;
      meetsRequirements?: boolean;
      issues?: string[];
      fixInstructions?: string;
    }>(response);

    if (!parsedResult.data) {
      return {
        verdict: 'PARTIAL',
        score: 5,
        completeness: 'partial',
        meetsRequirements: false,
        issues: [parsedResult.error || 'Failed to parse review response'],
        fixInstructions: '',
      };
    }

    const parsed = parsedResult.data;

    return {
      verdict: normalizeVerdict(parsed.verdict),
      score: clampScore(parsed.score ?? 5),
      completeness: normalizeCompleteness(parsed.completeness),
      meetsRequirements: parsed.meetsRequirements ?? false,
      issues: parsed.issues ?? [],
      fixInstructions: parsed.fixInstructions ?? '',
    };
  } catch (err) {
    // If review fails, assume PARTIAL to be safe
    return {
      verdict: 'PARTIAL',
      score: 5,
      completeness: 'partial',
      meetsRequirements: false,
      issues: [err instanceof Error ? err.message : 'Review failed'],
      fixInstructions: 'Unable to review — manual inspection recommended',
    };
  }
}

/**
 * Build a fix task based on review results.
 */
export function buildFixTask(
  originalTask: Task,
  review: TaskReviewResult,
  subProject: SubProject
): Task {
  return {
    id: `fix-${originalTask.id}-${Date.now()}`,
    subProjectId: subProject.id,
    title: `Fix: ${originalTask.title}`,
    description: `Quality review found issues (score: ${review.score}/10, verdict: ${review.verdict}).\n\n` +
      `Issues:\n${review.issues.map((i) => `- ${i}`).join('\n')}\n\n` +
      `Fix instructions:\n${review.fixInstructions}`,
    complexity: originalTask.complexity,
    status: 'pending',
    aiProvider: undefined,
    version: 1,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Gather a summary of files in the target directory for review.
 */
function gatherOutputSummary(targetDir: string): string {
  if (!existsSync(targetDir)) {
    return '(directory does not exist)';
  }

  try {
    const entries = readdirSync(targetDir, { recursive: true, encoding: 'utf-8' }) as string[];
    const SKIP_DIRS = ['node_modules', 'dist', '.git', '.DS_Store'];
    const SKIP_EXTS = ['.map', '.lock', '.log'];

    const files = entries.filter((e) => {
      // Skip files inside excluded directories
      if (SKIP_DIRS.some(d => e.includes(d))) return false;
      // Skip certain extensions
      if (SKIP_EXTS.some(ext => e.endsWith(ext))) return false;
      try {
        const stat = readFileSync(join(targetDir, e));
        return stat !== undefined; // it's a file, not a dir
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog(`Task reviewer stat failed: ${e}`, msg);
        return false;
      }
    });

    if (files.length === 0) {
      return '(no files found)';
    }

    const summaries: string[] = [];
    for (const file of files.slice(0, 15)) {
      // Limit to 15 files to avoid overwhelming the review prompt
      try {
        const content = readFileSync(join(targetDir, file), 'utf-8');
        const preview = content.slice(0, 800);
        summaries.push(`--- ${file} ---\n${preview}${content.length > 800 ? '\n... (truncated)' : ''}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog(`Task reviewer file read failed: ${file}`, msg);
        summaries.push(`--- ${file} --- (unable to read)`);
      }
    }

    if (files.length > 15) {
      summaries.push(`\n... and ${files.length - 15} more files`);
    }

    return summaries.join('\n\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`Task reviewer directory read failed: ${targetDir}`, msg);
    return '(error reading directory)';
  }
}

function normalizeVerdict(v?: string): 'PASS' | 'PARTIAL' | 'FAIL' {
  if (!v) return 'PARTIAL';
  const upper = v.toUpperCase();
  if (upper === 'PASS') return 'PASS';
  if (upper === 'FAIL') return 'FAIL';
  return 'PARTIAL';
}

function normalizeCompleteness(c?: string): 'complete' | 'partial' | 'missing' {
  if (!c) return 'partial';
  const lower = c.toLowerCase();
  if (lower === 'complete') return 'complete';
  if (lower === 'missing') return 'missing';
  return 'partial';
}

function clampScore(s: number): number {
  return Math.max(1, Math.min(10, Math.round(s)));
}
