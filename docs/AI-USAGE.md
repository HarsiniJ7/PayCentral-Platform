# AI Usage Log

I used Claude (Anthropic) throughout this build, mostly as a fast way to get boilerplate and a
first draft of the docs out of the way so I could spend my limited 48 hours on the decisions that
actually mattered: which track to pick, how the fraud engine should behave, and the UX of the two
portals. Below is roughly what that looked like in practice.

## Tools used

- **Claude** - scaffolding the Express API and React component structure, drafting documentation,
  and a UI pass on the frontend (gradients, shadows, the login screen's card-stack visual).
- **VS Code's built-in TypeScript/ESLint tooling** for the usual inline type-checking and lint-on-save
  - not "AI" in the generative sense, but worth naming since it caught a few of the small mistakes
  before they made it into a commit. Beyond that, this was a one-tool build.

## Where it actually helped

- **Boilerplate I didn't want to hand-write twice**: the nine Express route files, the SQLite
  schema + seed script, and the React page shells for both portals. This is the part of the brief
  where AI earns its keep - low ambiguity, high repetition, easy to review quickly because the
  shape of "a paginated list route" or "a status badge component" is obvious at a glance.
- **Turning the brief's fraud rules into actual logic.** The PDF lists things like "more than
  R20,000 in 10 minutes" and "five failed transactions" in plain English. Getting a first pass at
  the SQL/JS for each rule out of Claude and then checking it against the seed data was faster than
  writing six rule functions from scratch.
- **Keeping the docs honest.** I had Claude draft the architecture diagram, the ER diagram and the
  API reference *from the code that already existed*, rather than writing the docs first and hoping
  the code matched later. That ordering matters more than it sounds like it should.

## Where I had to step in

- The first pass at the card status logic let a `Closed` card go back to `Active`, which isn't a
  real transition - closing a card is meant to be final. I caught it reading through
  `VALID_TRANSITIONS` and tightened it.
- The generated `.env.example` shipped a JWT secret fallback baked into the code
  (`dev-secret-do-not-use-in-prod`) so the app boots without configuration during review. That's a
  reasonable PoC convenience but not something I wanted sitting there silently, so I left a loud
  comment next to it explaining it needs to become a hard failure (no fallback) before any real
  deployment.
- The Swagger doc was originally skipped entirely with a note explaining why - on review that read
  as a gap I could just fix rather than explain away, so I wired up `swagger-ui-express` against a
  hand-written OpenAPI spec instead of leaving it as a documented excuse.
- The first draft of the "international transaction" fraud rule compared card country to merchant
  country using two different fields that happened to have the same name in the seed data but
  weren't guaranteed to line up in general (`card.issuingCountry` vs a merchant record that didn't
  always have that field populated). It looked correct against the demo data and would have quietly
  under-fired in a slightly different dataset. I re-read the rule against the actual `Merchant`
  table columns and rewrote it to key off `merchant.country !== 'ZA'`, which is the field that's
  always populated, then re-ran the fraud engine tests to confirm the rule still fired on the seeded
  international transaction.

## What I decided without asking AI to weigh in

Choosing Option B over Option A, and scoping the backend down to a small Express/SQLite API rather
than attempting a partial .NET implementation, was a call about where to spend a hard 48-hour
limit - not something I wanted a model guessing at for me. The brief's own evaluation weighting
for the frontend track backs that up: 70% of the score sits in UI/UX, component architecture, API
integration, responsiveness and state management, so that's where the hours went.

One UX call I made against the AI-generated default: the first draft of the fraud dashboard's
live-refresh handler re-fetched the alert list on every `fraud:alert`/`transaction:new` socket
event but dropped whatever severity filter the admin had selected, so watching "High severity only"
would silently snap back to the unfiltered list the moment any new alert came in - the worst
possible moment for that to happen. I fixed `AdminFraud`'s `load()` callback to always re-apply the
current `severityFilter` on every refresh, live or manual, and tested it by filtering to High, then
using the Simulate page to fire a Low-severity alert and confirming the filtered view didn't
reset.

## Bonus-feature pass

After the core build, I asked Claude to audit the codebase against the brief's 12 bonus items and
implement the ones that were realistic to do properly in the time available, rather than bolting on
shallow versions of all twelve. That judgement call - which ones to actually build vs. document as
deferred - is recorded in this file's earlier sections and in the README's "Not implemented" note.
Two decisions worth calling out:

- The Redis cache and OpenTelemetry export both needed to degrade gracefully with zero
  configuration, since this needs to run on a reviewer's laptop that almost certainly doesn't have
  Redis or a trace collector running. I had Claude build the fallback paths (in-memory cache,
  silent OTel exporter failure) rather than make either a hard dependency, then verified both
  fallback paths by running the app with `REDIS_URL` unset and `OTEL_ENABLED=false` and confirming
  no request throws or blocks.
- Before treating any of this as done, I ran `npm install && npm run build && npm test` in both
  `backend/` and `frontend/` end to end (not just `tsc --noEmit`), and added the refresh-token
  tests (issue, rotate-on-use, reject-on-replay, logout-revokes) alongside the existing auth suite
  rather than assuming the new endpoints worked just because they compiled.

## Honest take

AI was useful here roughly in proportion to how mechanical the task was - route handlers and
documentation drafts, yes; the actual judgement calls about scope, the fraud engine's edge cases,
and what "production-ready thinking" means for a 48-hour PoC, no. I can walk through and defend
every endpoint, schema choice and UX decision in this repo in the second-round discussion, which is
the bar I held myself to while using it.
