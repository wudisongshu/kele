# MEMORY.md — kele Project Memory Bank

> Append-only log. **Do not rewrite history.** Date-stamp every entry.
> Format: `## YYYY-MM-DD - Topic`
> This file is read at the start of every session to restore context.

## 2026-04-19 - Project Initialization

- Project `kele` initialized with full vibe-coding / agentic-engineering infrastructure
- Author: wudisongshu, email: 1572699677@qq.com
- Philosophy: Agentic Engineering — human architects, AI builders
- Initial infra files created: AGENTS.md, KIMI.md, MEMORY.md, CONTEXT.md, skills/, docs/
- GitHub repo: https://github.com/wudisongshu/kele
- SSH key configured and pushed

## 2026-04-19 - Infrastructure Upgrade: Karpathy + Planning + Understanding Boundary

- Integrated Andrej Karpathy's 4 principles (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution) into `skills/karpathy-guidelines.md`
- Created `skills/planning.md` — industry-best planning skill synthesizing Addy Osmani, Manus-style file planning, Anthropic best practices
- Added **Understanding Boundary** section to `AGENTS.md` — critical constraint to prevent AI over-generalization
  - DEFAULT MODE: precise execution, no guessing, no adding unrequested features
  - IDEATION MODE: only when user explicitly asks for ideas/brainstorming
- Updated `.kimi/KIMI.md` to enforce planning requirement before non-trivial tasks
- User requirement: AI must have bounded understanding — don't generalize unless asked
