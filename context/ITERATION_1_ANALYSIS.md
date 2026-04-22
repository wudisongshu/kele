# Iteration 1 — Comprehensive Codebase Analysis

## Iteration Goal
Systematically fix all discovered issues across tests, templates, core code, and deployment.

## Issue Inventory (All P0 — no priority, all must be fixed)

### Category A: Missing Tests (17 items)
1. `project-assembler.test.ts` — assembleProject completely untested
2. Whitelist tests — `SUBPROJECT_FILE_WHITELIST`, `matchWhitelist()` untested
3. `SubProjectFileRegistry` tests — ownership/protection untested
4. `index.patch.html` end-to-end integration tests
5. `fixHtmlForLocal()` tests — HTML local-fix logic untested
6. Async timeout handling in `adapter-utils` untested
7. AbortSignal mid-execution in `executor` untested
8. File permission errors in `file-writer` untested
9. Disk full errors in `db`, `config`, `telemetry` untested
10. Network retry backoff untested
11. Registry routing with no available providers untested
12. Task validation failure recovery untested
13. Game validation failure paths in executor untested
14. 22 CLI command modules have zero tests
15. `adapters/deepseek.ts`, `adapters/openai-compatible.ts` untested
16. `debug.ts` untested
17. `cli/index.ts` untested

### Category B: Template Bugs (16 items)
18. Ad containers NOT integrated into game-web/pwa-game HTML → no ad revenue
19. `src/game.js` missing in steam-game, itchio-game, ios-app
20. web-scaffold/sw.js caches `/src/main.ts` (Vite builds to dist/)
21. ESM/CJS mismatch: discord-bot/premium.js, telegram-bot/premium.js
22. ESM/CJS mismatch: pwa-game/adsense-init.js, android-app/monetization.js, etc.
23. game-web template is dead code (duplicated by pwa-game)
24. itchio deploy hardcoded `success: false`
25. github-sponsors credential key mismatch (`githubUsername` vs `username`)
26. douyin-game missing SETUP.md
27. wechat-miniprogram missing SETUP.md
28. douyin-game missing project.config.json
29. wechat-miniprogram missing project.config.json
30. No bot deployment configs (discord-bot, telegram-bot)
31. No mobile wrapper configs (android-app, ios-app)
32. android-app uses deprecated cordova-plugin-admob-free
33. No CSP headers in any HTML template
34. project-assembler.ts unsanitized HTML injection
35. steam-game monetization.js can't run in renderer (nodeIntegration: false)
36. Bot deploy mapped to VPS (rsync) instead of Railway/Render
37. pwa-game adsense.html redundant (superseded by adsense-init.js)
38. Missing build-upload.sh for Steam
39. Missing .itch.toml for itch.io

### Category C: Test Quality Issues (10 items)
40. `cli.test.ts` has `expect(true).toBe(true)` no-op test
41. `pwa-validator.test.ts` tests only fs APIs, not project code
42. `project-reviewer.test.ts` adjustProjectScope has no meaningful assertions
43. `incubator.test.ts`, `contract-engine.test.ts`, `optimization-engine.test.ts` brittle to wording changes
44. `game-validator-browser.test.ts` and `run-validator.test.ts` slow and env-dependent
45. `executor.test.ts` produces console warnings during runs
46. `adapter-utils.test.ts` `makeRegistry` broken mock
47. `chat.test.ts` only covers 4 of 9 intent types
48. `file-writer.test.ts` never tests registry/whitelist params
49. `security.test.ts` missing path traversal edge cases
50. Multiple test files modify `process.env.HOME` without isolation

### Category D: Core Code Issues (discovered from scan)
51. Need further exploration for race conditions, memory leaks, unhandled rejections

## Iteration Plan
- Iterations 1-10: Fix template bugs (Category B) — highest user impact
- Iterations 11-30: Add missing tests (Category A) — prevent regressions
- Iterations 31-40: Fix test quality issues (Category C) — test reliability
- Iterations 41-60: Core code improvements from deep analysis
- Iterations 61-100: Continue discovery and refinement

## Execution Rule
Every iteration: modify → test (all 684+) → build → commit → push → verify remote HEAD.
