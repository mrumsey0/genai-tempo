# Student Planner

Tempo is a student assignment planning prototype. Plans and calendar snapshots are browser-local; an API endpoint fetches public iCalendar feeds for import.

## Setup scope

- The imported workspace was empty: no original app, source code, README, or dependency files were available to migrate.
- The pnpm workspace scaffold is retained and its dependencies are installed.
- No migration copy scripts, API code generation, schema conversion, or database operations were needed.
- The student-planner web artifact is served at `/`.
- The API server fetches public calendar feeds; the mockup sandbox remains a separate scaffold package.

## Run & Operate

- Start/restart the managed workflow `artifacts/student-planner: web` to run the prototype. It supplies PORT and BASE_PATH automatically.
- `pnpm --filter @workspace/student-planner run typecheck` — check the prototype.
- `TZ=America/Indianapolis node --experimental-strip-types --test artifacts/student-planner/src/lib/planner.test.ts` — scheduler and storage regression checks.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The prototype requires no secrets, database, account connection, or AI integration. `POST /api/calendars/import` downloads a public HTTP/HTTPS/webcal iCalendar feed for a one-time browser import, with public-IP validation, DNS pinning, redirect checks, download limits, and timeouts.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/student-planner/src/` — React app and calendar UI.
- `artifacts/student-planner/src/lib/planner.ts` — scheduling, recurring demo events, keyword estimates, and local storage.
- `artifacts/student-planner/src/lib/planner.test.ts` — scheduling and storage checks.

## Architecture decisions

- This is intentionally a wizard-of-oz prototype. Estimates remain simulated. The user requested public-calendar-link imports; do not add OAuth calendar accounts, live sync, or real AI without a new request.
- Browser-local persistence is sufficient for this prototype; assignments are not shared across devices or browsers.

## Product

One-week calendar that starts blank. The top-level Add calendar button offers a public iCalendar link import or the recurring sample student calendar. Added calendars persist as browser-local snapshots. Students add a title, description, and due date/time; after simulated thinking they can edit an estimate and schedule linked 30–60 minute work sessions.

## User preferences

User-defined estimation rules: case-insensitive "essay" anywhere in the title/description estimates 5 hours; otherwise "homework" estimates 30 minutes; otherwise estimate 1 hour. Essay wins if both occur. Simulate a few seconds of thinking; let users edit the estimate before scheduling. No real AI estimation.

## Gotchas

- Working hours are 8 am–9 pm every day, in the browser's local timezone; estimates must be positive 30-minute increments.
- Scheduling starts from now and avoids busy events from only calendars the user has added, plus existing sessions. A blank calendar must not have hidden sample commitments. If the full estimate cannot fit, save every available session before the deadline, keep the assignment even if no sessions fit, and show the unscheduled shortfall. Never schedule past the deadline.
- Spread new assignment sessions across available days; aim to finish at least 24 hours before the due time. Prefer 60-minute breaks, then 30-minute breaks, then contiguous blocks only when necessary to fit. Preserve the early-finish buffer whenever the full estimate can fit, and use the actual deadline only when it cannot. Previously saved assignments are not automatically moved.
- Storage errors must be visible; failed saves must not appear successful or overwrite corrupt stored data.
- Assignment deadlines appear on the calendar, including deadlines outside study hours. Individual sessions can be moved or deleted without deleting the assignment; moving preserves duration and rejects conflicts, past times, out-of-hours times, and deadline overruns.
- Estimate explanations should simulate helpful AI reasoning by describing the work involved (for example, researching, outlining, drafting, and revising an essay), not announce keyword matches. Keep a brief simulated-estimate label; estimation remains rule-based with no real AI service.
- Adding calendars never deletes or automatically moves saved assignments. Flag conflicts with existing study sessions instead. Imported feeds support daily-or-less-frequent recurrence, exceptions, cancellations, all-day entries, and embedded time zones; reject unsupported or invalid feeds explicitly. Links are not retained or logged, and imports do not auto-refresh.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
