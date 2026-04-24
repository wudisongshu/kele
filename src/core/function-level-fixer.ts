/**
 * FunctionLevelFixer — precise per-function repair for AI-generated stubs.
 *
 * Scans a file for empty functions / TODOs / stubs, extracts context,
 * asks AI to fill in just that one function, and patches it back in place.
 *
 * Also detects "contaminated" functions where code fragments from other
 * functions have leaked into catch/finally blocks or wrong scopes.
 */

import { readFile, writeFile } from 'fs/promises';
import { Script } from 'vm';
import type { AIAdapter } from '../adapters/base.js';
import { debugLog } from '../debug.js';

export interface StubFunction {
  name: string;
  startLine: number;
  endLine: number;
  originalBody: string;
  contextBefore: string;
  contextAfter: string;
  isContaminated?: boolean; // true if body contains leaked code fragments
}

export class FunctionLevelFixer {
  private provider: AIAdapter;

  constructor(provider: AIAdapter) {
    this.provider = provider;
  }

  /**
   * Keywords that look like method calls but are actually control-flow statements.
   */
  private static readonly FALSE_POSITIVES = new Set([
    'if', 'while', 'for', 'switch', 'catch', 'with', 'else', 'do', 'try', 'finally', 'case',
  ]);

  /**
   * Scan a file for empty functions / TODOs / stubs.
   * Also detects "contaminated" blocks where unrelated code leaked in.
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

      // Detect contamination: large body with unrelated this-references
      // (e.g. catch block containing lockPiece/clearLines logic)
      const thisRefs = bodyOnly.match(/this\.\w+/g) || [];
      const uniqueThisRefs = new Set(thisRefs);
      const isContaminated =
        bodyOnly.length > 200 &&
        uniqueThisRefs.size >= 3 &&
        (bodyOnly.includes('this.piece') || bodyOnly.includes('this.board'));

      // Control-flow keywords (catch, finally, etc.) are NOT functions,
      // but if their block is CONTAMINATED we still need to clean it up.
      const isFalsePositive = funcName && FunctionLevelFixer.FALSE_POSITIVES.has(funcName);
      if (isFalsePositive && !isContaminated) continue;

      if (isStub || isContaminated) {
        stubs.push({
          name: funcName,
          startLine: braceLine,   // line where { starts
          endLine,
          originalBody: bodyOnly,
          contextBefore: lines.slice(Math.max(0, startLine - 5), startLine).join('\n'),
          contextAfter: lines.slice(endLine + 1, Math.min(lines.length, endLine + 4)).join('\n'),
          isContaminated,
        });
      }
    }

    return stubs;
  }

  /**
   * Fix a single stub function.
   * For contaminated blocks, uses a "clean up" strategy instead of "fill in".
   */
  async fixStub(stub: StubFunction, filePath: string, gameDescription: string): Promise<boolean> {
    const prompt = stub.isContaminated
      ? this.buildCleanupPrompt(stub, gameDescription)
      : this.buildFillPrompt(stub, gameDescription);

    debugLog('FunctionLevelFixer prompt', prompt.slice(0, 500));
    const response = await this.provider.execute(prompt);
    const newBody = this.extractCode(response);
    debugLog('FunctionLevelFixer response length', String(newBody.length));

    if (!newBody.includes('{') || newBody.length < 5) {
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
    debugLog('FunctionLevelFixer fixed', `函数 ${stub.name} 已修复（${stub.originalBody.length} → ${newBody.length} 字符）${stub.isContaminated ? '[清理污染]' : ''}`);
    return true;
  }

  /**
   * Build a "fill in" prompt for normal empty stubs.
   */
  private buildFillPrompt(stub: StubFunction, gameDescription: string): string {
    return `你是一个前端游戏开发专家。请补全以下函数的完整实现。

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
  }

  /**
   * Build a "clean up" prompt for contaminated blocks.
   */
  private buildCleanupPrompt(stub: StubFunction, gameDescription: string): string {
    return `你是一个前端代码清理专家。以下代码块中被混入了不属于它的代码片段，请将其清理干净。

游戏描述：${gameDescription}
代码块名：${stub.name}
上下文代码（前面5行）：
${stub.contextBefore}

当前混乱的代码块：
${stub.originalBody}

上下文代码（后面3行）：
${stub.contextAfter}

要求：
1. 删除所有不属于该代码块职责的代码（例如：catch 块中不应该包含游戏核心逻辑如方块锁定、消行、得分计算等）
2. 只保留适当的错误处理代码（如 console.error、console.warn、或简单的空操作）
3. 返回清理后的完整代码块（从 { 开始到 } 结束）
4. 不要返回函数签名，只返回 { ... } 部分
5. 直接返回代码字符串，不要包裹在 markdown 中

DEATH LINE: 如果返回的代码块仍然包含不属于它的游戏逻辑，任务将被拒绝。`;
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

        debugLog('FunctionLevelFixer round', `第 ${round}/${maxRounds} 轮修复：${todo[0].name}${todo[0].isContaminated ? ' [污染]' : ''}`);
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

  /**
   * Pre-check JavaScript syntax inside <script> tags using Node.js vm.Script.
   * Returns syntax validity, error message, and approximate line number.
   */
  async preCheckSyntax(filePath: string): Promise<{ valid: boolean; error?: string; line?: number }> {
    const content = await readFile(filePath, 'utf-8');

    // Collect all inline <script> contents
    const scriptMatches = content.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
    let allScripts = '';
    for (const match of scriptMatches) {
      allScripts += match[1] + '\n';
    }

    if (allScripts.trim().length === 0) {
      return { valid: false, error: 'No inline script tag found' };
    }

    try {
      new Script(allScripts);
      return { valid: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // vm.Script error format: "<anonymous>:LINE:COL ..."
      const lineMatch = msg.match(/<anonymous>:(\d+):(\d+)/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
      return { valid: false, error: msg, line };
    }
  }

  /**
   * Fix syntax errors by asking AI to rewrite the entire file.
   * Local fixes are hard for syntax errors; full rewrite is more reliable.
   */
  async fixSyntaxError(
    filePath: string,
    error: string,
    line: number | undefined,
    userInput: string,
  ): Promise<boolean> {
    const content = await readFile(filePath, 'utf-8');

    const prompt = `你是一个前端开发专家。以下 HTML 文件有 JavaScript 语法错误，请修复它。

需求：${userInput}
错误信息：${error}${line ? `\n错误位置：第 ${line} 行附近` : ''}

当前文件内容：
${content}

要求：
1. 只修复语法错误，不要改变游戏逻辑
2. 返回完整的修复后的 HTML 代码
3. 确保代码中没有任何语法错误
4. 直接返回 HTML 字符串，不要包裹在 markdown 中

DEATH LINE: 如果返回的代码仍然包含语法错误，任务将被拒绝。`;

    debugLog('FunctionLevelFixer syntax fix prompt', prompt.slice(0, 500));
    const response = await this.provider.execute(prompt);
    const fixedCode = this.extractCode(response);
    debugLog('FunctionLevelFixer syntax fix response length', String(fixedCode.length));

    if (!fixedCode.includes('<html') && fixedCode.length < content.length * 0.5) {
      debugLog('FunctionLevelFixer syntax fix skipped', '修复结果疑似不完整');
      return false;
    }

    await writeFile(filePath, fixedCode, 'utf-8');

    // Re-verify syntax
    const recheck = await this.preCheckSyntax(filePath);
    if (!recheck.valid) {
      debugLog('FunctionLevelFixer syntax fix failed', `修复后仍有语法错误: ${recheck.error}`);
      return false;
    }

    debugLog('FunctionLevelFixer syntax fix success', '语法错误已修复');
    return true;
  }

  extractCode(raw: string): string {
    const match = raw.match(/```(?:javascript|js|html)?\n?([\s\S]*?)```/);
    if (match) return match[1].trim();
    return raw.trim();
  }
}
