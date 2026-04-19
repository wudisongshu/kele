# Skill: Planning & Task Breakdown

> The industry-best planning methodology for AI coding agents.
> Synthesized from: Addy Osmani's planning skill, Manus-style file planning, Anthropic Claude Code best practices, and 30+ real-world projects.

## Core Principle

**Plan before code. Always.**

No matter how small the task, entering Plan Mode first eliminates 80% of AI coding mistakes. Planning builds the agent's context window before any file is touched.

> "Plan mode is a forcing function for concrete requirements. You wouldn't chuck vague requirements at a human colleague and expect good results."
> — AI Hero Dev

---

## Task Sizing

| Size | Files | Scope | Example | Agent Performance |
|------|-------|-------|---------|-------------------|
| XS | 1 | Single function or config | Add a validation rule | ⭐⭐⭐⭐⭐ |
| S | 1-2 | One component or endpoint | Add a new API endpoint | ⭐⭐⭐⭐⭐ |
| M | 3-5 | One feature slice | User registration flow | ⭐⭐⭐⭐ |
| L | 5-8 | Multi-component feature | Search with filtering + pagination | ⭐⭐⭐ |
| XL | 8+ | Too large — MUST break down | — | ⭐⭐ |

**Rule**: If a task is L or larger, break it into smaller tasks.  
**Rule**: An agent performs best on S and M tasks.

---

## The 5-Step Planning Process

### Step 1: Enter Plan Mode (Read-Only)

Before writing any code, operate in **read-only mode**:

- Read the spec and relevant codebase sections
- Identify existing patterns and conventions
- Map dependencies between components
- Note risks and unknowns

**Do NOT write code during planning.** The output is a plan document, not implementation.

### Step 2: Identify the Dependency Graph

Map what depends on what:

```
Database schema
    │
    ├── API models/types
    │       │
    │       ├── API endpoints
    │       │       │
    │       │       └── Frontend API client
    │       │               │
    │       │               └── UI components
    │       │
    │       └── Validation logic
    │
    └── Seed data / migrations
```

**Implementation order follows the dependency graph bottom-up**: build foundations first.

### Step 3: Slice Vertically

**Bad (horizontal slicing):**
```
Task 1: Build entire database schema
Task 2: Build all API endpoints
Task 3: Build all UI components
Task 4: Connect everything
```

**Good (vertical slicing):**
```
Task 1: User can create an account (schema + API + UI for registration)
Task 2: User can log in (auth schema + API + UI for login)
Task 3: User can create a task (task schema + API + UI for creation)
```

Each vertical slice delivers **working, testable functionality**.

### Step 4: Write Tasks

Each task MUST follow this structure:

```markdown
## Task [N]: [Short descriptive title]

**Description:** One paragraph explaining what this task accomplishes.

**Acceptance criteria:**
- [ ] [Specific, testable condition]
- [ ] [Specific, testable condition]

**Verification:**
- [ ] Tests pass: `npm test -- --grep "feature-name"`
- [ ] Build succeeds: `npm run build`
- [ ] Manual check: [description of what to verify]

**Dependencies:** [Task numbers this depends on, or "None"]

**Files likely touched:**
- `src/path/to/file.ts`
- `tests/path/to/test.ts`

**Estimated scope:** [XS | S | M | L]
```

### Step 5: Order and Checkpoint

Arrange tasks so that:

1. Dependencies are satisfied (build foundation first)
2. Each task leaves the system in a working state
3. Verification checkpoints occur after every 2-3 tasks
4. High-risk tasks are early (fail fast)

**Explicit checkpoints:**

```markdown
## Checkpoint: After Tasks 1-3
- [ ] All tests pass
- [ ] Application builds without errors
- [ ] Core user flow works end-to-end
- [ ] Review with human before proceeding
```

---

## Planning With Files (Persistent Planning)

For complex multi-session tasks, use the **Manus-style 3-file pattern**:

| File | Purpose | Location |
|------|---------|----------|
| `task_plan.md` | The master plan with all tasks and dependencies | `.plans/` or `docs/plans/` |
| `findings.md` | Research findings, patterns discovered, decisions made | `.plans/` or `docs/plans/` |
| `progress.md` | Current status, completed tasks, blockers | `.plans/` or `docs/plans/` |

**Philosophy**: Context window = RAM, file system = disk. Plans persist across sessions.

### Session Handoff Protocol

When a session ends with unfinished work:

```markdown
# Handoff: [Feature Name]

## Summary
[1-2 sentences describing what was planned/built]

## Key Technical Decisions
- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]

## Task Overview
1. [Task 1] - [Status: complete / in-progress / pending]
2. [Task 2] - [Status]

## Research Findings
- [Key finding with file:line reference]
- [Pattern to follow]

## Assumptions Made
- [Assumption 1]

## Blockers
- [None / describe]

## Next Steps
1. [Next action]
```

---

## Plan Quality Checklist

Before exiting Plan Mode, verify:

- [ ] Plan is concise (sacrifice grammar for brevity)
- [ ] Each task has specific acceptance criteria
- [ ] Tasks are vertically sliced
- [ ] Dependencies are mapped and ordered correctly
- [ ] Verification steps are defined for each task
- [ ] Unresolved questions are listed at the end
- [ ] Actionable summary is the LAST thing in the output (terminal-friendly)

---

## Clarifying Questions Template

At the end of every plan, ask:

```markdown
## Unresolved Questions

Before proceeding, I need clarity on:

1. [Edge case or ambiguity 1]
2. [Error handling scenario]
3. [Scope boundary question]

Please confirm or correct my assumptions.
```

> **Rule**: If you are not 100% certain about a requirement, STOP and ask. Do not guess.

---

## Two Collaboration Modes

| Mode | When | How |
|------|------|-----|
| **Pair Mode** | Ambiguous problems, design decisions, new domains | Interactive back-and-forth; AI as thought partner |
| **Delegation Mode** | Well-scoped tasks with clear acceptance criteria | Structured prompt → autonomous execution → human review |

**Default for kele**: Start in Pair Mode for planning, switch to Delegation Mode for execution.

---

## Context Management During Planning

- Use **subagents** for codebase exploration during planning
- Keep planning output in files, not just context window
- At 60% context usage during planning: save plan to file, `/clear`, resume from file
- Planning sessions can be long; don't rush — an hour of planning saves three hours of debugging

---

## Integration with kele Workflow

```
User: "Build X"
  ↓
AI: Load skills/planning.md + skills/karpathy-guidelines.md
  ↓
AI: Enter Plan Mode (read-only exploration)
  ↓
AI: Propose plan with tasks, acceptance criteria, checkpoints
  ↓
User: Approve / Refine plan
  ↓
AI: Execute Task 1 → Verify → Commit
  ↓
AI: Checkpoint → User review
  ↓
AI: Execute Task 2 → Verify → Commit
  ↓
... until complete
```
