# Skill: Agentic Engineering

> Karpathy 2026 evolution: From "vibe coding" (passive) to "agentic engineering" (supervisory).

## Paradigm Shift

| Era | Year | Human Role | AI Role |
|-----|------|-----------|---------|
| Manual Coding | — | Author | Autocomplete |
| Vibe Coding | 2025 | Vibe curator | Primary builder |
| Agentic Engineering | 2026 | Architect / Supervisor | Autonomous agent team |

## Principles

1. **Orchestration over Implementation**: Humans design systems, agents build them
2. **Multi-Agent Teams**: Different agents for research, coding, testing, review
3. **Persistent State**: Memory banks, context files, decision logs
4. **Rigorous Verification**: Tests, lint, typecheck, security scan — automated
5. **Human in the Loop**: Architecture decisions and critical path review

## Agent Roles

| Agent | Responsibility | Trigger |
|-------|---------------|---------|
| Architect | System design, API contracts, data model | New module / major change |
| Builder | Code implementation | Plan approved |
| Tester | Test writing, coverage, edge cases | Code complete |
| Reviewer | Code review, security audit | Before merge |
| Documenter | Docs, comments, changelogs | Feature shipped |

## Handoff Protocols

- **Architect → Builder**: JSON / Markdown spec with interfaces
- **Builder → Tester**: Working code + unit tests
- **Tester → Reviewer**: Test report + coverage metrics
- **Reviewer → Documenter**: Approved code + changelog notes

## Memory Strategy

| File | Purpose | Update Frequency |
|------|---------|-----------------|
| `AGENTS.md` | Static constitution | Rarely |
| `MEMORY.md` | Append-only decision log | Every session |
| `CONTEXT.md` | Per-session state | Every session start |
| `skills/` | Reusable workflows | When patterns emerge |

## Quality Gates

Before any code reaches `main`:

1. All tests pass
2. Lint / format clean
3. Type check passes
4. Security scan (no secrets, no vulns)
5. Human approval for critical paths
