# Development log

## 2026-11-02 · Phase 1

- Started in an empty workspace; existing files were preserved.
- Built React/TypeScript/Vite foundation, responsive navigation, light/dark theme and Chinese/English interface.
- Added Supabase authentication interfaces, local-only experience, onboarding and editable study goals.
- Added 13-table PostgreSQL migration with RLS, unique constraints, foreign keys and indexes.
- Added schema/service/form tests, desktop/mobile E2E, CI and deployment configuration.
- Real task generation, learning activity, quizzes, check-ins, charts and AI feedback are intentionally deferred to their phases.
- Supabase credentials were not provided; cloud auth and live RLS need external verification.

See verification.md for executed checks and remaining validation.

## 2026-11-02 · Phase 2

- Added pure date/streak utilities, budgeted daily task rules, state transitions and summaries. SQL mirrors the planner with parity tests.
- Replaced dashboard placeholders with actual tasks, progress, manual time entries, automatic time task, check-ins, notes, calendar/history and seven-day Recharts data.
- Added study_days/study_events and a guarded study_action RPC. Server-side date calculation, per-user row locks, expected-date checks, unique check-ins and event request IDs protect writes.
- Browser local writes use Web Locks across tabs and preserve Phase 1 settings. Cloud failures never fall back to local data.
- Split time/note/history UI into feature components and lazy-loaded the dashboard/chart bundle.
- Found and fixed a JavaScript/SQL floating-point planning mismatch, and added immediate pending checkbox feedback with rollback on write failure.
- Added midnight/DST/gap/no-data/duplicate tests, actual-migration PostgreSQL/RLS integration tests, and desktop/mobile multi-tab and next-day E2E coverage.
- Added a Phase 2 guide, verification report, current screenshots and updated architecture/database documentation. No cloud deployment or repository publication took place.
- Hosted Supabase Auth/PostgREST and real multi-connection concurrency are still unverified without credentials; local PGlite results are labelled separately.

## 2026-11-02 · Phase 3

- Added 24 original structured vocabulary entries, repeatable SQL seed generation and a downloadable CSV template. Examples/definitions are original and AI-assisted; no commercial word bank or dictionary audio is copied.
- Implemented card flipping/self-ratings, pronunciation dispatch, favorites, searching/status filters, spelling/meaning quizzes, original wrong-answer history and personal CSV import with preview/attestation.
- Added a pure SM-2 variant and SQL equivalent; local-date due queues, progress versions, repeat request IDs and correct-extra safeguards preserve spaced repetition.
- Added private owner-scoped vocabulary/RLS, durable vocabulary_reviews and guarded vocab_action. Daily vocabulary tasks complete transactionally without inventing time or quiz scores. Existing Phase 2 check-ins remain stable through a guarded wrapper.
- Local daily/vocabulary writes share one Web Lock and one backward-compatible storage commit. The learning allowance follows the frozen daily task target.
- Fixed SQL identifier ambiguity, Strict Mode dialog close races, and a save/clock race in the midnight E2E.
- Final verification: lint, strict typing, 78 unit/component/embedded database tests, 20 desktop/mobile E2E, production build and screenshot inspection passed. Hosted Supabase and actual audible output remain explicitly unverified.
- Phase 4 is not started; no cloud deployment, public repository or paid service was created.


## Phase 4 update

2026-11-02 — Phase 4: original 12-question Verbal and 16-question Quant bank, strict grading, KaTeX, timed sessions, protected server solutions, persistent mistakes/bookmarks, draft import extension and shared daily progress. Local verification: 115 tests and 36 desktop/mobile E2E cases. Hosted Supabase remains pending. Stop after Phase 4 for user confirmation.

See [Phase 4 guide](phase4-guide.md), [verification](phase4-verification.md) and [content review](content-review.md).


## Phase 5 update

2026-11-03 — Phase 5: four original Issue prompts, 30-minute persistent writing timer, autosave, revision conflict handling, text export, completion/history and editable notes. Added real-data analytics, calendar and explainable recommendations. Delivered an optional authenticated/rate-limited server feedback adapter, disabled and unconfigured. Added 39 tests and 18 desktop/mobile browser cases; cumulative 154 / 54. Hosted Supabase, Deno execution and external AI remain unverified. No deployment. Await confirmation before Phase 6.

See [Phase 5 guide](phase5-guide.md) and [verification](phase5-verification.md).


## 2026-11-03 — Phase 6 / v1.0.0

Completed local release hardening, original requirement mapping, clean installation, strict-CSP production acceptance, 169 unit/integration tests, 60 development E2E cases and 6 production cases. Fixed interrupted writing recovery, conflicting retry status, stale async results, rendering fallback and Windows test-server teardown. Updated dependencies with zero known audit findings at release time. Delivered source/static archives, SHA-256 checksums, license notices and explicit real-service verification steps. No public deployment or external AI calls.
