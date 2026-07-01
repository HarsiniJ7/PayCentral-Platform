# Security, POPIA & OWASP Top 10

## Authentication & authorization

- Passwords are hashed with bcrypt (`bcryptjs`, cost factor 10) - never stored or logged in plain text.
- Access tokens are short-lived JWTs (15 min default, configurable via `JWT_EXPIRES_IN`) and carry only `id`, `email`, `role` - no sensitive data in the token payload.
- Refresh tokens are opaque random strings (not JWTs), stored server-side **hashed** with SHA-256 in the `RefreshTokens` table, valid 7 days, and **rotated on every use** - `POST /auth/refresh` revokes the presented token and issues a new pair, so a captured token can only be replayed once before the rotation makes the theft visible (the legitimate client's next refresh will fail). `POST /auth/logout` revokes a token immediately. This keeps the "stay signed in without re-entering a password" convenience of long sessions while bounding how long a leaked access token (e.g. via XSS) stays useful to 15 minutes.
- Every protected route runs through `requireAuth`; admin-only routes additionally run through `requireRole("Administrator")`. This is enforced server-side regardless of what the frontend shows or hides, since client-side route guards are a UX convenience, not a security boundary.
- Cardholders can only read their own card/wallet/transaction data - enforced by checking
  `card.cardholderId === req.user.id` on every cardholder-accessible route, not just by filtering the list view.

## Input validation & injection

- All database access goes through parameterised `better-sqlite3` prepared statements - no string concatenation into SQL anywhere, which rules out classic SQL injection.
- `express.json({ limit: "1mb" })` caps request body size to reduce payload-based DoS risk.
- Numeric inputs (amounts, pagination) are explicitly parsed and bounds-checked rather than trusted as-is from query strings.

## XSS

- React escapes all rendered content by default; the codebase deliberately avoids
  `dangerouslySetInnerHTML` anywhere. There's no user-generated HTML rendering surface in this PoC (no rich text fields), which removes most of the realistic XSS risk.

## Secrets & configuration

- `.env` is gitignored on both `backend` and `frontend`; `.env.example` files document required variables without real values.
- The JWT secret has a hardcoded local-dev fallback (`dev-secret-do-not-use-in-prod`) purely so the app boots without configuration during review - this is flagged loudly in code comments and would be removed (forcing a startup failure if `JWT_SECRET` is unset) before any real deployment.

## Audit logging

- Every sensitive admin action (login, card issuance, status changes, fund loads, refunds) writes an `AuditLogs` row with actor, action, entity and timestamp - visible in the Admin -> Audit Log screen. This is the backbone of the POPIA accountability requirement below.

## Rate limiting

- A small in-memory limiter caps login attempts to 10/minute/IP as a basic brute-force deterrent.Documented in code as something to replace with `express-rate-limit` or API-gateway-level throttling once this runs across more than one instance (in-memory state doesn't survive a restart or scale-out).

## OWASP Top 10 (2021) - how this PoC addresses each

| Risk | Mitigation in this PoC |
|---|---|
| A01 Broken Access Control | Server-side role checks + ownership checks on every route, not just UI hiding. |
| A02 Cryptographic Failures | bcrypt password hashing; HTTPS assumed at the deployment/ingress layer (not terminated in this PoC's Node process). |
| A03 Injection | Parameterised queries throughout; no raw SQL string building. |
| A04 Insecure Design | Card status transitions are enforced via an explicit state machine (`VALID_TRANSITIONS`) rather than trusting client-sent status values. |
| A05 Security Misconfiguration | `.env`-based config, CORS restricted to a configured origin, generic 500 error handler that doesn't leak stack traces. |
| A06 Vulnerable Components | Dependency list kept intentionally small; would add `npm audit` / Dependabot in CI for an ongoing project. |
| A07 Identification & Authentication Failures | Short-lived JWTs, vague login error messages (no "email not found" vs "wrong password" distinction), basic rate limiting. |
| A08 Software & Data Integrity Failures | `idempotencyKey` support on load/debit endpoints to prevent duplicate-transaction replay. |
| A09 Security Logging & Monitoring Failures | `AuditLogs` table + console logging of mocked notification dispatches; would add structured logging (Serilog/pino + a log sink) for a real deployment. |
| A10 Server-Side Request Forgery | Not directly applicable - this API makes no outbound requests to user-supplied URLs. |

## POPIA (Protection of Personal Information Act) considerations

This platform processes personal information (names, emails, card numbers, transaction history) of South African data subjects, so POPIA's conditions for lawful processing apply:

- **Accountability** - the audit log gives a record of who did what to whose data, which is the starting point for demonstrating compliance.
- **Purpose specification & minimality** - the schema only stores fields needed to run the expense card product (no unnecessary personal fields collected).
- **Security safeguards** - covered above (hashing, access control, parameterised queries).
- **Data subject participation** - a cardholder can view their own data (balance, transactions, notifications) but not anyone else's, which is a basic form of the access right POPIA grants.
- **What's missing for full compliance** (flagged honestly, not implemented in this PoC): a data retention/deletion policy, encryption at rest for the database file itself, a documented Information Officer / data processing agreement if a third party host this, and a formal Privacy Impact Assessment. These are organisational/process controls as much as code, and are out of scope for a 48-hour PoC but worth naming explicitly rather than ignoring.
