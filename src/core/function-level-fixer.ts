/**
 * FunctionLevelFixer — precise per-function repair for AI-generated stubs.
 *
 * Scans a file for empty functions / TODOs / stubs, extracts context,
 * asks AI to fill in just that one function, and patches it back in place.
 */

import { readFile, writeFile } from 'fs/promises';
import type { AIAdapter } from '../adapters/base.js';
import { debugLog } from '../debug.js';

export interface StubFunction {
  name: string;
  startLine: number;
  endLine: number;
  originalBody: string;
  contextBefore: string;
  contextAfter: string;
}

export class FunctionLevelFixer {
  private provider: AIAdapter;

  constructor(provider: AIAdapter) {
    this.provider = provider;
  }

  /**
   * Scan a file for empty functions / TODOs / stubs.
   */
  async findStubFunctions(filePath: string): Promise<StubFunction[]> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const stubs: StubFunction[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match: function foo(...)  or  async function foo(...)  or  const foo = function(...)
      const funcMatch = line.match(/(?:async\s+)?function\s+(\w+)/);
      const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>/);
      const methodMatch = line.match(/(\w+)\s*\([^)]*\)\s*\{/);

      let funcName: string | undefined;
      let startLine = i;

      if (funcMatch) {
        funcName = funcMatch[1];
      } else if (arrowMatch && !line.includes('{')) {
        // Arrow function without block on same line — skip (single-expression, not a stub)
        continue;
      } else if (arrowMatch) {
        funcName = arrowMatch[1];
      } else if (methodMatch && i > 0 && !line.includes('function') && !line.includes('=>')) {
        // Object method shorthand:  foo() {
        funcName = methodMatch[1];
      }

      if (!funcName) continue;

      // Find opening brace
      let braceLine = i;
      let braceIndex = lines[braceLine].indexOf('{');
      while (braceIndex === -1 && braceLine < lines.length - 1) {
        braceLine++;
        braceIndex = lines[braceLine].indexOf('{');
      }
      if (braceIndex === -1) continue;

      // Find matching closing brace
      let openBraces = 0;
      let endLine = braceLine;
      for (let j = braceLine; j < lines.length; j++) {
        for (let c = 0; c < lines[j].length; c++) {
          if (lines[j][c] === '{') openBraces++;
          if (lines[j][c] === '}') openBraces--;
        }
        if (openBraces === 0 && j >= braceLine) {
          endLine = j;
          break;
        }
      }

      // Extract body (from braceLine to endLine, i.e. { ... })
      const bodyLines = lines.slice(braceLine, endLine + 1);
      const body = bodyLines.join('\n');

      // Isolate just the braces part for stub detection
      const firstBraceIdx = body.indexOf('{');
      const lastBraceIdx = body.lastIndexOf('}');
      const bodyOnly = firstBraceIdx >= 0 && lastBraceIdx >= 0
        ? body.slice(firstBraceIdx, lastBraceIdx + 1)
        : body;

      // Determine if empty / stub
      const stripped = bodyOnly
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s/g, '');

      const isStub =
        stripped === '{}' ||
        stripped === '{//wip}' ||
        stripped.length < 5 ||
        /\bTODO\b|\bFIXME\b|\bstub\b|\bplaceholder\b/i.test(bodyOnly);

      if (isStub) {
        stubs.push({
          name: funcName,
          startLine: braceLine,   // line where { starts
          endLine,
          originalBody: bodyOnly,
          contextBefore: lines.slice(Math.max(0, startLine - 5), startLine).join('\n'),
          contextAfter: lines.slice(endLine + 1, Math.min(lines.length, endLine + 4)).join('\n'),
        });
      }
    }

    return stubs;
  }

  /**
   * Fix a single stub function.
   */
  async fixStub(stub: StubFunction, filePath: string, gameDescription: string): Promise<boolean> {
    const prompt = `你是一个前端游戏开发专家。请补全以下函数的完整实现。

游戏描述：${gameDescription}
函数名：${stub.name}
上下文代码（函数前5行）：
${stub.contextBefore}

当前空函数体：
${stub.originalBody}

上下文代码（函数后3行）：
${stub.contextAfter}

要求：
1. 只返回函数体的完整实现（从 { 开始到 } 结束），不要返回函数签名
2. 代码必须完整可运行，不允许有 TODO 或空逻辑
3. 与上下文代码风格保持一致
4. 直接返回代码字符串，不要包裹在 markdown 中

DEATH LINE: 如果返回空函数体或 TODO，任务将被拒绝。`;

    debugLog('FunctionLevelFixer prompt', prompt.slice(0, 500));
    const response = await this.provider.execute(prompt);
    const newBody = this.extractCode(response);
    debugLog('FunctionLevelFixer response length', String(newBody.length));

    if (!newBody.includes('{') || newBody.length < stub.originalBody.length + 10) {
      debugLog('FunctionLevelFixer skipped', `函数 ${stub.name} 修复结果疑似不完整`);
      return false;
    }

    // Replace in original file while preserving the function signature
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const before = lines.slice(0, stub.startLine).join('\n');
    const after = lines.slice(stub.endLine + 1).join('\n');

    // If the opening brace is on the same line as part of the signature,
    // preserve everything before the brace on that line.
    const braceLineText = lines[stub.startLine];
    const braceIdx = braceLineText.indexOf('{');
    const signaturePrefix = braceIdx >= 0 ? braceLineText.slice(0, braceIdx) : '';

    const newContent = before + '\n' + signaturePrefix + newBody + '\n' + after;

    await writeFile(filePath, newContent, 'utf-8');
    debugLog('FunctionLevelFixer fixed', `函数 ${stub.name} 已修复（${stub.originalBody.length} → ${newBody.length} 字符）`);
    return true;
  }

  /**
   * Run the full fix pipeline.
   */
  async fixFile(filePath: string, gameDescription: string, maxRounds: number = 3): Promise<boolean> {
    const fixedNames = new Set<string>();

    for (let round = 1; round <= maxRounds; round++) {
      let fixedInRound = false;

      while (true) {
        const stubs = await this.findStubFunctions(filePath);
        const todo = stubs.filter((s) => !fixedNames.has(s.name));
        if (todo.length === 0) break;

        debugLog('FunctionLevelFixer round', `第 ${round}/${maxRounds} 轮修复：${todo[0].name}`);
        const success = await this.fixStub(todo[0], filePath, gameDescription);
        if (success) {
          fixedNames.add(todo[0].name);
          fixedInRound = true;
        } else {
          break;
        }
      }

      if (!fixedInRound) {
        debugLog('FunctionLevelFixer stopped', '本轮未修复任何函数，停止修复');
        break;
      }
    }

    const remaining = await this.findStubFunctions(filePath);
    if (remaining.length > 0) {
      debugLog('FunctionLevelFixer failed', `修复后仍有 ${remaining.length} 个空函数：${remaining.map((s) => s.name).join(', ')}`);
      return false;
    }

    return true;
  }

  private extractCode(raw: string): string {
    const match = raw.match(/```(?:javascript|js|html)?\n?([\s\S]*?)```/);
    if (match) return match[1].trim();
    return raw.trim();
  }
}
