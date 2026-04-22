/**
 * Context Compressor — reduces prompt size for large projects.
 *
 * Problem: When projects exceed 3 sub-projects or 20 files,
 * the full file tree + all sub-project descriptions bloat the prompt,
 * wasting tokens and diluting AI attention.
 *
 * Strategy:
 * - Keep current sub-project and its direct dependencies in FULL detail
 * - Compress other sub-projects to one-line summaries
 * - Keep only task-relevant files + interface/type definitions + PROJECT_SUMMARY.md
 * - Keep only last 3 completed task result summaries (not full output)
 */

import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { debugLog } from '../debug.js';
import { join } from 'path';
import type { Project, SubProject, Task } from '../types/index.js';

export interface ProjectSize {
  subProjectCount: number;
  fileCount: number;
}

export interface CompressedContext {
  /** The compressed context string to inject into prompt */
  context: string;
  /** Whether compression was actually applied */
  wasCompressed: boolean;
  /** Stats for logging */
  originalLength: number;
  compressedLength: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold detection
// ─────────────────────────────────────────────────────────────────────────────

export function getProjectSize(project: Project): ProjectSize {
  let fileCount = 0;
  for (const sp of project.subProjects) {
    fileCount += countFiles(sp.targetDir);
  }
  return {
    subProjectCount: project.subProjects.length,
    fileCount,
  };
}

export function shouldCompress(project: Project): boolean {
  const threshold = parseInt(process.env.KELE_CONTEXT_THRESHOLD || '3', 10);
  const size = getProjectSize(project);
  return size.subProjectCount > threshold || size.fileCount > 20;
}

function countFiles(dir: string, maxDepth = 2): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  function walk(d: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = readdirSync(d);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry.startsWith('.')) continue;
        const full = join(d, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full, depth + 1);
        } else {
          count++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Context compressor permission error', msg);
    }
  }
  walk(dir, 0);
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// File tree filtering
// ─────────────────────────────────────────────────────────────────────────────

const RELEVANT_FILE_PATTERNS = [
  /\.(ts|tsx|js|jsx)$/i,       // source code
  /\.(d\.ts)$/i,               // type definitions
  /package\.json$/i,           // manifest
  /tsconfig\.json$/i,          // config
  /manifest\.json$/i,          // PWA
  /game\.json$/i,              // mini-game
  /project\.config\.json$/i,   // WeChat/Douyin
  /PROJECT_SUMMARY\.md$/i,     // generated summary
  /index\.html$/i,             // entry
  /\.env/i,                    // env
];

function isRelevantFile(fileName: string): boolean {
  return RELEVANT_FILE_PATTERNS.some((p) => p.test(fileName));
}

function isInterfaceFile(fileName: string): boolean {
  return fileName.endsWith('.d.ts') || fileName.includes('types.') || fileName.includes('interface.');
}

/**
 * Build a filtered file tree showing only relevant files.
 */
export function getCompressedFileTree(targetDir: string, maxDepth = 2): string {
  if (!existsSync(targetDir)) return '';
  const lines: string[] = [];
  function walk(dir: string, prefix: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry.startsWith('.')) continue;
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          const childLines = getChildLines(fullPath, depth + 1, maxDepth);
          if (childLines.length > 0) {
            lines.push(`${prefix}${entry}/`);
            lines.push(...childLines);
          }
        } else if (isRelevantFile(entry)) {
          const tag = isInterfaceFile(entry) ? ' [types]' : '';
          const size = stat.size;
          const sizeStr = size < 1024 ? `${size}B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)}KB` : `${(size / 1024 / 1024).toFixed(1)}MB`;
          lines.push(`${prefix}${entry} (${sizeStr})${tag}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Context compressor stat error', msg);
    }
  }
  function getChildLines(dir: string, depth: number, maxD: number): string[] {
    if (depth > maxD) return [];
    const result: string[] = [];
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry.startsWith('.')) continue;
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          const child = getChildLines(fullPath, depth + 1, maxD);
          if (child.length > 0) {
            result.push(`  ${entry}/`);
            result.push(...child.map((l) => '  ' + l));
          }
        } else if (isRelevantFile(entry)) {
          const tag = isInterfaceFile(entry) ? ' [types]' : '';
          result.push(`  ${entry}${tag}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Context compressor readdir error', msg);
    }
    return result;
  }
  walk(targetDir, '', 0);
  return lines.length > 0 ? lines.join('\n') : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Task summary generation
// ─────────────────────────────────────────────────────────────────────────────

