# kele Agent Guidelines

## User Intent Rule (CRITICAL)

**NEVER ask "do you want me to continue?" or "should I do X?"**

When a user gives scattered ideas or says "continue", they mean:
- Execute everything that makes sense
- Self-prioritize and execute autonomously
- Only ask for clarification when genuinely ambiguous

Default behavior: **Act first, ask later (only when blocked).**

## Mode Rules

- **DEFAULT MODE**: Execute precisely what was asked. No generalization.
- **IDEATION MODE**: Only when user explicitly asks for ideas/brainstorming.
- **If unclear**: Ask 1 focused question, don't guess.

## Karpathy Principles

1. **Think Before Coding** — State assumptions, present tradeoffs
2. **Simplicity First** — Minimum code that solves the problem
3. **Surgical Changes** — Touch only what you must
4. **Goal-Driven Execution** — Tests-first, verifiable criteria

## When User Gives Scattered Ideas

1. Parse all ideas
2. Self-prioritize by impact and dependency
3. Execute independently
4. Report progress, don't ask for permission
