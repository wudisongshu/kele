# CONTEXT.md — Current Session Context

## Session Info

- **Date**: 2026-04-19
- **Branch**: main
- **Goal**: kele v0.2.0 — Config system + Interactive execution + Research engine

## Current Status

- [x] kele v0.1.0 core framework complete (S1-S8)
- [x] 28 tests passing
- [ ] C1: Config system (`kele config`, ~/.kele/config.json)
- [ ] C2: OpenAI-compatible adapter (supports Kimi/DeepSeek/Qwen via baseURL)
- [ ] A1: Interactive execution flow (phase-based with user confirmation)
- [ ] B1: Business research engine (analyze competitors, market, monetization)

## User Requirements (New)

1. **Flexible API Key**: User may provide Kimi/DeepSeek/Qwen keys. If none, use free tier.
2. **Business Research**: For vague ideas like "牛牛消消乐", kele must research what it is, why it monetizes, and what makes games popular before building.
3. **Interactive Confirmation**: Key decisions during incubation must pause for user confirmation.

## Priority (Self-Determined)

1. **C1+C2** (Config + OpenAI-compatible adapter) — Infrastructure for all AI calls
2. **A1** (Interactive execution) — Framework capability for smart pauses
3. **B1** (Research engine) — Differentiating business intelligence

## Next Steps

1. Implement config system and OpenAI-compatible adapter
2. Upgrade CLI to auto-detect and use configured providers
3. Add interactive checkpoints to execution flow
4. Add research phase before incubation
