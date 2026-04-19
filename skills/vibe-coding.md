# Skill: Vibe Coding Workflow

## Core Philosophy

> "Fully give in to the vibes, embrace exponentials, and forget that the code even exists."
> — Andrej Karpathy, Feb 2025

**Evolved**: We don't blindly accept. We **direct** with intent and **verify** with tests.

## The "Burning Method" (焚诀) Prompt Template

```markdown
## Task
[一句话描述你要什么]

## Context
[相关代码位置、当前状态、已尝试的方案]

## Requirements
- 必须...
- 禁止...
- 如果...则...

## Output
[期望的输出格式：代码、文档、测试、或全部]
```

**Principle: 先对齐，再动手。**  
AI is a new colleague that needs onboarding, not a search engine.

## Workflow Steps

1. **Describe Intent** → 用自然语言描述需求，不关心实现细节
2. **AI Proposes Plan** → AI 提出方案和文件变更计划（Plan Mode）
3. **Human Confirms** → 用户确认或调整
4. **AI Implements** → AI 编写代码、测试、文档
5. **AI Verifies** → 运行测试、lint、类型检查
6. **Human Reviews** → 用户快速浏览关键路径
7. **Commit** → 提交，标注 AI 生成

## 70/30 Rule

- **70% AI**: 样板代码、测试、文档、重构
- **30% Human**: 架构设计、复杂逻辑、安全审查、代码审查

> If you're at 95% AI, you're shipping bugs.  
> If you're at 20% AI, you're leaving productivity on the table.

## Context Management

- Break complex builds into steps, not one giant prompt
- Use subagents for exploration to keep main context clean
- At **60% context usage** → archive + clear
- Commit after every successful feature

## Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| "Build me an app" | Too vague, AI guesses wrong | Break into concrete steps |
| Blind acceptance | Technical debt, security holes | Tests + review critical paths |
| One-shot perfection | AI needs iteration | Start small, iterate |
| Ignoring errors | "YOLO" doesn't scale | Fix root cause, not symptom |
| No tests | Regression city | Test-first always |

## Golden Rules

1. Write tests BEFORE you vibe
2. Be specific about frameworks, patterns, error handling
3. Commit after every successful feature
4. Review auth, payment, data validation manually
5. Never share credentials in prompts
6. Use structured prompts, not chatty conversations
