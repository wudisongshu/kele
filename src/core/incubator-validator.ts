import type { SubProject, Idea, AcceptanceCriterion } from '../types/index.js';
import { SUBPROJECT_FILE_WHITELIST, matchWhitelist } from './file-writer.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Local validation of incubator output.
 * Catches structural problems without spending AI tokens.
 */
export function validateIncubatorOutput(
  subProjects: SubProject[],
  idea: Idea
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Hard limit on sub-project count based on complexity
  const maxAllowed = idea.complexity === 'simple' ? 3 : idea.complexity === 'medium' ? 5 : 7;
  if (subProjects.length > maxAllowed) {
    errors.push(`子项目数量 (${subProjects.length}) 超过 ${idea.complexity} 项目的硬限制 (${maxAllowed})。必须削减到 ${maxAllowed} 个或更少。`);
    // This is a hard error — we cannot proceed with an oversized plan
    return { valid: false, errors, warnings };
  }

  if (subProjects.length === 0) {
    errors.push('孵化器未生成任何子项目');
    return { valid: false, errors, warnings };
  }

  // 1. First project must be setup
  const first = subProjects[0];
  if (first.type !== 'setup') {
    errors.push(`第一个子项目必须是 setup 类型，实际是 "${first.type}"`);
  }
  if (first.dependencies.length > 0) {
    errors.push('第一个子项目（setup）不能有依赖');
  }

  // 2. Unique IDs
  const ids = new Set<string>();
  for (const sp of subProjects) {
    if (ids.has(sp.id)) {
      errors.push(`子项目 ID 重复: "${sp.id}"`);
    }
    ids.add(sp.id);
  }

  // 3. No dangling dependencies
  for (const sp of subProjects) {
    for (const depId of sp.dependencies) {
      if (!ids.has(depId)) {
        errors.push(`子项目 "${sp.id}" 依赖不存在的子项目: "${depId}"`);
      }
    }
  }

  // 4. No circular dependencies (DFS)
  const cycles = detectCycles(subProjects);
  for (const cycle of cycles) {
    errors.push(`发现循环依赖: ${cycle.join(' → ')}`);
  }

  // 5. Monetization relevance check
  const coreCount = subProjects.filter((sp) => sp.monetizationRelevance === 'core').length;
  if (coreCount === 0) {
    warnings.push('没有标记为 "core" 的变现核心子项目，可能遗漏关键步骤');
  }

  // 6. If monetization is requested, must have monetization or deployment type
  if (idea.monetization && idea.monetization !== 'unknown') {
    const hasDeploy = subProjects.some((sp) => sp.type === 'deployment' || sp.type === 'monetization');
    if (!hasDeploy) {
      warnings.push('用户提到了变现，但计划中没有 deployment 或 monetization 子项目');
    }
  }

  // 7. Complexity vs effort sanity check
  const totalEffort = estimateTotalDays(subProjects);
  const expectedMax = idea.complexity === 'simple' ? 2 : idea.complexity === 'medium' ? 7 : 21;
  if (totalEffort > expectedMax * 2) {
    warnings.push(`总预估工作量 (${totalEffort.toFixed(1)} 天) 远超 ${idea.complexity} 项目的合理范围 (${expectedMax} 天)，可能范围膨胀`);
  }
  if (totalEffort < expectedMax * 0.3 && subProjects.length > 2) {
    warnings.push(`总预估工作量 (${totalEffort.toFixed(1)} 天) 明显偏低，可能低估了难度`);
  }

  // 8. High-risk items should not all be at the end (fail-fast)
  const highRiskIndices = subProjects
    .map((sp, idx) => (sp.riskLevel === 'high' ? idx : -1))
    .filter((idx) => idx !== -1);
  if (highRiskIndices.length > 0) {
    const lastHighRisk = Math.max(...highRiskIndices);
    const avgPosition = subProjects.length / 2;
    if (lastHighRisk > avgPosition + 1) {
      warnings.push('高风险子项目集中在后期，建议前置（fail-fast 原则）');
    }
  }

  // 9. Critical path check
  const criticalCount = subProjects.filter((sp) => sp.criticalPath).length;
  if (criticalCount === subProjects.length) {
    warnings.push('所有子项目都标记为关键路径，等于没有区分优先级');
  }
  if (criticalCount === 0) {
    warnings.push('没有标记任何关键路径子项目');
  }

  // 10. Acceptance criteria whitelist validation
  for (const sp of subProjects) {
    const cw = validateCriteriaAgainstWhitelist(sp.acceptanceCriteria || [], sp.type);
    for (const w of cw.warnings) {
      warnings.push(w);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detect cycles in dependency graph using DFS.
 */
export function detectCycles(subProjects: SubProject[]): string[][] {
  const cycles: string[][] = [];
  const idToIndex = new Map<string, number>();
  subProjects.forEach((sp, idx) => idToIndex.set(sp.id, idx));

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const sp = subProjects[idToIndex.get(nodeId)!];
    if (sp) {
      for (const depId of sp.dependencies) {
        if (!visited.has(depId)) {
          dfs(depId, path);
        } else if (recStack.has(depId)) {
          // Found cycle
          const cycleStart = path.indexOf(depId);
          const cycle = path.slice(cycleStart);
          cycle.push(depId); // Close the cycle
          cycles.push(cycle);
        }
      }
    }

    path.pop();
    recStack.delete(nodeId);
  }

  for (const sp of subProjects) {
    if (!visited.has(sp.id)) {
      dfs(sp.id, []);
    }
  }

  // Deduplicate cycles
  const seen = new Set<string>();
  return cycles.filter((cycle) => {
    const key = cycle.slice(0, -1).sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Rough estimation of total effort in days from effort strings.
 */
export function estimateTotalDays(subProjects: SubProject[]): number {
  let total = 0;
  for (const sp of subProjects) {
    if (!sp.estimatedEffort) continue;
    const text = sp.estimatedEffort.toLowerCase();

    // Try to extract a numeric range, e.g. "2-4 hours", "1-2 days", "3-5 days"
    const match = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(hour|day|hr|d)/);
    if (match) {
      const low = parseFloat(match[1]);
      const high = parseFloat(match[2]);
      const avg = (low + high) / 2;
      const unit = match[3];
      if (unit.startsWith('hour') || unit.startsWith('hr')) {
        total += avg / 8; // 8 hours = 1 day
      } else {
        total += avg;
      }
      continue;
    }

    // Single number, e.g. "3 days", "5 hours"
    const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*(hour|day|hr|d)/);
    if (singleMatch) {
      const val = parseFloat(singleMatch[1]);
      const unit = singleMatch[2];
      if (unit.startsWith('hour') || unit.startsWith('hr')) {
        total += val / 8;
      } else {
        total += val;
      }
    }
  }
  return total;
}

/**
 * Validate acceptance criteria against the sub-project file whitelist.
 * Criteria targeting files outside the whitelist are filtered out with warnings.
 */
export function validateCriteriaAgainstWhitelist(
  criteria: AcceptanceCriterion[],
  subProjectType: string,
): { valid: boolean; filtered: AcceptanceCriterion[]; warnings: string[] } {
  const whitelist = SUBPROJECT_FILE_WHITELIST[subProjectType];
  if (!whitelist) {
    // Unknown type — allow all (defensive)
    return { valid: true, filtered: criteria, warnings: [] };
  }

  const filtered: AcceptanceCriterion[] = [];
  const warnings: string[] = [];

  for (const c of criteria) {
    // Criteria without a target (e.g. some play-game checks) skip whitelist check
    if (!c.target) {
      filtered.push(c);
      continue;
    }

    const allowed = matchWhitelist(c.target, whitelist);
    if (!allowed) {
      warnings.push(
        `[WHITELIST] 验收标准 "${c.description}" 要求检查 ${c.target}，但 ${subProjectType} 子项目的白名单不包含此文件。该标准将被跳过。`,
      );
    } else {
      filtered.push(c);
    }
  }

  return { valid: warnings.length === 0, filtered, warnings };
}
