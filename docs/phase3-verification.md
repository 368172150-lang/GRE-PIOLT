# Phase 3 verification · 2026-11-02

| Check | Result |
| --- | --- |
| ESLint / strict TypeScript | Passed |
| Unit, component and embedded PostgreSQL integration tests | 78 passed |
| Desktop + Pixel 7 E2E | 20 passed |
| Production build | Passed; vocabulary remains a lazy route |
| Light/dark desktop and mobile layouts | Screenshot inspection completed |
| Hosted Supabase Auth / PostgREST / real multi-connection execution | Not run: no credentials |
| Actual speaker output on the user's device | Not verified; speech API dispatch is mocked in E2E |

## Verified behavior

- 24 unique original entries validate all structured fields and contain word-specific original examples. The SQL seed matches the local seed and can be rerun without creating activity.
- SM-2 uses calendar dates, one-/six-day initial intervals, EF updates/floor, lapse resets, interval bounds, and explicit mastery criteria. PostgreSQL and TypeScript match over 360 numerical combinations.
- Same-day correct extras do not advance due dates. Wrong answers save the original response and reset scheduling. Identical request retries are idempotent; stale revisions are rejected.
- Server grading ignores client quiz quality, computes spelling/choice correctness, validates ownership/date and records progress plus task completion transactionally.
- Private imports are isolated by RLS. Two accounts can import the same spelling into separate private rows. Private progress/reviews, helper calls and direct progress mutation are blocked for unauthorized callers; anonymous RPC access is denied. Draft AI-labelled content is excluded.
- CSV handles BOM, quoted commas, escaped quotes, CRLF and embedded newlines; malformed headers/quotes/content, excessive rows and oversized text are rejected before import. Preview/review confirmation is required by UI and server.
- Daily new-word allowance follows the frozen budgeted plan rather than blindly using a larger preference. Vocabulary completion updates tasks without adding time entries. Checked-in plans stay frozen, and Phase 2 check-in deduplication continues through the RPC wrapper.
- Local vocabulary and daily learning share one Web Lock and one storage commit. A two-tab E2E verifies that concurrent vocabulary and time writes preserve both records.
- E2E exercises favorite/search, accessible detail/import dialogs and Escape, card flipping, pronunciation dispatch, spelling mistakes/retry, choice grading, imports, persistence, automatic tasks, next-day due queues and six-day second intervals.

The PostgreSQL tests execute all three migrations unmodified with PGlite and a minimal Supabase identity/role shim. This validates SQL and policy behavior, not the hosted email/API runtime or concurrent database connections. The existing Phase 1/2 tests are retained.

## Issues caught and fixed

- SQL variable/column ambiguity in vocabulary reads/imports; resolved through distinct names and qualified columns.
- React Strict Mode's synthetic dialog cleanup emitted a stale close event that dismissed newly reopened dialogs; close handling now checks the actual open state.
- The midnight E2E now waits for a confirmed save before advancing its simulated clock; truly stale writes remain rejected by the application.
- Vocabulary queues now use the same frozen new-word target as daily tasks. This covers conflicting preferences such as 100 new words in a 30-minute budget.
- SM-2 integer-ratio arithmetic avoids ceiling drift at exact products such as 25 × 2.2.

## Screenshots

[Library](phase3-library.png) · [Card](phase3-card.png) · [Mobile](phase3-mobile.png) · [Import preview](phase3-import.png) · [Dark mode](phase3-dark.png)

Screenshots use a fresh QA browser and original seed content. No fake learning activity is inserted into production seed files.

## Cloud acceptance remaining

Apply migration 003 and seed.sql after Phase 2 (or all migrations plus seed on a fresh project). Repeat study, import, favorite and quiz flows with real accounts A/B through PostgREST. Verify each cannot read the other's private words/progress/reviews, and repeat concurrent/lost-response submissions on a hosted test database. Retain the Phase 1 real-email authentication checks. Check audible pronunciation manually on the intended device.