export function generateTaskSummary(task: Task): string {
  const resultPreview = task.result
    ? task.result.slice(0, 200).replace(/\s+/g, ' ')
    : 'no output';
  return `- ${task.title} (${task.status}): ${resultPreview}${task.result && task.result.length > 200 ? '...' : ''}`;
}

/**
 * Summarize recent completed tasks, keeping only the last N.
 */
export function summarizeRecentTasks(tasks: Task[], limit = 3): string {
  const completed = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
    .slice(0, limit);

  if (completed.length === 0) return 'No recent completed tasks.';
  return completed.map(generateTaskSummary).join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-project compression
// ─────────────────────────────────────────────────────────────────────────────

function formatSubProjectFull(sp: SubProject): string {
  return `  - ${sp.name} (${sp.type}) [${sp.status}]\n    Target: ${sp.targetDir}\n    Desc: ${sp.description}\n    Deps: ${sp.dependencies.join(', ') || 'none'}`;
}

function formatSubProjectSummary(sp: SubProject): string {
  return `  - ${sp.name} (${sp.type}) [${sp.status}] — ${sp.description.slice(0, 80)}${sp.description.length > 80 ? '...' : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main compression function
// ─────────────────────────────────────────────────────────────────────────────

export function compressProjectContext(
  project: Project,
  currentSubProject: SubProject,
  _currentTask: Task
): CompressedContext {
  const originalPromptPreview = buildOriginalPreview(project, currentSubProject);

  // 1. Current sub-project in full
  const currentSection = `CURRENT SUB-PROJECT (FULL):\n${formatSubProjectFull(currentSubProject)}`;

  // 2. Direct dependencies in full
  const depIds = currentSubProject.dependencies;
  const deps = project.subProjects.filter((sp) => depIds.includes(sp.id));
  const depSection = deps.length > 0
    ? `\nDIRECT DEPENDENCIES (FULL):\n${deps.map(formatSubProjectFull).join('\n')}`
    : '';

  // 3. Other sub-projects compressed to one-line
  const others = project.subProjects.filter(
    (sp) => sp.id !== currentSubProject.id && !depIds.includes(sp.id)
  );
  const otherSection = others.length > 0
    ? `\nOTHER SUB-PROJECTS (SUMMARY):\n${others.map(formatSubProjectSummary).join('\n')}`
    : '';

  // 4. File tree — filtered to relevant files only
  const fileTree = getCompressedFileTree(currentSubProject.targetDir);
  const fileTreeSection = fileTree
    ? `\nRELEVANT FILES (filtered):\n${fileTree}`
    : '';

  // 5. Read PROJECT_SUMMARY.md if exists
  const summaryPath = join(currentSubProject.targetDir, 'PROJECT_SUMMARY.md');
  let summarySection = '';
  if (existsSync(summaryPath)) {
    try {
      const summaryContent = readFileSync(summaryPath, 'utf-8').slice(0, 2000);
      summarySection = `\nPROJECT SUMMARY:\n${summaryContent}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog('Context compressor summary read error', msg);
    }
  }

  // 6. Recent task summaries
  const taskSection = `\nRECENT TASKS (last 3):\n${summarizeRecentTasks(project.tasks)}`;

  const context = [
    currentSection,
    depSection,
    otherSection,
    fileTreeSection,
    summarySection,
    taskSection,
  ].filter(Boolean).join('\n');

  return {
    context,
    wasCompressed: true,
    originalLength: originalPromptPreview.length,
    compressedLength: context.length,
  };
}

function buildOriginalPreview(project: Project, currentSp: SubProject): string {
  // Rough estimate of what the uncompressed prompt would look like
  const allSp = project.subProjects.map((sp) => formatSubProjectFull(sp)).join('\n');
  const tree = getCompressedFileTree(currentSp.targetDir); // we use same for estimation
  return `${allSp}\n${tree}`;
}

/**
 * Build the project context section for a prompt.
 * Automatically compresses if project exceeds thresholds.
 * Returns the context string and compression stats (if any).
 */
export function buildProjectContext(
  project: Project,
  currentSubProject: SubProject,
  currentTask: Task
): { context: string; compressed: boolean; savedPercent?: number } {
  if (shouldCompress(project)) {
    const result = compressProjectContext(project, currentSubProject, currentTask);
    const savedPercent = result.originalLength > 0
      ? Math.round((1 - result.compressedLength / result.originalLength) * 100)
      : 0;
    return {
      context: result.context,
      compressed: true,
      savedPercent: Math.max(0, savedPercent),
    };
  }

  // Small project: use full context (legacy behavior)
  const allSp = project.subProjects.map((sp) => formatSubProjectFull(sp)).join('\n');
  return {
    context: `ALL SUB-PROJECTS:\n${allSp}`,
    compressed: false,
  };
}
