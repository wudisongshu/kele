# Skill: Self-Improvement & Rule Evolution

## Goal

Make kele's AI infrastructure better after every interaction.

## Trigger

Before calling `attempt_completion`, if:

- The task had multiple steps, **OR**
- User provided feedback / corrections, **OR**
- A skill / rule was unclear or wrong

## Process

1. **Reflect**: Review the session
   - What went well?
   - What was confusing?
   - Did I violate any `AGENTS.md` rules?
   - Did the user have to repeat instructions?

2. **Propose**: Suggest rule updates
   - Add missing conventions to `AGENTS.md`
   - Add new skill to `skills/`
   - Update existing skill with learned pattern
   - Fix broken examples

3. **Confirm**: Ask user (or auto-apply if trivial)
   - "I noticed X was unclear. Should I add Y to AGENTS.md?"

4. **Apply**: Use `StrReplaceFile` to update rules

## Rules for Updating Rules

| Target | For What | Size Target |
|--------|---------|-------------|
| `AGENTS.md` | Project-wide, stable conventions | < 200 lines |
| `KIMI.md` | Tool-specific behavior | < 100 lines |
| `skills/` | Domain-specific workflows | < 150 lines each |
| `MEMORY.md` | One-off decisions and discoveries | Unlimited (append-only) |

## Example Reflection

```
Session: Building auth module
Feedback: User had to remind me to use bcrypt instead of MD5

Action: Added to skills/security.md:
- "Passwords: bcrypt/Argon2, never MD5/SHA1"

Action: Added to AGENTS.md security section:
- "Use established crypto libraries, never roll your own"
```
