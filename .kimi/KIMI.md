# KIMI.md — Kimi Code CLI Behavior Configuration

> Read @AGENTS.md for project architecture and conventions before every session.

## Behavior

- When compacting context, preserve the full list of modified files and test results
- Prefer subagents for research tasks (exploring unfamiliar code, reading docs, searching web)
- After completing a task, run the relevant test suite before reporting done
- Always use `WriteFile` / `StrReplaceFile` tools for code changes, never just describe in text
- Use **Chinese** for all user-facing communication unless user explicitly asks otherwise
- Use **English** for all code comments, variable names, and documentation strings
- Prefer `StrReplaceFile` over `WriteFile` for edits; `WriteFile` for new files only
- Prefer `Shell` with `&&` chaining for related commands

## Understanding Boundary (Highest Priority)

Read `AGENTS.md` "Understanding Boundary" section before every task.

**DEFAULT MODE**: Execute precisely. No generalization. No adding unrequested features.
**IDEATION MODE**: Only when user explicitly asks for ideas/brainstorming.
**Uncertain? Ask. Never guess.**

## Context Management

- Check `memory/MEMORY.md` at session start for recent decisions and blockers
- Context window usage at **60%** → propose archiving current work + clear context
- Use **Plan Mode** for any non-trivial task (>3 files or architectural changes)
- Keep KIMI.md / AGENTS.md references minimal to avoid duplication; use `@path` imports
- Offload exploration to subagents; never run subagents for trivial 1-2 tool-call tasks

## Memory

- When an architectural decision is made during a session, append it to `memory/MEMORY.md`
- When a bug pattern or fix is discovered, document it in `memory/MEMORY.md`
- Date-stamp all memory entries: `YYYY-MM-DD`

## Subagent Strategy

| Type | Use For | Max Parallel |
|------|---------|-------------|
| `explore` | Read-only codebase investigation, pattern search | 3 |
| `coder` | Focused implementation tasks, isolated modules | 2 |
| `plan` | Architecture design before code changes | 1 |

## Planning Requirement

**Before any non-trivial task (>3 files or architectural changes):**

1. Load `skills/planning.md`
2. Load `skills/karpathy-guidelines.md`
3. Enter Plan Mode
4. Produce structured plan with tasks, acceptance criteria, checkpoints
5. Get user approval before executing

**Trivial tasks** (typo fix, single-line change, obvious one-liner): Skip planning, execute directly.

## Tool Preferences

- `ReadFile`: Read multiple files in parallel when possible
- `Grep`: Always prefer over `Shell grep`
- `Glob`: Use specific patterns, avoid `**` root searches
- `WriteFile`: Overwrite for first write, append for subsequent chunks
- `StrReplaceFile`: Multi-line strings supported; verify old string exists
