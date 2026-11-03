# Phase 2 verification · 2026-11-02

| Check | Result |
| --- | --- |
| ESLint | Passed |
| Strict TypeScript | Passed |
| Unit, component and local PostgreSQL integration tests | 42 passed |
| Playwright desktop + Pixel 7 | 8 passed |
| Production build | Passed; dashboard/chart loaded as a separate chunk |
| Desktop/mobile/light/dark screenshots | Rendered and visually inspected |
| Hosted Supabase Auth/PostgREST/email | Not run: no credentials |
| Hosted multi-connection concurrency | Not run: no test database |

## Covered behavior

- Task generation respects the 30/60/90-minute budget, new-word setting and due-review load. Weak-module allocation requires at least three recent answers.
- TypeScript and PostgreSQL planners produce identical plans for 18 combinations of budget, review load and weak-module data.
- UTC/local midnight, DST repeated/skipped hours, leap dates, year boundaries, timezone changes, no-data streaks, gaps and duplicate dates.
- Completion and undo, no time inflation from task completion, automatic time task, early check-in rejection and immutable checked-in tasks.
- Idempotent repeated time writes, conflicting request IDs, duplicate check-ins, invalid minutes/notes, daily time cap, explicit replanning and preserved historical data.
- SQL migrations executed unmodified in PGlite with a minimal Supabase Auth/role shim. RLS/RPC isolate two accounts; anonymous callers and direct study writes are blocked. Internal helper functions cannot be called by ordinary authenticated clients.
- Due reviews, mastered vocabulary, correctness and weak question types are derived from owned fixture rows; account A cannot see account B's fixtures.
- Standalone ownership.sql regression script also executes locally (fixture UUIDs use a different test namespace).
- Browser workflows cover first-time setup, reload persistence, actual user-input time records, automatic completion, check-in, history, two-tab writes and next-day plans.

## Fixes observed during verification

The parity test found floating-point rounding at the 90-minute review limit. TypeScript now uses integer ratios before flooring, matching PostgreSQL numeric arithmetic. Task checkboxes provide immediate pending feedback and revert on failure instead of briefly resetting while a write is pending. The dashboard is lazy-loaded so the chart library is not downloaded for the initial auth screen.

The browser tests validate concurrent local writes using Web Locks. PGlite serializes operations on a single embedded database; it does not substitute for a hosted multi-connection load test. The production RPC has per-user row locking and database uniqueness constraints, but its hosted runtime still requires validation.

## Screenshots

- [Fresh dashboard](phase2-dashboard.png)
- [Mobile](phase2-mobile.png)
- [Checked-in workspace](phase2-checkin.png)
- [Dark mode](phase2-dark.png)

Checked-in screenshots use time/task entries explicitly entered through the QA browser. These are documentation examples, not production seed data or the user's actual learning history. Fresh installations start with no study activity.

## Cloud follow-up

Apply both migrations in order on a fresh project, or apply only migration 002 to an existing Phase 1 project. Then configure the two public environment variables. Repeat the UI flow with real accounts A and B; exercise study_action through PostgREST, two concurrent authenticated sessions, a real timezone date boundary and a simulated lost network response followed by retry. Retain the Phase 1 real-email authentication and recovery checks in verification.md.
