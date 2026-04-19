# CONTEXT.md — Current Session Context

> **Rewrite this file at the start of each session.**
> It tells the AI where we left off and what we're doing today.

## Session Info

- **Date**: 2026-04-19
- **Branch**: main
- **Goal**: Build kele CLI — Idea-to-Monetization workflow engine

## Current Status

- [x] Vibe-coding infrastructure complete (AGENTS.md, KIMI.md, skills/, docs/)
- [x] User confirmed: CLI tool, generic framework first, game→wechat as test case
- [x] User confirmed: kele repo stays clean, user projects generated externally
- [ ] Architecture plan pending user approval
- [ ] Slice 1: Project skeleton + CLI + types
- [ ] Slice 2: IdeaEngine
- [ ] Slice 3: Incubator
- [ ] Slice 4: TaskPlanner
- [ ] Slice 5: AIRouter (DeepSeek/Qwen/Claude/OpenAI)
- [ ] Slice 6: Executor
- [ ] Slice 7: SQLite state persistence
- [ ] Slice 8: Game plugin (test case)

## In-Progress Work

Presenting architecture plan to user for approval.

## Blockers

None.

## Recent Decisions

- Tech stack: TypeScript + Node.js + Commander.js + SQLite + Axios + Zod + Vitest
- User projects generated OUTSIDE kele repo (external directory)
- kele repo only contains CLI tool code + templates
- Free AI: DeepSeek, Qwen (API key required, free tier available)
- Paid AI: Claude, OpenAI

## Next Steps

1. User approves architecture plan
2. Execute Slice 1: project skeleton
3. Continue through slices sequentially
