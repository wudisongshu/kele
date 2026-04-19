# Vibe Coding Playbook for kele

> The definitive guide to building kele without writing code.

## What is Vibe Coding?

Vibe coding is a software development paradigm where you describe intent in natural language and AI handles implementation. You focus on **WHAT**, not **HOW**.

## The Evolution: Vibe Coding → Agentic Engineering

| Phase | Year | Characteristics |
|-------|------|----------------|
| Vibe Coding | 2025 | "Forget the code exists", YOLO iteration |
| Agentic Engineering | 2026 | Structured supervision, multi-agent teams, rigorous verification |

**kele uses Agentic Engineering**: We vibe, but we verify.

## Your Role as Human

You are the **Product Owner + Architect**. You:

1. Define features and priorities
2. Approve or reject AI proposals
3. Review critical paths (auth, security, data)
4. Test the final product

You do **NOT**:

- Write code
- Write documentation
- Configure build tools
- Fix merge conflicts (unless AI fails)

## The Workflow

### 1. Start a Session

Update `context/CONTEXT.md`, then:

```
Read CONTEXT.md, then let's build X.
```

### 2. Describe Intent

Use the **Burning Method** template:

```markdown
## Task
Implement user authentication with email/password and OAuth

## Context
We have a Next.js 14 app with Prisma and PostgreSQL. No auth yet.

## Requirements
- Must use NextAuth.js v5
- Must support both credentials and OAuth providers
- Must have protected route middleware
- Must NOT store passwords in plain text
- Error messages must be user-friendly (Chinese)

## Output
Working code + tests + documentation
```

### 3. AI Proposes Plan

AI will:

- Enter Plan Mode
- Propose file changes
- Ask for your approval

**Always review the plan.** This is your architecture checkpoint.

### 4. AI Builds

AI implements, tests, documents. You can:

- Ask for progress updates
- Request changes mid-flight
- Say "stop" if it's going wrong

### 5. Verify

Before accepting:

- Does it work? (AI should demo)
- Are tests passing?
- Did AI follow `AGENTS.md` rules?
- Any security red flags?

### 6. Ship

```bash
git add .
git commit -m "feat: add authentication"
git push
```

## Advanced Techniques

### Parallel Agents

For large features, split work:

- Agent A: Backend API
- Agent B: Frontend UI
- Agent C: Tests

They work simultaneously, then integrate.

### Memory-Driven Development

After each session, AI updates `MEMORY.md`. Next session, AI remembers:

- Why we chose X over Y
- That bug with the Stripe sandbox
- The auth middleware pattern we settled on

### Self-Improving Rules

Tell AI: "After you finish, reflect on what was unclear and propose updates to our skills."

Your rules get better every day.

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| "Just build it" vagueness | Use structured prompts with constraints |
| Accepting everything blindly | Require tests + review critical paths |
| Context explosion | Archive at 60%, use subagents |
| No documentation | AI generates docs as part of every task |
| Security blind spots | Load `skills/security.md` for auth tasks |

## Commands Reference

| You Say | AI Does |
|---------|---------|
| "Plan X" | Enters Plan Mode, proposes architecture |
| "Build X" | Implements with tests and docs |
| "Refactor X" | Restructures while preserving behavior |
| "Debug X" | Investigates + fixes + adds regression test |
| "Document X" | Generates README, API docs, ADR |
| "Review last session" | Reads MEMORY.md, suggests improvements |

## Remember

> "The best prompt technique is when you no longer need to think about prompt techniques."
> — Prompt Burning Method

Just describe what you want. kele handles the rest.
