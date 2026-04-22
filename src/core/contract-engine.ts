/**
 * Gameplay Contract Engine — hard-codes core game mechanics as immutable contracts.
 *
 * When a user says "like Tetris", kele matches the idea to a pre-defined contract.
 * AI is then constrained to implement ONLY within the contract framework,
 * ensuring the generated game is actually playable and recognizable.
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findJsFiles, findHtmlFiles } from './file-utils.js';
import { debugLog } from '../debug.js';

export interface ContractMechanic {
  id: string;
  description: string;
  immutable: boolean;
  evidencePatterns?: string[];
}

export interface Contract {
  id: string;
  name: string;
  aliases: string[];
  coreMechanics: ContractMechanic[];
  optionalMechanics: ContractMechanic[];
  scoringSystem?: Record<string, number>;
  platformDefaults?: Record<string, { controls: string; screen: string }>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTRACTS_DIR = join(__dirname, 'gameplay-contracts', 'contracts');
const CUSTOM_CONTRACTS_DIR = join(__dirname, 'gameplay-contracts', 'contracts', 'custom');

/**
 * Load all built-in and custom contracts from disk.
 */
export function loadContracts(): Contract[] {
  const contracts: Contract[] = [];
  const dirs = [CONTRACTS_DIR, CUSTOM_CONTRACTS_DIR];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = readFileSync(join(dir, file), 'utf-8');
        const contract = JSON.parse(content) as Contract;
        contracts.push(contract);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog(`Contract engine malformed contract: ${file}`, msg);
        // Skip malformed contract files
      }
    }
  }

  return contracts;
}

let _cachedContracts: Contract[] | null = null;

function getContracts(): Contract[] {
  if (!_cachedContracts) {
    _cachedContracts = loadContracts();
  }
  return _cachedContracts;
}

/**
 * Invalidate the contract cache (useful after saving a new custom contract).
 */
export function invalidateContractCache(): void {
  _cachedContracts = null;
}

/**
 * Match a user's idea text to the best-fitting contract.
 * Returns null if no contract matches.
 */
export function matchContract(userIdea: string): Contract | null {
  const lower = userIdea.toLowerCase();
  const contracts = getContracts();
  let best: Contract | null = null;
  let bestScore = 0;

  for (const contract of contracts) {
    let score = 0;
    // Exact name match
    if (lower.includes(contract.name.toLowerCase())) {
      score += 10;
    }
    // Alias match
    for (const alias of contract.aliases) {
      const aliasLower = alias.toLowerCase();
      if (lower.includes(aliasLower)) {
        score += 5;
        // Longer alias matches are more specific
        score += aliasLower.length * 0.1;
      }
    }
    // Core mechanic keyword match (lightweight signal)
    for (const mechanic of contract.coreMechanics) {
      if (lower.includes(mechanic.id.toLowerCase())) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = contract;
    }
  }

  // Threshold: must have at least a weak alias match
  return bestScore >= 3 ? best : null;
}

/**
 * Validate whether a user mutation ("change/add" request) violates the contract.
 */
export function validateMutation(
  contract: Contract,
  mutation: string,
): { valid: boolean; warnings: string[]; preservedCore: string[] } {
  const lower = mutation.toLowerCase();
  const warnings: string[] = [];
  const preservedCore: string[] = [];
  let valid = true;

  for (const mechanic of contract.coreMechanics) {
    if (!mechanic.immutable) continue;

    // Detect destructive mutations
    const negativePatterns = [
      new RegExp(`不要|去掉|删除|移除|取消|禁用|no\\s+${mechanic.id}|remove\\s+${mechanic.id}|disable\\s+${mechanic.id}|without\\s+${mechanic.id}`, 'i'),
    ];
    const isAttacked = negativePatterns.some((p) => p.test(lower));

    if (isAttacked) {
      valid = false;
      warnings.push(
        `${contract.name}必须包含"${mechanic.description}"，否则不是${contract.name}。` +
        `你的要求"${mutation}"会破坏核心契约，已拒绝。`
      );
    } else {
      preservedCore.push(mechanic.description);
    }
  }

  // Detect optional mechanic additions
  for (const opt of contract.optionalMechanics) {
    if (lower.includes(opt.id.toLowerCase()) || lower.includes(opt.description.toLowerCase())) {
      warnings.push(`可选机制"${opt.description}"将在遵守核心契约的前提下实现。`);
    }
  }

  return { valid, warnings, preservedCore };
}

