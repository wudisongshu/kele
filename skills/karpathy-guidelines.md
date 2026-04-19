# Skill: Karpathy Guidelines

> Derived from Andrej Karpathy's observations on LLM coding pitfalls.
> Source: https://github.com/forrestchang/andrej-karpathy-skills
> Stars: 3,500+ | License: MIT

## The Problem

Karpathy identified three core failure modes of AI coding agents:

> "The models make wrong assumptions on your behalf and just run along with them without checking. They don't manage their confusion, don't seek clarifications, don't surface inconsistencies, don't present tradeoffs, don't push back when they should."

> "They really like to overcomplicate code and APIs, bloat abstractions, don't clean up dead code... implement a bloated construction over 1000 lines when 100 would do."

> "They still sometimes change/remove comments and code they don't sufficiently understand as side effects, even if orthogonal to the task."

## The Four Principles

| Principle | Addresses | kele Application |
|-----------|-----------|------------------|
| **Think Before Coding** | Wrong assumptions, hidden confusion | Load `skills/planning.md` before any non-trivial task |
| **Simplicity First** | Overcomplication, bloated abstractions | If 200 lines could be 50, rewrite it |
| **Surgical Changes** | Orthogonal edits, touching unrelated code | Every changed line traces to user's request |
| **Goal-Driven Execution** | Unverified output, missing success criteria | Tests-first, verifiable acceptance criteria |

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

### Before Implementing

- [ ] **State assumptions explicitly** — If uncertain, ask rather than guess
- [ ] **Present multiple interpretations** — Don't pick silently when ambiguity exists
- [ ] **Push back when warranted** — If a simpler approach exists, say so
- [ ] **Stop when confused** — Name what's unclear and ask for clarification

### Understanding Boundary Rule (kele-specific)

- **DEFAULT MODE**: Execute precisely what was asked. No generalization. No "I think you also want X."
- **IDEATION MODE**: Only when user explicitly asks for ideas, brainstorming, or "what do you think?"
- **If unclear which mode**: Ask. Do not guess.

---

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

### Constraints

- No features beyond what was asked
- No abstractions for single-use code
- No "flexibility" or "configurability" that wasn't requested
- No error handling for impossible scenarios
- If 200 lines could be 50, rewrite it

### The Senior Engineer Test

> Would a senior engineer say this is overcomplicated? If yes, simplify.

---

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

### When Editing Existing Code

- Don't "improve" adjacent code, comments, or formatting
- Don't refactor things that aren't broken
- Match existing style, even if you'd do it differently
- If you notice unrelated dead code, mention it — don't delete it

### Orphan Cleanup

- Remove imports / variables / functions that YOUR changes made unused
- Don't remove pre-existing dead code unless asked

### The Traceability Test

> Every changed line should trace directly to the user's request.

---

## 4. Goal-Driven Execution

**Don't tell the AI what to do. Give it success criteria and watch it go.**

> — Andrej Karpathy

### Implementation

- Transform imperative instructions into declarative goals
- Define verifiable success criteria before coding
- Use tests as the verification loop
- AI loops until criteria are met, not until "it looks done"

### Success Criteria Template

```markdown
## Success Criteria
- [ ] Feature X behaves as described in Task
- [ ] Tests pass: `npm test -- --grep "feature-x"`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] Code review checklist from skills/code-quality.md passes
```

---

## How to Know It's Working

These guidelines are working if you observe:

- **Fewer unnecessary changes in diffs** — Only requested changes appear
- **Fewer rewrites due to overcomplication** — Code is simple the first time
- **Clarifying questions come before implementation** — Not after mistakes
- **Clean, minimal commits** — No drive-by refactoring or "improvements"

## Tradeoff Note

These guidelines bias toward **caution over speed**. For trivial tasks (simple typo fixes, obvious one-liners), use judgment — not every change needs the full rigor.

The goal is reducing costly mistakes on non-trivial work, not slowing down simple tasks.
