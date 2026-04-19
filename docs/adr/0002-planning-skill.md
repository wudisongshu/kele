# ADR 0002: Planning Skill & Karpathy Guidelines Integration

## Status

Accepted

## Context

User requested three critical infrastructure upgrades:
1. Integrate Andrej Karpathy's skills (industry-proven AI coding constraints)
2. Build industry-best AI planning skill
3. Define strict understanding boundaries to prevent AI over-generalization

## Decision

### 1. Karpathy Guidelines (`skills/karpathy-guidelines.md`)

Integrated the 3,500+ stars `andrej-karpathy-skills` repository with kele-specific adaptations:

- **Think Before Coding**: Added Understanding Boundary rules
- **Simplicity First**: Senior Engineer Test
- **Surgical Changes**: Traceability Test
- **Goal-Driven Execution**: Success Criteria Template

### 2. Planning Skill (`skills/planning.md`)

Synthesized from multiple industry-leading sources:

| Source | Contribution |
|--------|-------------|
| Addy Osmani `planning-and-task-breakdown` | Task sizing (XS/S/M/L/XL), 5-step process, vertical slicing |
| Manus-style file planning | 3-file pattern (task_plan.md / findings.md / progress.md) |
| Anthropic Claude Code best practices | Plan Mode, subagent exploration, checkpointing |
| AI Hero Dev | Plan as context-building, concision over grammar |
| CCteam-creator / llm-coding-workflow | Pair vs Delegation modes, handoff protocol |

Key features:
- Task sizing table with agent performance ratings
- Vertical vs horizontal slicing guidance
- Structured task template with acceptance criteria
- Persistent planning files for multi-session work
- Plan quality checklist
- Clarifying questions requirement

### 3. Understanding Boundary (`AGENTS.md`)

Defined kele's most critical interaction contract:

- **DEFAULT MODE**: Precise execution, no generalization, no unrequested features
- **IDEATION MODE**: Only triggered by explicit user keywords
- **Mode detection table** for clear behavior mapping
- **Strict anti-patterns** (no "while I'm at it", no "you probably also want")

## Consequences

### Positive

- AI will stop guessing and start asking
- Plans will be concrete, verifiable, and vertically sliced
- No more drive-by refactoring or speculative features
- Multi-session work survives context compression via file-based planning
- User gets exactly what they asked for, nothing more

### Negative

- More clarifying questions may feel slower for trivial tasks
- Planning overhead for small changes (mitigated by trivial-task exemption)
- Requires discipline to maintain `.plans/` files

## References

- https://github.com/forrestchang/andrej-karpathy-skills (MIT, 3,500+ stars)
- https://github.com/addyosmani/agent-skills (planning-and-task-breakdown)
- https://www.aihero.dev/plan-mode-introduction
- https://github.com/shanraisshan/claude-code-best-practice
- https://github.com/ericporres/llm-coding-workflow-skill
