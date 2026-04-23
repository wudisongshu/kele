## Acceptance Criteria Rules (UPDATED — CRITICAL)
Each sub-project MUST include 3-7 acceptance criteria that kele can EXECUTE automatically.
**STRICT WHITELIST RULE: Each acceptance criterion MUST ONLY check files that belong to its sub-project type's whitelist. Criteria that target files outside the whitelist will be AUTOMATICALLY DISCARDED and will NEVER pass.**

- **setup whitelist**: package.json, vite.config.ts, .gitignore, index.html, public/manifest.json, public/sw.js, manifest.json, sw.js, SETUP.md
  - Allowed checks: verify-file ("index.html exists"), check-text ("index.html contains <canvas"), check-element ("viewport meta tag")
  - FORBIDDEN for setup: js/*.js, css/*.css, .github/workflows/*, ads.txt, adsense.html, MONETIZE.md — these belong to other sub-project types
- **development whitelist**: js/*.js, css/*.css, src/*.js, src/*.ts, assets/*
  - Allowed checks: verify-file ("js/game.js exists"), check-text ("css/style.css contains @media")
  - FORBIDDEN for development: .github/workflows/*, ads.txt, adsense.html, SETUP.md
- **deployment whitelist**: .github/workflows/*.yml, .github/workflows/*.yaml, CNAME, SETUP.md, MONETIZATION.md, MONETIZE.md
  - Allowed checks: verify-file (".github/workflows/deploy.yml exists"), check-text ("deploy.yml contains actions/deploy-pages")
- **monetization whitelist**: ads.txt, adsense.html, js/ads.js, MONETIZATION.md, MONETIZE.md, index.patch.html
  - Allowed checks: verify-file ("ads.txt exists"), check-text ("adsense.html contains adsbygoogle script")

Concrete examples:
- For **setup**: verify-file ("package.json exists"), check-text ("index.html has canvas element"), verify-file ("SETUP.md exists")
- For **development**: play-game checks ("canvas renders 8x8 grid", "clicking a gem selects it", "swapping adjacent gems triggers match detection", "3+ matches eliminate and score updates", "gravity refills the board"), verify-file ("js/game.js exists"), verify-file ("css/style.css exists")
- For **deployment** (web/H5):
  - verify-file: ".github/workflows/deploy.yml exists" (critical)
  - check-text: ".github/workflows/deploy.yml contains actions/deploy-pages" (critical)
  - check-text: ".github/workflows/deploy.yml contains actions/checkout" (critical)
  - check-text: ".github/workflows/deploy.yml contains upload-pages-artifact" (critical)
  - check-text: ".github/workflows/deploy.yml contains configure-pages" (critical)
  - verify-file: "ads.txt exists" (critical)
  - verify-file: "adsense.html exists" (critical)
  - verify-file: "CNAME exists" (non-critical)
  - verify-file: "manifest.json exists" (non-critical)
  - check-text: "manifest.json contains name and start_url" (non-critical)
  - verify-file: "sw.js exists" (non-critical)
  - verify-file: "SETUP.md exists" (critical)
- For **monetization** (web/H5):
  - verify-file: "adsense.html exists and contains adsbygoogle script" (critical)
  - check-text: "adsense.html contains pagead2.googlesyndication.com" (critical)
  - verify-file: "ads.txt exists" (critical)
  - verify-file: "MONETIZE.md exists" (critical)
- action must be one of: "open", "click", "check-text", "check-element", "play-game", "load-url", "verify-file"
- target should be specific enough for automation (CSS selector, file path, or URL)
- critical=true for criteria that block acceptance; critical=false for nice-to-have
