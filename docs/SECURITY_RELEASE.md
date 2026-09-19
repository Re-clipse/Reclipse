# Protected AI usage and reliable saves

## Result

AI generation, image transcription and syllabus parsing reserve a daily allowance
before calling Anthropic. Clients cannot write the counters or invoke the reservation
function. Reservations are atomic database upserts, scoped by user, operation and UTC
date. Existing generation counts are retained during migration. Defaults are five
generation attempts, ten image attempts and five syllabus attempts per user per day.

The limits count **attempts**, including failed or ambiguous provider requests.
Anthropic automatic retries are disabled so one reservation does not silently cause
multiple application-level calls. These are per-user controls, not a global provider
spending ceiling. Set a provider account spending limit separately as appropriate.
PDF and text extraction do not consume an AI allowance.

Study sets are saved by one `SECURITY INVOKER` database function. The deck, cards and
quiz either all commit or all roll back. Existing row-level security remains active.
Course ownership is checked. Each generated draft has a per-owner request ID, so
retrying the same save returns the original deck without duplicates. The browser
retains the generated draft after a save failure and offers **Retry saving**, which
does not call AI again. The draft is in memory: keep the page open until saved; it does
not survive browser crashes. A page-unload warning guards accidental refreshes.

## Rollout

Publishing this source does not apply the migration or deploy the app. No live database
or production deployment has been changed.

1. Use a staging Supabase project and review the migration. Existing schema must
   already include `supabase/schema.sql`, then `002_features.sql`,
   `003_syllabus_discover_collab.sql`, `004_campus_archive.sql`, and
   `005_fix_rls_recursion.sql`, in that order.
2. Apply `supabase/migrations/20260919203628_secure_ai_usage_and_atomic_save.sql`.
   It is transactional and retry-safe. This repository's earlier SQL files are not
   Supabase CLI migration-history entries: do not blindly run `db push` against an
   empty or differently managed project. Establish the baseline first.
3. Configure server-only `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, and the
   existing Supabase URL/publishable key. Never prefix secret keys with `NEXT_PUBLIC_`.
   Optional positive integer limits: `DAILY_GENERATION_LIMIT=5`,
   `DAILY_IMAGE_LIMIT=10`, `DAILY_SYLLABUS_LIMIT=5` (maximum 100000).
   Keep `CRON_SECRET` configured and matched by the reminder scheduler.
4. Install with `npm ci`, run `npm test`, then `npm run build` using the staging
   configuration. Node.js 22 or newer is recommended for the tests.
5. On staging, verify signup/login, text/PDF/image upload, generation, save, study,
   quiz, and syllabus parsing. Force a save failure and retry without regenerating.
   Test simultaneous requests from separate clients at the daily cap, and verify
   deployed policies/functions using Supabase's database advisors.
6. Release the migration and matching app during a maintenance window that pauses
   AI traffic. The old app's counter writes will no longer work after migration;
   do not serve old and new generation code concurrently. Verify the deployed
   endpoints, then resume traffic. Preserve a database backup before migration.

If deployment fails, pause affected features and fix forward; do not restore the
old client-writable counter policy as a quick workaround. Missing quota configuration
returns 503 and spends no AI credits. Failed saves retain the draft for retry.

## Verification evidence

- 78 automated tests passed with no skips.
- Database tests execute the supplied schema and migration in PGlite (Postgres),
  including actual RLS, role grants, function execution, uniqueness and rollback.
- Permission failures assert PostgreSQL permission errors; forced child-insert
  failure asserts a check-constraint error, then verifies all three tables are empty.
- Database migration applied twice successfully; existing counters retained.
- Quota tests exercise cap exhaustion, UTC days, operation/user isolation,
  invalid limits, and denied client mutation/reservation.
- Route tests exercise denied/expired login, database outages, invalid inputs,
  malformed/truncated AI responses, and independent image/syllabus budgets.
- Save-flow tests verify stable retry payloads, one generation across save retries,
  and rejection after a user changes account or loses their session.
- Production build passed with Next.js 14.2.35 and dummy credentials; all 25 static
  pages generated. A Google Fonts optimization download warning was nonfatal.
- Real HTTP checks on that local build: generation, extraction and syllabus endpoints
  return 401 without login; reminders return 503 without their configured secret.
- Browser checks: homepage renders; `/upload` redirects to `/login?next=%2Fupload`;
  login page content fits a 390px viewport with no horizontal overflow.

Measured line coverage: generation, syllabus parsing, shared AI guards, study-data
validation and save-flow helpers each 100%. Across files exercised by the suite:
84.39% lines, 77.67% branches, 86.11% functions. This is **not full-app coverage**;
untested UI, existing reminder-delivery branches and PDF error paths remain.

PGlite serializes execution within its single engine. Submitted overlapping quota
calls passed, but this is not a multi-connection production load test. External Auth,
Anthropic, email and payment services were mocked or not called. Full signed-in
browser generation/save and live database advisors still require configured staging.

## TDD record

Before fixes: quota route tests reproduced calls continuing after exhausted or
unavailable budgets; the new image tests reproduced paid transcription without
quota checks. The legacy SQL test proved a user could reset their counter. New
database function tests failed until implemented. The save-flow tests initially
failed to load the not-yet-created implementation, then passed after implementation.
The original first-pass endpoint suite had 12 failures before its fixes.

Commands: `npm test` and
`node --experimental-vm-modules --experimental-test-coverage --test tests/*.test.mjs`.
The source was initially supplied as a ZIP. Before publishing, its original files
were verified against the current GitHub repository to preserve existing work.

## Remaining work

Perform the staging/release steps above before claiming these protections are live.
Then review archive/payment access policies, reminder deduplication and HTML escaping,
dependency advisories, host-level request limits, and full mobile study flows.
The changes address the prioritized issues, not a claim that the entire site is audited.

References: [Supabase functions](https://supabase.com/docs/guides/database/functions),
[Supabase Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
