# Prompt Engineering Guide for kele

## Principles

1. **AI is a new colleague**: Onboard it with context, don't just throw tasks
2. **Specificity beats cleverness**: Clear constraints > creative prompts
3. **Structure reduces ambiguity**: Templates > freeform

## The Burning Method (焚诀)

**Core: 先对齐，再动手** (Align first, act second)

### Template

```markdown
## Task
[One sentence: what to build]

## Context
[Current state, relevant files, what you've tried]

## Requirements
- Must: [hard requirements]
- Must not: [prohibitions]
- If [condition]: [behavior]

## Output
[Expected deliverable: code / test / doc / all]
```

### Examples

#### ❌ Bad
```
"Make a login page"
```

#### ✅ Good
```markdown
## Task
Create a Next.js 14 login page with email/password using server actions

## Context
App Router project at /apps/web, using shadcn/ui, no auth yet

## Requirements
- Must validate inputs with Zod schema
- Must hash passwords with bcrypt
- Must return typed errors to client
- Must redirect to /dashboard on success
- Must not expose stack traces to user

## Output
Page component + server action + Zod schema + unit tests
```

## Context Window Optimization

- Keep `AGENTS.md` under 200 lines
- Use `@path` references for large docs instead of pasting
- Offload exploration to subagents
- Clear context at 60% usage

## Prompt Patterns

### Chain of Thought
```
"Think step by step before answering."
```

### Few-Shot
```
"Here are 3 examples of the output format I want: ..."
```

### Role Assignment
```
"You are a senior security engineer reviewing this auth module."
```

### Constraint Listing
```
"Your answer must: 1) be under 100 lines, 2) use TypeScript, 3) include error handling."
```

## Anti-Patterns

| Anti-Pattern | Why It Fails |
|-------------|--------------|
| "Be creative" | AI invents requirements |
| No constraints | Scope creep, wrong assumptions |
| Giant paste | Wastes context, buries signal |
| Vague negation ("don't be slow") | AI can't measure "slow" |
| Multiple tasks in one | AI misses details |

## Multi-Turn Strategy

1. **Turn 1**: High-level intent + context
2. **Turn 2**: AI proposes plan, you refine
3. **Turn 3**: AI implements first slice
4. **Turn 4**: You review, AI iterates
5. **Turn 5**: Final verification

Never try to get perfection in one shot.

## Self-Correction Prompts

When AI goes wrong:

- "That's not what I meant. Let me rephrase: ..."
- "Focus on X, ignore Y for now"
- "Rollback the last change and try Z instead"
- "Check AGENTS.md section 3 before proceeding"

## Meta-Prompt: Rule Improvement

After any session:

```
Reflect on this task. What was unclear in our rules?
Propose specific updates to AGENTS.md or skills/.
```

This makes your AI infrastructure compound in value.
