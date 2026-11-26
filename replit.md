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
- AI estimation uses Replit AI Integrations for OpenAI, with automatically managed credentials available only on the server. No database or user account is required. `POST /api/calendars/import` downloads a public HTTP/HTTPS/webcal iCalendar feed for a one-time browser import, with public-IP validation, DNS pinning, redirect checks, download limits, and timeouts.
- `pnpm --filter @workspace/api-server run test:estimates` — AI validation, error handling, timeout, cancellation, usage-limit, and HTTP regression tests using a fake provider (no AI credits spent).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/student-planner/src/` — React app and calendar UI.
- `artifacts/student-planner/src/lib/planner.ts` — scheduling, recurring demo events, and local storage.
- `artifacts/student-planner/src/lib/planner.test.ts` — scheduling and storage checks.

## Architecture decisions

- Assignment effort is estimated server-side with `gpt-5-nano` through Replit AI Integrations. Only title and description are sent; calendars, deadlines, and existing plans are not sent to AI. Keep public calendar imports as snapshots; do not add OAuth calendar accounts or live sync without a new request.
- Browser-local persistence is sufficient for this prototype; assignments are not shared across devices or browsers.

## Product

One-week calendar that starts blank. The top-level Add calendar button offers a public iCalendar link import or the recurring sample student calendar. Added calendars persist as browser-local snapshots. Students add a title, description, and due date/time; they can request an AI estimate or enter hours manually, review the effort, and schedule linked 30–60 minute work sessions.

## User preferences

Use a low-cost model for real estimates from the assignment title and description. Always allow manual adjustment before scheduling. Never silently substitute the old keyword-based estimates when AI fails.

## Gotchas

- Working hours default to 8 am–9 pm in the browser's local timezone and can be changed in Settings. Weeks default to Sunday with a Monday option. Estimates must be positive 30-minute increments.
- Scheduling starts from now and avoids busy events from only calendars the user has added, plus existing sessions. A blank calendar must not have hidden sample commitments. If the full estimate cannot fit, save every available session before the deadline, keep the assignment even if no sessions fit, and show the unscheduled shortfall. Never schedule past the deadline.
- Spread new assignment sessions across available days; aim to finish at least 24 hours before the due time. Prefer 60-minute breaks, then 30-minute breaks, then contiguous blocks only when necessary to fit. Preserve the early-finish buffer whenever the full estimate can fit, and use the actual deadline only when it cannot. Previously saved assignments are not automatically moved.
- Storage errors must be visible; failed saves must not appear successful or overwrite corrupt stored data.
- Assignment deadlines appear on the calendar, including deadlines outside study hours. Individual sessions can be moved or deleted without deleting the assignment; moving preserves duration and rejects conflicts, past times, out-of-hours times, and deadline overruns.
- AI estimates show a short explanation and assumptions, are labeled as approximate, and are rounded up to half hours. Validate input and structured output. Never log prompts, responses, or provider errors containing private information.
- AI safeguards are shared, in-memory per server: at most 2 concurrent requests, 5 requests per minute, and 50 per UTC day. They reset on restart and multiply across server instances; they are not authentication or a durable spending cap. Provider timeout is 25 seconds and automatic SDK retries are disabled. Keep credentials out of frontend bundles and Git.
- Adding calendars never deletes or automatically moves saved assignments. Flag conflicts with existing study sessions instead. Imported feeds support daily-or-less-frequent recurrence, exceptions, cancellations, all-day entries, and embedded time zones; reject unsupported or invalid feeds explicitly. Links are not retained or logged, and imports do not auto-refresh.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
