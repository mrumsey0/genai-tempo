# Threat Model

## Project Overview

Tempo ("Student Planner") is a wizard-of-oz student assignment planning prototype. It is a pnpm monorepo (Node.js 24, TypeScript 5.9) with three artifacts:

- **student-planner** (web, served at `/`): React SPA. All planner/calendar state is browser-local (localStorage). No accounts, no server persistence.
- **api-server** (Express 5, served at `/api`): a single functional endpoint, `POST /api/calendars/import`, that downloads a public iCalendar feed and returns its raw text to the browser for a one-time import. Plus `/api/healthz`.
- **mockup-sandbox** (design/dev artifact, `/__mockup`): dev-only UI scaffold, not a production surface.

Shared `lib/` packages: `api-zod` (generated Zod schemas), `api-spec` (OpenAPI), `api-client-react`, and `db` (Drizzle scaffold — **currently unused**, schema file is empty).

Deployment: autoscale, public visibility, Replit-managed TLS.

## Assets

- **Internal network / cloud metadata** — the calendar import endpoint makes server-side outbound HTTP requests, making SSRF the primary risk asset.
- **User planner data** — assignments, estimates, study sessions, imported calendar snapshots. Stored only in the browser (localStorage); not transmitted to or stored on the server.

There are no server-side credentials, user accounts, sessions, payment data, or database records in scope.

## Trust Boundaries

- **Browser to API** — the only server trust boundary. The sole state-changing/fetching endpoint is the calendar import. No authentication exists because no server-side user data exists.
- **API server to arbitrary external hosts** — the import endpoint fetches attacker-supplied URLs server-side. This is the critical boundary and is defended by SSRF controls in `artifacts/api-server/src/lib/calendar-fetch.ts`.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/routes/calendars.ts` (`POST /api/calendars/import`), `artifacts/api-server/src/routes/health.ts`. Client entry: `artifacts/student-planner/src/`.
- **Highest-risk code:** `artifacts/api-server/src/lib/calendar-fetch.ts` — SSRF defense (DNS resolution + public-IP allowlist via `ipaddr.js`, connection pinning to validated address, scheme/port/credential validation, redirect re-validation, 1 MB cap, timeouts). Review this file for any regression that weakens IP validation, pinning, or redirect handling.
- **Client parsing:** `artifacts/student-planner/src/lib/calendars.ts` — parses imported ICS via `ical.js`, rendered through React (auto-escaped; no HTML sinks found).
- **Public vs auth vs admin:** All surfaces are public/unauthenticated by design; there is no auth, no admin, and no multi-tenant data.
- **Dev-only (ignore unless proven reachable):** `artifacts/mockup-sandbox/**`, `lib/db/**` (unused scaffold), `*.test.ts`.

## Threat Categories

### Information Disclosure / SSRF (primary)

The import endpoint fetches server-side from user-supplied URLs. Required guarantees (currently met in `calendar-fetch.ts`): only `http`/`https`/`webcal` with default ports and no embedded credentials; DNS-resolved addresses must all be public unicast (loopback, link-local `169.254.0.0/16`/metadata, private, and unspecified ranges rejected); the connection MUST be pinned to the validated resolved address to prevent DNS rebinding; redirects MUST be re-validated through the same checks; responses MUST be size-capped and time-bounded; error messages MUST NOT leak the resolved URL/host or raw DNS/TLS errors.

### Denial of Service

Mitigations present: per-request 1 MB download cap, DNS (5s) and request (12s) timeouts, event-count caps on client parsing. Rate limiting is in-memory and per-instance, so it is best-effort on autoscale; given the download/time caps and absence of a backing datastore, residual DoS risk is low.

### Tampering / Injection

No SQL (no DB in use), no shell execution, no filesystem writes from user input, no template injection. Client renders imported data through React escaping; no `dangerouslySetInnerHTML`/`eval`/`innerHTML` sinks found.

### Spoofing / Elevation of Privilege

Not applicable in the current design: no authentication, sessions, roles, or server-stored per-user resources. If server-side persistence or accounts are ever added, re-introduce authentication and object-level authorization analysis.
