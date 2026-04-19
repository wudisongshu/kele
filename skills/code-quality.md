# Skill: Code Quality Gatekeeper

## Pre-Commit Checklist

- [ ] Tests pass (`npm test` / `pytest` / `cargo test` / etc.)
- [ ] Lint clean (`npm run lint` / `ruff check` / `clippy` / etc.)
- [ ] Type check passes (`tsc --noEmit` / `mypy` / etc.)
- [ ] No `console.log` or debug statements left in production code
- [ ] No hardcoded secrets or API keys
- [ ] JSDoc / docstrings for all public APIs

## Testing Standards

- **Test-first**: Write failing test before implementation
- **Coverage**: Critical paths >= 80%
- **Mock external dependencies** (DB, API, file system)
- **Test names** clearly express behavior: `should reject invalid email format`
- **Group tests** by functional unit (`describe` blocks)

## Code Review Criteria

1. **Correctness**: Does it do what the spec says?
2. **Completeness**: Are edge cases handled?
3. **Security**: Any injection risks? Leaked data?
4. **Performance**: Any obvious N+1 or memory leaks?
5. **Maintainability**: Can someone understand this in 6 months?
6. **Test Coverage**: Are the important paths tested?

## Documentation Standards

- **README**: What, why, how to run
- **API docs**: Auto-generated from JSDoc / OpenAPI
- **ADR**: Why we chose X over Y (`docs/adr/`)
- **Changelog**: User-facing changes per release

## Self-Improvement Rule

After each task, reflect:

- What went well?
- What confused the AI?
- What should be added to `AGENTS.md` or `skills/`?

Then propose updates to the rules.
