# E2E scope

This suite runs against a real `next dev` server (see `playwright.config.js`),
using throwaway Supabase-shaped env vars in `.env.local` (gitignored) that
are just enough for the app to boot and render client components — they are
**not** a real Supabase project, and there is no live Anthropic key either.

## What's covered here

- `landing.spec.js` — the signed-out marketing page: hero renders, CTAs point
  at the right routes, the demo is reachable with no login, 404s render the
  app's not-found page.
- `login-form.spec.js` — every bit of the login/signup form's behavior that
  happens **before** a network call: mode switching, the referral-code field
  appearing/disappearing, `?mode=signup` / `?ref=` deep links, client-side
  password-length validation, and the show/hide password toggle.
- `demo-study-quiz.spec.js` — the `/demo` page's flashcard → quiz →
  completion loop. `/demo` is a no-login, no-database, no-AI page that
  deliberately mirrors the markup/classes of the real `/study` and `/quiz`
  pages (see the comment at the top of `app/demo/page.js`), so it's used
  here as the closest thing to a "study a deck" / "take a quiz" smoke test
  that's reachable without credentials.

## What's intentionally NOT covered, and why

A true end-to-end **sign up → generate a deck → study it → take a quiz**
journey needs:

1. A real (or local) Supabase project — auth, `decks`/`flashcards`/
   `quiz_questions` tables, RLS policies — to sign up a user and persist a
   generated deck.
2. Either a real Anthropic API key, or route-level mocking of
   `POST /api/generate`.

Neither is available in this sandbox. Faking Supabase Auth well enough for a
believable round trip means intercepting `**/auth/v1/**` and reproducing
supabase-js's internal request/response contract — undocumented, likely to
drift silently out of sync with reality, and exactly the kind of "mock that
can't be trusted" this suite tries to avoid (see the parent agent's
principles: mocks must be verified against a real contract, not guessed at).

**To close this gap for real, in order of effort:**

1. Stand up a disposable local/test Supabase project (the Supabase CLI's
   `supabase start`, or a scoped test project) and seed it via the API in a
   `beforeEach`/fixture — exactly like the worker-scoped auth fixture
   pattern this agent defaults to. This gives you a *real* signup/login and
   a real deck round trip, no mocking required.
2. For the AI call specifically, `page.route('**/api/generate', ...)` is
   safe to mock even with a real Supabase project, since it's the app's own
   same-origin route (not a third-party API contract you don't control) —
   pair it with a couple of contract tests that hit the real Anthropic API
   occasionally (e.g. nightly) so the mock can't silently drift.

Once either exists, add `tests/e2e/signup-generate-study.spec.js` following
the fixture pattern in this repo's other specs: create a user + course via
the API, seed a deck (real or mocked-generate), then assert the UI journey
exactly as these smoke tests do today.

**The lab-reminders walkthrough** (`/calendar`, `components/LabRemindersModal.js`)
hits the same wall: the walkthrough only appears on a real, signed-in
`/calendar` page load with a `profiles` row and (for the "yes" path) a
`lab_schedules` insert — none of which this sandbox can produce without the
same real-Supabase setup described above. `lib/labSchedule.js`'s pure
occurrence/reminder-timing logic (including a fixed-clock, non-UTC-timezone
case) is covered in `tests/unit/labSchedule.test.js` instead. Once a real or
local Supabase project exists for this suite, add a spec here that signs in,
visits `/calendar` fresh (`profiles.lab_walkthrough_seen = false`), and
covers both paths: "No thanks" dismisses and never reappears on reload;
"Yes, add my labs" reaches the add-row form, submits one row, and the lab
then appears in the "Your labs" list.
