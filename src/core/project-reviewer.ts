import type { AIAdapter } from '../adapters/base.js';
import type { Project } from '../types/index.js';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { debugLog } from '../debug.js';
import { safeJsonParse } from './json-utils.js';

export interface ProjectHealthResult {
  healthy: boolean;
  progress: 'on-track' | 'behind' | 'ahead';
  concerns: string[];
  recommendations: string[];
  scopeAdjustment?: string;
  fileConflicts?: string[];
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
    // Detect file conflicts: late-stage sub-projects overwriting early-stage files
    const fileConflicts = detectFileConflicts(project);
    const conflictSection = fileConflicts.length > 0
      ? `\n⚠️ FILE CONFLICTS DETECTED:\n${fileConflicts.map((c) => `- ${c}`).join('\n')}\n`
      : '';

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
      `Failed tasks: ${failedTasks.length > 0 ? failedTasks.map((t) => t.title).join(', ') : 'none'}\n` +
      `${conflictSection}\n` +
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

    const concerns = parsed.concerns ?? [];
    if (fileConflicts.length > 0) {
      concerns.push(`检测到 ${fileConflicts.length} 个文件冲突: ${fileConflicts[0]}${fileConflicts.length > 1 ? ' 等' : ''}`);
    }

    return {
      healthy: parsed.healthy ?? true,
      progress: normalizeProgress(parsed.progress),
      concerns,
      recommendations: parsed.recommendations ?? [],
      scopeAdjustment: parsed.scopeAdjustment,
      fileConflicts,
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    debugLog(`Project reviewer readdir failed: ${dir}`, msg);
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

/**
 * Detect if late-stage sub-projects have overwritten files from early-stage ones.
 * Returns list of conflict descriptions.
 */
function detectFileConflicts(project: Project): string[] {
  const conflicts: string[] = [];
  const typeOrder = ['setup', 'development', 'production', 'creation', 'testing', 'deployment', 'monetization'];

  for (let i = 0; i < project.subProjects.length; i++) {
    const later = project.subProjects[i];
    const laterOrder = typeOrder.indexOf(later.type);
    if (laterOrder < 0) continue;

    // Only check completed sub-projects
    if (later.status !== 'completed') continue;

    const laterFiles = listFilesBrief(later.targetDir);
    for (const file of laterFiles) {
      // Skip directories
      if (file.endsWith('/')) continue;

      for (let j = 0; j < i; j++) {
        const earlier = project.subProjects[j];
        if (earlier.status !== 'completed') continue;
        const earlierOrder = typeOrder.indexOf(earlier.type);
        if (earlierOrder < 0 || earlierOrder >= laterOrder) continue;

        const earlierFilePath = join(earlier.targetDir, file);
        if (!existsSync(earlierFilePath)) continue;

        const laterFilePath = join(later.targetDir, file);
        if (!existsSync(laterFilePath)) continue;

        // Compare content hashes (mtime + size heuristic)
        try {
          const earlierStat = statSync(earlierFilePath);
          const laterStat = statSync(laterFilePath);
          if (earlierStat.mtime.getTime() !== laterStat.mtime.getTime() || earlierStat.size !== laterStat.size) {
            // If files differ, it's a potential overwrite
            // But we need to check if the later file is actually "newer" in content
            try {
              const earlierContent = readFileSync(earlierFilePath, 'utf-8');
              const laterContent = readFileSync(laterFilePath, 'utf-8');
              if (earlierContent !== laterContent) {
                conflicts.push(`${later.name}(${later.type}) 覆盖了 ${earlier.name}(${earlier.type}) 的 ${file}`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              debugLog(`Project reviewer file read failed: ${earlierFilePath}`, msg);
              // Binary or unreadable file — skip content comparison
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          debugLog(`Project reviewer stat failed: ${file}`, msg);
          // ignore stat errors
        }
      }
    }
  }

  return conflicts;
}
