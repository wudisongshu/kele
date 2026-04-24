/**
 * Prompt builder — constructs AI prompts for different use cases.
 */

/**
 * Build a game generation prompt.
 */
export function buildGamePrompt(userInput: string, isRetry: boolean = false): string {
  const base = `你是一个前端游戏开发专家。请根据以下需求，生成一个完整的、可玩的 HTML5 游戏。

需求：${userInput}

要求：
1. 所有代码（HTML + CSS + JavaScript）必须内嵌在一个 index.html 文件中
2. 使用 HTML5 Canvas 进行渲染
3. 游戏必须完整可玩：有开始界面、核心玩法、计分系统、游戏结束/重新开始
4. 支持键盘控制（方向键 + 空格），如果是移动端游戏还要支持触摸控制
5. 代码中不允许有任何 TODO 注释、空函数、占位符（stub）或 "wip" 标记
6. 每个函数必须有完整的实现逻辑，不能只有函数签名
7. 使用 requestAnimationFrame 实现游戏循环
8. 返回格式：直接返回完整的 HTML 代码字符串，不要包裹在 markdown 代码块中

DEATH LINE: 如果输出包含空函数或 TODO，任务将被拒绝并重写。`;

  if (isRetry) {
    return base + '\n\n⚠️ 上一轮生成的代码存在 JavaScript 语法错误。请务必仔细检查代码，确保没有未闭合的括号、引号或其他语法问题。';
  }
  return base;
}

/**
 * Build a tool generation prompt.
 */
export function buildToolPrompt(userInput: string): string {
  return `你是一个前端开发专家。请根据以下需求，生成一个完整的、可用的网页工具。

需求：${userInput}

要求：
1. 所有代码（HTML + CSS + JavaScript）必须内嵌在一个 index.html 文件中
2. 界面美观，交互流畅
3. 功能完整，没有 TODO 或空函数
4. 响应式设计，支持移动端
5. 返回格式：直接返回完整的 HTML 代码字符串，不要包裹在 markdown 代码块中

DEATH LINE: 如果输出包含空函数或 TODO，任务将被拒绝并重写。`;
}
