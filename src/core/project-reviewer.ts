import type { AIAdapter } from '../adapters/base.js';
import type { Project } from '../types/index.js';
import { existsSync, readdirSync } from 'fs';
import { debugLog } from '../debug.js';
import { safeJsonParse } from './json-utils.js';

export interface ProjectHealthResult {
  healthy: boolean;
  progress: 'on-track' | 'behind' | 'ahead';
  concerns: string[];
  recommendations: string[];
  scopeAdjustment?: string;
}

const HEALTH_PROMPT = `You are kele's Project Director. Evaluate the overall health of this project based on completed and remaining work.

Assess:
1. Is the project on track to achieve its monetization goal?
2. Does the completed work provide a solid foundation for remaining tasks?
3. Are there any gaps or missing critical pieces?
4. Should the scope of remaining tasks be adjusted (cut features, add missing pieces, reorder priorities)?
5. For web projects: does the project have PWA support (manifest.json, Service Worker) for better user retention?

Return ONLY a JSON object:
{
  "healthy": true or false,
  "progress": "on-track|behind|ahead",
  "concerns": ["specific concern 1", "concern 2"],
  "recommendations": ["actionable recommendation 1", "rec 2"],
  "scopeAdjustment": "Should remaining tasks be expanded, reduced, or reordered? Explain."
}`;

/**
 * Perform a health check on the project after completing a sub-project.
 */
export async function reviewProjectHealth(
  project: Project,
  adapter: AIAdapter
): Promise<ProjectHealthResult> {
  try {
    const completedSPs = project.subProjects.filter((sp) => sp.status === 'completed');
    const pendingSPs = project.subProjects.filter((sp) => sp.status !== 'completed');
    const failedTasks = project.tasks.filter((t) => t.status === 'failed');

    // Summarize what was actually built
    const completedSummary = completedSPs.map((sp) => {
      const files = listFilesBrief(sp.targetDir);
      const spTasks = project.tasks.filter((t) => t.subProjectId === sp.id);
      const taskStatus = spTasks.map((t) => `${t.title}: ${t.status}`).join(', ');
      return `- ${sp.name}: ${files.length} files (${files.slice(0, 5).join(', ')}) | Tasks: ${taskStatus}`;
    }).join('\n');

    const prompt = `${HEALTH_PROMPT}\n\n` +
      `Project: "${project.name}"\n` +
      `Goal: "${project.idea.rawText}"\n` +
      `Complexity: ${project.idea.complexity}\n` +
      `Monetization: ${project.idea.monetization}\n\n` +
      `Completed sub-projects (${completedSPs.length}/${project.subProjects.length}):\n${completedSummary || '(none yet)'}\n\n` +
      `Remaining sub-projects:\n${pendingSPs.map((sp) => `- ${sp.name} (${sp.type})`).join('\n') || '(none)'}\n\n` +
      `Failed tasks: ${failedTasks.length > 0 ? failedTasks.map((t) => t.title).join(', ') : 'none'}\n\n` +
      `Evaluate project health.`;

    debugLog('Project Health Review Prompt', prompt);
    const response = await adapter.execute(prompt);

    const parsedResult = safeJsonParse<{
      healthy?: boolean;
      progress?: string;
      concerns?: string[];
      recommendations?: string[];
      scopeAdjustment?: string;
    }>(response);

    if (!parsedResult.data) {
      return {
        healthy: true,
        progress: 'on-track',
        concerns: [parsedResult.error || 'Failed to parse health review response'],
        recommendations: ['Continue with current plan'],
      };
    }

    const parsed = parsedResult.data;

    return {
      healthy: parsed.healthy ?? true,
      progress: normalizeProgress(parsed.progress),
      concerns: parsed.concerns ?? [],
      recommendations: parsed.recommendations ?? [],
      scopeAdjustment: parsed.scopeAdjustment,
    };
  } catch (err) {
    return {
      healthy: true,
      progress: 'on-track',
      concerns: [err instanceof Error ? err.message : 'Health review failed'],
      recommendations: ['Continue with current plan'],
    };
  }
}

/**
 * Adjust remaining tasks based on health review recommendations.
 * Returns the modified project with adjusted tasks.
 */
export function adjustProjectScope(
  project: Project,
  health: ProjectHealthResult
): Project {
  if (health.healthy && health.progress === 'on-track') {
    return project; // No changes needed
  }

  // If behind schedule, drop optional tasks from remaining sub-projects
  if (health.progress === 'behind') {
    const remainingTasks = project.tasks.filter((t) => t.status === 'pending');
    for (const task of remainingTasks) {
      const sp = project.subProjects.find((s) => s.id === task.subProjectId);
      if (sp && sp.monetizationRelevance === 'optional') {
        task.status = 'skipped' as unknown as 'pending';
        // Note: 'skipped' is not in ProjectStatus, but we can repurpose
        // For now, just mark description to indicate skip
      }
    }
  }

  return project;
}

function listFilesBrief(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { recursive: true, encoding: 'utf-8' }) as string[];
  } catch {
    return [];
  }
}

function normalizeProgress(p?: string): 'on-track' | 'behind' | 'ahead' {
  if (!p) return 'on-track';
  const lower = p.toLowerCase();
  if (lower === 'behind' || lower === 'behind-schedule' || lower === 'delayed') return 'behind';
  if (lower === 'ahead' || lower === 'ahead-of-schedule') return 'ahead';
  return 'on-track';
}