/**
 * Build a strict prompt snippet that forces AI to obey the contract.
 */
export function buildContractPrompt(contract: Contract, mutation: string): string {
  const coreList = contract.coreMechanics
    .filter((m) => m.immutable)
    .map((m, i) => `${i + 1}. ${m.description}`)
    .join('\n');

  const optionalList = contract.optionalMechanics
    .map((m) => `- ${m.description}`)
    .join('\n');

  const platformInfo = contract.platformDefaults
    ? `推荐平台设置：\n${Object.entries(contract.platformDefaults)
        .map(([k, v]) => `  ${k}: 控制方式=${v.controls}, 屏幕=${v.screen}`)
        .join('\n')}`
    : '';

  let prompt = `你正在实现一个【${contract.name}】游戏。以下机制是核心契约，必须实现，不可删除或修改：\n${coreList}\n`;

  if (optionalList) {
    prompt += `\n以下机制是可选增强（根据需求选择性实现）：\n${optionalList}\n`;
  }

  if (platformInfo) {
    prompt += `\n${platformInfo}\n`;
  }

  if (mutation && mutation.trim()) {
    prompt += `\n用户额外要求：【${mutation}】\n这个要求将在遵守上述核心契约的前提下实现。\n`;
  }

  prompt += `\n如果用户的要求与核心契约冲突，优先保证核心契约。`;
  prompt += `未实现任何核心契约机制的任务将被拒绝。`;

  return prompt;
}

/**
 * Validate that generated code implements all core mechanics of a contract.
 * Returns list of missing core mechanic IDs.
 */
export function validateContractCompliance(
  contract: Contract,
  gameDir: string,
): { compliant: boolean; missing: string[]; details: Record<string, boolean> } {
  const missing: string[] = [];
  const details: Record<string, boolean> = {};

  // Combine all source content (HTML + JS)
  let allContent = '';
  for (const htmlPath of findHtmlFiles(gameDir)) {
    try {
      allContent += readFileSync(htmlPath, 'utf-8') + '\n';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`Contract engine HTML read failed: ${htmlPath}`, msg);
    }
  }
  for (const jsPath of findJsFiles(gameDir)) {
    try {
      allContent += readFileSync(jsPath, 'utf-8') + '\n';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      debugLog(`Contract engine JS read failed: ${jsPath}`, msg);
    }
  }

  const contentLower = allContent.toLowerCase();

  for (const mechanic of contract.coreMechanics) {
    if (!mechanic.immutable) continue;

    let found = false;
    const patterns = mechanic.evidencePatterns || [];

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(allContent)) {
          found = true;
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        debugLog(`Contract engine invalid regex pattern: ${pattern}`, msg);
        // Fallback to simple includes if regex is invalid
        if (contentLower.includes(pattern.toLowerCase())) {
          found = true;
          break;
        }
      }
    }

    // Extra fallback: search for mechanic id itself
    if (!found && patterns.length > 0) {
      found = contentLower.includes(mechanic.id.toLowerCase());
    }

    details[mechanic.id] = found;
    if (!found) {
      missing.push(mechanic.id);
    }
  }

  return { compliant: missing.length === 0, missing, details };
}

/**
 * Save a custom contract to disk for future reuse.
 */
export function saveCustomContract(contract: Contract): void {
  if (!existsSync(CUSTOM_CONTRACTS_DIR)) {
    mkdirSync(CUSTOM_CONTRACTS_DIR, { recursive: true });
  }
  const filePath = join(CUSTOM_CONTRACTS_DIR, `${contract.id}.json`);
  writeFileSync(filePath, JSON.stringify(contract, null, 2), 'utf-8');
  invalidateContractCache();
}
