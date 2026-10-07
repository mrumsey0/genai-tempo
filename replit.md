# Student Planner

Tempo is a functional, local-only student assignment planning prototype.

## Setup scope

- The imported workspace was empty: no original app, source code, README, or dependency files were available to migrate.
- The pnpm workspace scaffold is retained and its dependencies are installed.
- No migration copy scripts, API code generation, schema conversion, or database operations were needed.
- The student-planner web artifact is served at `/`.
- The API server and mockup sandbox are pre-existing scaffold packages, not the student planner.

## Run & Operate

- Start/restart the managed workflow `artifacts/student-planner: web` to run the prototype. It supplies PORT and BASE_PATH automatically.
- `pnpm --filter @workspace/student-planner run typecheck` — check the prototype.
- `TZ=America/Indianapolis node --experimental-strip-types --test artifacts/student-planner/src/lib/planner.test.ts` — scheduler and storage regression checks.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- The prototype requires no secrets, database, calendar connection, or AI integration. The pre-existing API scaffold is not used by it.

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

- This is intentionally a wizard-of-oz prototype. Do not replace keyword rules with a real AI service or import external calendars without a new user request.
- Browser-local persistence is sufficient for this prototype; assignments are not shared across devices or browsers.

## Product

One-week calendar with pre-filled recurring demo classes and meetings. Students add a title, description, and due date/time; after simulated thinking they can edit an estimate and schedule linked 30–60 minute work sessions.

## User preferences

User-defined estimation rules: case-insensitive "essay" anywhere in the title/description estimates 5 hours; otherwise "homework" estimates 30 minutes; otherwise estimate 1 hour. Essay wins if both occur. Simulate a few seconds of thinking; let users edit the estimate before scheduling. No real AI estimation or calendar import.

## Gotchas

- Working hours are 8 am–9 pm every day, in the browser's local timezone; estimates must be positive 30-minute increments.
- Scheduling starts from now, avoids all recurring events and existing sessions, and commits only when the entire estimate fits before the deadline.
- Storage errors must be visible; failed saves must not appear successful or overwrite corrupt stored data.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
