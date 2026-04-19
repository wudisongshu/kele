# ADR 0001: Vibe-Coding Infrastructure

## Status

Accepted

## Context

kele is wudisongshu's first open-source project, built entirely via AI assistance. We need infrastructure that enables efficient, high-quality AI-driven development without manual coding.

## Decision

Adopt a comprehensive vibe-coding / agentic-engineering infrastructure with:

1. **AGENTS.md** as project constitution
2. **Tool-specific configs** (`.kimi/KIMI.md`, `.cursorrules`, `.clinerules/`)
3. **Memory system** (`MEMORY.md`, `CONTEXT.md`)
4. **Skills directory** for reusable workflows
5. **Auto-generated docs** pipeline

## Consequences

### Positive

- Zero manual code/docs required
- Consistent AI behavior across sessions
- Self-improving ruleset
- Multi-tool compatibility (Kimi, Cursor, Cline, Claude)

### Negative

- Initial setup overhead
- Requires discipline to maintain `MEMORY.md`
- Rules can become stale if not reviewed

## References

- Andrej Karpathy's Vibe Coding → Agentic Engineering evolution (2025-2026)
- Anthropic Claude Code best practices
- Cline `.clinerules` documentation
- "Prompt Burning Method" (焚诀)
