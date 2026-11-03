# Phase 1 verification

Historical Phase 1 record. Current Phase 2 behavior and executed checks are documented in [phase2-verification.md](phase2-verification.md); date-boundary and duplicate check-in tests are now implemented. Cloud authentication remains pending configuration.

## Automated scope

The test suite checks schema validation, honest empty states, persistence and update of local settings, corrupted storage, onboarding form validation, and auth UI request/error handling using mocked Supabase methods. Auth mocks prove UI integration only; they do not prove a live provider or email service works.

The Playwright suite exercises the actual app with empty cloud environment variables on desktop and Pixel 7 dimensions: onboarding, refresh persistence, updating goals, theme/language persistence, navigation, overflow and exit from local experience.

## Executed results · 2026-11-02

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript strict type check | Passed |
| Vitest + Testing Library | 14 tests passed |
| Playwright desktop + Pixel 7 | 2 E2E tests passed |
| Vite production build | Passed |
| Desktop/mobile screenshots | Rendered and visually inspected |
| Live Supabase authentication | Not run: credentials absent |
| Migration execution and database RLS regression | Not run: test database absent |

The first browser run could not locate browsers across ephemeral sandbox profiles; installing them in a stable workspace directory resolved the infrastructure issue. The desktop flow then exposed an inaccessible sign-out button in short windows. Making the sidebar scrollable fixed it; the complete desktop/mobile suite passed after the change. Mocked auth errors use Error instances, matching the SDK's error shape.

Screenshots: [desktop](screenshot.png), [mobile](screenshot-mobile.png). They show an explicitly labelled local experience and saved goals, not cloud learning activity.

## Manual local acceptance

1. Start the dev server with `npm run dev` and keep cloud variables empty.
2. Enter local experience. Save nickname, target 320, daily 60 minutes and 15 words.
3. Refresh; verify settings remain. Change target to 330; refresh and verify again.
4. Switch language and theme; verify persistence and keyboard focus indicators.
5. Open all eight routes. Future study modules must show their scheduled phase and an empty state.
6. At phone width, open/close navigation; verify there is no horizontal overflow.
7. Exit local experience; verify the authentication screen returns. Settings remain on this device.

## Cloud acceptance — requires Supabase, not executed

- Apply the migration, configure Auth redirect URLs, public environment variables and email delivery.
- Register account A, confirm email, sign in, complete onboarding, update nickname and goals, refresh, then sign out.
- Request a password reset, follow the email link, save a new password and sign in with it.
- Register account B. It must receive its own onboarding and never see A's settings.
- Using B's authenticated Supabase client, attempt to SELECT/UPDATE A's settings UUID and INSERT a row owned by A. Expect no rows or a permission error; changing a row's user_id must fail.
- Run `supabase/tests/ownership.sql` in an isolated database to assert ownership policies. It requires an admin SQL connection and rolls fixtures back.
- Confirm unauthenticated clients cannot read private tables and that unreviewed public content is inaccessible.

Do not claim Phase 1 cloud acceptance until these checks pass. The SQL migration is supplied but has not been run here. CI currently checks frontend behavior, not a provisioned Supabase instance.

## Later phases

Date boundaries, DST, duplicate check-ins, task generation, learning persistence, deterministic grading and real analytics remain acceptance requirements for the corresponding phases. Their tests are not replaced by Phase 1 settings tests.
