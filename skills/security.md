# Skill: Security Baseline

## Red Lines (NEVER)

- **NEVER** paste credentials, tokens, or secrets into prompts
- **NEVER** commit `.env` files to Git
- **NEVER** log sensitive data (passwords, tokens, PII)
- **NEVER** use string concatenation for SQL
- **NEVER** disable verification (`--no-verify`) to bypass checks
- **NEVER** trust user input without validation
- **NEVER** roll your own crypto

## Required Practices

- Environment variables for all secrets
- Parameterized queries for all database access
- Input validation on **ALL** external inputs (Zod, Pydantic, Joi)
- Output encoding for anything rendered in UI
- CORS configured explicitly, never `*`
- Rate limiting on all public endpoints
- Dependencies scanned for vulnerabilities (`npm audit`, `safety`, `cargo audit`)

## Authentication & Authorization

- Use established libraries (Passport, Auth0, Clerk, etc.)
- Passwords: bcrypt / Argon2, **never MD5 / SHA1**
- JWT: Secure secrets, short expiry, refresh token rotation
- RBAC: Role-based access control, **deny by default**
- Audit logs for sensitive operations

## Data Protection

- Encrypt at rest (database encryption)
- Encrypt in transit (TLS 1.3)
- PII minimization: collect only what you need
- GDPR / CCPA compliance: right to deletion, data export

## Incident Response

If a secret is leaked:

1. Rotate immediately
2. Check logs for unauthorized access
3. Notify if user data affected
4. Document in `memory/MEMORY.md`
