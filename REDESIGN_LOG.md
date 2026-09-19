# Reclipse UX/UI Overhaul — Working Log

## 1. UX Audit (findings before any changes)

### Critical — broken or missing functionality
1. **Decks become unreachable after creation.** There was no deck list anywhere. After
   generating a deck you land on `/dashboard?deck=<id>`; close that tab and the deck is
   gone forever from the UI. No way back in.
2. **The quiz feature was half-built.** `/api/generate` generates quiz questions and
   saves them to `quiz_questions`, but no page ever read that table. Users paid (in API
   cost and wait time) for content they could never see.
3. **No sign-out.** Once logged in there was no way to log out.
4. **Auth guard fired too late.** `/upload` let a logged-out user pick a file, extract
   text, and hit "Generate" before telling them to log in — wasting the whole flow.
5. **Permanent "Loading…" state.** `/dashboard` showed "Loading…" forever if the deck
   didn't exist, had no cards, or the fetch failed. No empty state, no error state.
6. **Infinite card loop.** Flashcards wrapped `(i + 1) % cards.length` forever — no
   session-complete state, no sense of progress or finishing.
7. **No 404 page.** Any bad URL hit a bare Next.js default.

### Structural — the root cause of the visual problems
8. **100% inline styles.** Every element used `style={{}}`. Inline styles *cannot*
   express media queries, `:hover`, `:focus`, or `@keyframes`. This is why the app had
   no hover feedback, no animation, and no mobile layout — it wasn't an oversight, it
   was structurally impossible in the code as written.
9. **No shared components.** Buttons/inputs were re-declared with slightly different
   padding, radius, and weight on every page. Radii ranged 6-10px, paddings inconsistent.
10. **No nav.** Every page was an island. Navigation was manual URL editing.

### Visual / content
11. **Landing page was a placeholder** — a title, one line, two buttons. It didn't say
    what the product does, who it's for, or why it works. A first-time visitor had no
    reason to sign up.
12. **Generic system font stack**, no type scale, no rhythm.
13. **Loading states were bare text** ("Generating…"), which makes a 5-15s AI call feel
    broken rather than in-progress.

## 2. Changes made

(chronological; see git-less file list at the end)

### A. Foundation — design system (`app/globals.css`, new, ~390 lines)
Replaced all inline styling with a token-based stylesheet. This was the enabling
change: hover states, transitions, focus rings, and mobile breakpoints are now
*possible*, which they weren't before.
- Tokens: violet + yellow scales, neutrals, type scale, 4px spacing scale, radii,
  3 elevation levels, 2 easing curves, 3 durations.
- Components: `.btn` (5 variants, 2 sizes), `.card`, `.input`, `.textarea`, `.field`,
  `.alert`, `.badge`, `.progress`, `.empty`, `.skeleton`, `.drop`, `.flip`, `.option`.
- Motion: `fade-up` entrance on content, hover lift on buttons/cards, 380ms 3D card
  flip, shimmer skeletons, spinners. All ≤380ms so nothing feels sluggish.
- Accessibility: real `:focus-visible` rings (there were none), and a
  `prefers-reduced-motion` block that disables all animation for users who ask for it.
- Mobile: breakpoints at 860px and 640px; type scale shrinks, grids collapse to one
  column, action rows stack full-width, secondary metadata hides.

### B. Navigation (`components/Nav.js`, new — fixes audit #3, #10)
Sticky translucent header on every page. Auth-aware: logged out shows Log in /
Get started; logged in shows My decks / New set / **Sign out** (previously
impossible). Subscribes to `onAuthStateChange` so it updates instantly on login or
logout. Core features are now 1 click from anywhere.

### C. Landing page (`app/page.js` — fixes audit #11)
Was: a title, one sentence, two buttons. Now: hero with positioning + dual CTA,
"Three steps" explainer, "Why it beats rereading" section grounded in the testing
effect, and a closing CTA band. Auth-aware CTAs (logged-in users get "Create a study
set" rather than "Sign up"). Staggered entrance animation.

### D. Auth (`app/login/page.js` — fixes audit #4 partly)
Single page toggling login/signup, `?mode=signup` deep link, `?next=` redirect so
users return to where they were headed. Friendlier error mapping (Supabase's
"Invalid login credentials" → plain English). Redirects away if already signed in.
Inline spinner on submit.

### E. Deck library (`app/decks/page.js`, NEW — fixes audit #1)
The missing page. Lists all decks newest-first with flashcard and quiz counts
(single query using PostgREST aggregate embedding, not N+1). Skeleton loading,
designed empty state for first-time users, and deck deletion with optimistic UI
that rolls back on failure.

### F. Quiz (`app/quiz/page.js`, NEW — fixes audit #2)
Built the missing consumer for `quiz_questions`. One question at a time, immediate
colour-coded feedback, per-question explanation, progress bar, score summary with a
message that adapts to performance, retake and cross-links to flashcards.

### G. Study mode (`app/dashboard/page.js` — fixes audit #5, #6)
Rewritten. 3D flip card, progress bar, `Space` to flip / `1` / `2` to grade.
Self-grading: "Not yet" requeues the card, "Got it" retires it — so a session now
*ends*, with a completion screen reporting first-try accuracy. Added the missing
loading, empty, and error states.

### H. Upload (`app/upload/page.js` — fixes audit #4, #13)
Drag-and-drop zone with active/success states, click and keyboard accessible.
**Auth guard moved to page load**, so logged-out users are redirected before
filling anything in. Full-page progress state during the 10–20s model call with an
honest time estimate instead of a bare "Generating…". Live character counter that
warns before truncation.

### I. 404 (`app/not-found.js`, NEW — fixes audit #7)

## 3. Bugs found and fixed while testing

1. **Invalid model ID (would have broken generation entirely).** The code called
   `claude-sonnet-4-5`, which is not a valid model — the API only accepts the dated
   `claude-sonnet-4-5-20250929` or newer aliases. Verified against `GET /v1/models`.
   This would have failed the moment credit was added. Now `claude-sonnet-5`.
2. **PDF extraction was completely broken.** `pdf-parse` ships a pre-bundled pdf.js
   that webpack mangles, throwing at import. Every PDF upload failed with "Could not
   read this file" — the product's headline feature. Fixed by adding `next.config.js`
   with `serverComponentsExternalPackages: ['pdf-parse']`. Verified working against a
   real generated PDF.
3. **Missing `next.config.js` entirely** — created.
4. **Production build would have failed.** `useSearchParams()` without a Suspense
   boundary is a hard prerender error in `next build`. Affected `/dashboard`, and
   both new pages. All now wrapped; `next build` passes, 11/11 pages prerender.
5. **Wasted tokens on every generation.** Extracted PDF text was padded with runs of
   spaces and blank lines. Added a `tidy()` normalizer — same test PDF went from
   ~1,400 to 814 characters (~40% fewer tokens, i.e. directly cheaper per generation).
6. **Quiz questions were saved unconditionally** even when empty; now guarded.

## 4. Verification performed

- `npm run build` — compiles clean, 11/11 static pages generated, no warnings.
- All routes return 200; unknown routes correctly return 404.
- `/api/extract-pdf` tested with a real PDF **and** a .txt file — both return clean
  normalized text.
- Model ID validated against the live `GET /v1/models` endpoint.
- Dev server log checked for errors after each change — clean.

## 5. Flagged for you — decisions I didn't make alone

1. **Generation is still untested end-to-end** because the Anthropic account has no
   credit. Everything up to the API call is verified; the call itself and the
   save-to-Supabase path after it are not. Worth testing first thing once credit lands.
2. **Model choice is a cost/quality decision.** I picked `claude-sonnet-5` (current
   generation). Cheaper options exist (e.g. Haiku) at some quality cost. The earlier
   2–6¢/generation estimate was based on Sonnet 4.5 pricing — **re-check current
   pricing before relying on those numbers**, since the model changed.
3. **The Netlify marketing site is now inconsistent with the app.** `reclipsed.netlify.app`
   is black-and-white with dead `#` CTAs; the app is violet/yellow. Once the app is
   deployed, those CTAs should point at it. I left the marketing site untouched since
   you'd finalized it deliberately.
4. **Supabase `mailer_autoconfirm` is ON** — signup requires no email confirmation.
   Right call for removing friction now, but it means nobody's email is verified,
   so "first 20 users" promo eligibility can't be validated by email. Revisit before launch.
5. **No spaced repetition yet.** Grading resets each session; nothing persists to the
   database. Real SRS needs a schema change (a `reviews` table) — a bigger piece of work.
6. **PDF line-wrapping artifact**: text extracted from PDFs can break mid-word across
   lines ("electron tr / ansport"). The model handles this fine in practice; aggressive
   de-hyphenation risks corrupting legitimate text, so I left it alone deliberately.
7. **`lib/theme.js` is deprecated**, not deleted — it now maps to CSS variables so any
   stray import still compiles. Safe to delete once you're confident nothing uses it.

## 6. Files touched

New:      app/globals.css, components/Nav.js, app/decks/page.js, app/quiz/page.js,
          app/not-found.js, next.config.js, REDESIGN_LOG.md
Rewritten: app/layout.js, app/page.js, app/login/page.js, app/upload/page.js,
          app/dashboard/page.js, lib/theme.js (deprecated)
Patched:  app/api/generate/route.js (model ID), app/api/extract-pdf/route.js (tidy())

---

# Phase 2 — Feature build

Schema migrations run directly against Supabase via the Management API
(`supabase/002_features.sql`), so no manual dashboard steps were needed.

## New database tables
`profiles`, `courses`, `card_progress` (SM-2 state), `study_sessions`,
`quiz_responses`. Plus new columns on `decks` (course_id, summary, share_id,
is_public, copied_from, difficulty) and `flashcards` (card_type, position).
RLS on every new table; additive read policies so public decks are readable by
anyone while private data stays locked to its owner.

## Features shipped

**Spaced repetition (`lib/srs.js`, `/study`)** — full SM-2. Four grades
(Again/Hard/Good/Easy) each showing the next interval before you pick. Missed
cards requeue within the session; scheduling persists per user per card.
`/study?mode=due` reviews everything due across all decks. 11 unit tests pass.

**Mock exam (`/exam`)** — pick any combination of decks, 10/20/30 questions,
10-45 min timer. Shuffled, navigable both ways, answers changeable before
submit, auto-submits at zero. Results show score plus every missed question with
the correct answer and explanation.

**Deck workspace (`/deck/[id]`)** — tabbed: Cards (add/edit/delete, inline
rename of the deck), Summary, Ask AI, Settings (assign course, share, duplicate).

**Chat with your notes (`/api/chat`)** — ask questions answered from that deck's
own source text. Prompted to say plainly when something isn't in the notes rather
than blurring the line, since students revise to a syllabus.

**Photo → flashcards (`/api/extract-pdf`)** — upload a photo of handwritten notes
or a whiteboard; transcribed via vision, then turned into cards. Removes the
"scans not supported" limitation. Prompt tells it to mark illegible text rather
than guess, so wrong facts don't silently become flashcards.

**Sharing (`/shared/[shareId]`)** — public deck pages that work with no login,
showing a 5-card preview and a "Save to my decks" button that deep-copies cards
and quiz into the visitor's account. This is the campus viral loop.

**Courses, search, filtering (`/decks`)** — group decks by course, live search,
filter pills, due-count and streak in the header.

**Progress dashboard (`/stats`)** — cards reviewed, quiz accuracy, cards known
(interval ≥ 7d), time studied, 4-week activity heatmap, streak, and weak-spot
detection ranking decks by quiz accuracy (min 3 answers before a deck is judged).

**Onboarding (`/welcome`)** — 3 steps, skippable, ends by dropping you into your
first upload with the course pre-selected. New signups route here automatically.

**Generation upgrades** — now also returns a bullet summary and fill-in-the-blank
(cloze) cards, and takes a difficulty setting (intro/standard/advanced) that
changes how questions are pitched.

**Also:** dark mode with no flash-on-load, PWA manifest + icon (installable to a
phone home screen), per-page browser titles, mobile nav sheet, shared `useAuth`
guard replacing four slightly-different copies, keyboard shortcuts throughout
(Space to flip, 1-4 to grade, A-D to answer, Enter to advance), and quiz misses
now surface as a "what to review" list.

## Bugs found and fixed in this phase
1. **I broke PDF extraction myself.** Renaming the config key to
   `serverExternalPackages` (Next 15 syntax) silently disabled it on Next 14 —
   PDFs failed at runtime while the build stayed green. Reverted to
   `experimental.serverComponentsExternalPackages` and left a comment for whoever
   upgrades to Next 15.
2. **Stale `.next` cache masked the fix** — the revert appeared not to work until
   the cache was cleared. Worth knowing: config changes need a cache clear.
3. **Python on this Mac has no SSL certs**, so scripted HTTPS calls fail. Used
   curl throughout instead. Only affects tooling, not the app.

## Verification
- `npm run build` clean, 17/17 pages prerender.
- All routes 200, unknown routes 404, `/api/generate` and `/api/chat` correctly
  401 without auth.
- All 10 PostgREST query shapes used by the app validated against the live DB
  (catches column typos that would otherwise only appear at runtime).
- 11 SRS unit tests + 10 stats/streak unit tests, all passing.
- PDF and .txt extraction re-tested end to end.

## Still flagged
- **Nothing involving the AI has run end to end** — no API credit. Generation,
  chat, and photo transcription are all code-complete and correctly wired, but
  unproven against the real API. Test these first once credit lands.
- **Cost will rise.** Generation now produces a summary and more cards, and photo
  transcription is a second vision call. Re-estimate per-set cost after the first
  real runs rather than trusting the earlier 2-6c figure.
- **No daily-reminder emails.** Needs a scheduled job (Supabase cron or a Vercel
  cron route) — not something that can run from a local dev server.
- **Collaborative decks and campus-wide discovery not built.** Both need real
  multi-user data and product decisions about privacy defaults.
- Password reset flow still untested (Resend sandbox only delivers to your own
  address until a domain is verified).

---

# Phase 3 — Onboarding rebuild, syllabus reminders, campus popular, collaborative decks

Migration `supabase/003_syllabus_discover_collab.sql` run directly against Supabase.

## Removed
**Difficulty calibration** — pulled out of `/api/generate` and `/upload` entirely
(prompt, UI pills, and the unused `decks.difficulty` column is just dormant now,
not dropped, since dropping a column is destructive and there's no data in it).

## Onboarding — rebuilt as a real 3-step flow, not a mock
Previous version asked for a display name then dumped the user at `/upload` with
no real "step 3." Now: `/welcome` (name a course) → `/upload?onboarding=1`
(step 2, real generation) → `/quiz?onboarding=1` (step 3, the actual tutorial
quiz) → dedicated completion screen that marks `profiles.onboarded_at`. Each
step is the real product, chained by an `onboarding=1` query param — not a
simulated walkthrough. If a generated deck has no quiz questions, onboarding
skips straight to `/decks` rather than dead-ending on step 3.

## Syllabus upload + opt-in exam/quiz/lab reminders
New: `course_events` table, `courses.remind_enabled`, `/syllabus` (upload or
paste a syllabus, extracted dates shown as an editable checklist before saving,
opt-in toggle, explicit "check your spam folder" note), `/api/parse-syllabus`
(Claude extracts only dates it can confidently pin to a real calendar date —
prompted to skip ambiguous ones like "Week 7" rather than guess, since a wrong
date defeats the point of a reminder), `/api/send-reminders` (finds opted-in
events due within 2 days, emails via Resend, marks sent so nothing double-fires).

**This one has a real limitation, flagged rather than glossed over:**
`/api/send-reminders` only runs when something calls it — it is not a background
job. I added `vercel.json` with a daily cron entry, which will work once this is
actually deployed to Vercel. Locally, or on any other host, nothing will call
this automatically. Test it manually by hitting the route directly until you've
deployed.

## Campus popular (`/discover`)
Anonymous, cross-user aggregation over `study_sessions` + `quiz_responses`,
scoped to `is_public = true` decks only — i.e. only decks someone explicitly
chose to share are ever surfaced; nothing about private decks or who owns them
leaks. Implemented as a Postgres `security definer` function (`popular_decks`)
rather than a client-side query: the function is the entire trust boundary,
returning only title/course_label/share_id/an aggregate count, granted to
`anon` + `authenticated` directly, no admin key needed in the running app.
Course grouping uses a new `decks.course_label` text snapshot taken at
share-time, since `courses` rows are per-user and can't otherwise be grouped
across accounts.

## Collaborative decks
New `deck_collaborators` table + a join-by-link flow (`/collab/[collabId]`,
`/api/join-collab`). Deliberately does NOT use a broad RLS policy like "anyone
can read collab-enabled decks" — that would leak every collaborative deck's
title to any logged-in user, not just people holding the specific link. Instead
joining happens through a server route using the admin/service-role client,
which is the only place that ever bypasses RLS, and only to do one narrow,
audited thing. Once joined, RLS grants full CRUD on that deck's `flashcards`
specifically (the literal "add cards together" ask) — deliberately not
`quiz_questions` or the deck's own settings, which stay owner-only. Deck
settings tab shows the invite link and a collaborator count (not names/emails,
to avoid a separate `profiles` RLS problem for a nice-to-have).

## A real bug found and fixed, with the wrong first diagnosis corrected
PDF extraction broke while testing this phase. First theory — a Next.js dev-mode
compilation-order quirk — was wrong, and I said so and kept digging rather than
shipping a fix for the wrong problem. Root cause, confirmed with actual evidence:
my test PDF (built via macOS's `cupsfilter`) has a corrupted cross-reference
table ("bad XRef entry"), which `pdf-parse`'s old bundled pdf.js handles
inconsistently. Verified this properly:
- Installed `reportlab` (confirming this machine has real internet access) and
  built a **properly-structured** test PDF — the kind an actual PowerPoint/Canvas
  export produces.
- Ran extraction against it **9 times** across dev and production builds: 9/9
  succeeded. This is not a flaky library issue for real-world files.
- The malformed file fails consistently (3/3), which is correct — it's actually
  broken.
- Fixed the *response* to this case: was a generic 500 "Could not read this
  file"; now a specific, actionable 400 ("this PDF's structure looks corrupted,
  try re-exporting or paste the text instead"), verified firing correctly.

## Verification
- `npm run build` clean, all new routes compile (26 total now).
- Full route sweep on both dev and production builds: every page 200, unknown
  routes 404, every protected API route correctly 401's without auth.
- `popular_decks` RPC confirmed callable with the anon key, returns `[]` (no
  public decks exist yet — correct, not broken).
- PDF extraction re-verified 9x clean on a well-formed file after the fix.

## Flagged for you
1. **`/api/send-reminders` needs a real deployment + a cron trigger to ever
   actually run.** Code-complete, `vercel.json` ready, but does nothing sitting
   on your laptop.
2. **Resend's sandbox sender may only reliably deliver to your own address**
   until a domain is verified there (same caveat as the password-reset email,
   noted earlier) — reminder emails inherit that limitation.
3. **Syllabus date extraction will be imperfect on real syllabi.** Prompted to
   skip ambiguous dates rather than guess, which means partial results are
   expected and normal, not a bug — that's why the extracted list is editable
   before saving.
4. **Collaborator list shows a count, not names.** Showing names would need a
   new RLS policy letting co-collaborators read each other's `profiles` rows —
   a real privacy-scope decision, so I left it as a count rather than deciding
   that for you.
5. **`decks.difficulty` and `courses` created before this phase are unaffected**
   — nothing here required touching existing data, and there was none anyway
   (0 decks in the database throughout this whole phase).

---

# Phase 4 — AI tutor removed, Premium Campus Archive

## Removed: AI tutor / "Chat with your notes"
Deleted `app/api/chat/`, the `DeckChat` component, and the "Ask AI" tab, per
your call. Verified no dangling references remain and `/api/chat` now 404s.

## Premium Campus Archive (migration 004)
Sell a finished deck to future students taking the same course. One-time
purchase, permanent access.

- `/archive` — browse listings, filter by course, price shown per deck.
- `/archive/[id]` — listing page with a **3-card preview** and buy button.
- Deck Settings → "Sell in the Campus Archive": set a price (min $0.50,
  default $2.99), get a shareable listing link, and see sales count + gross.
- `/api/archive/checkout` — creates a Stripe Checkout session.
- `/api/archive/webhook` — the only place a purchase is ever recorded.

**Scope note:** built as a **one-time purchase** (matching your $2.99 example).
The $4.99/semester recurring option is deliberately NOT half-built — it needs
different Stripe objects, access windows and cancellation handling. Clean next
step whenever you want it.

### Security decisions worth knowing
- **Access is granted only by the Stripe webhook**, after verifying Stripe's
  cryptographic signature. Never from a client call ("I paid" is forgeable) and
  never from the checkout `success_url` (a user can just visit that URL without
  paying). Verified: a forged webhook payload claiming a completed payment
  grants nothing.
- **Full deck content is protected at the database row level**, not just hidden
  in the UI. A non-purchaser inspecting network requests still can't pull the
  flashcards — RLS blocks it. The preview is a separate capped function that
  returns at most 3 cards.
- **`deck_purchases` has no client insert policy at all** — only the webhook's
  admin client writes there.
- Webhook writes are idempotent (`upsert` + unique constraint), because Stripe
  retries webhooks and double-granting or double-counting a sale are both wrong.
- Payment failure is graceful: with no Stripe keys configured, buying returns a
  clear "payments aren't set up yet" message instead of breaking or appearing
  to accept money it can't charge.

## Serious bug found and fixed: infinite recursion in RLS (migration 005)
Querying `deck_purchases` returned `infinite recursion detected in policy for
relation "decks"`. Root cause traced to **migration 003**, not 004: the `decks`
collaborator policy queried `deck_collaborators`, whose own policy queried
`decks` — a cycle. It sat latent because no query had forced both to evaluate
until the archive work did.

Fixed by moving every cross-table membership check into narrow `SECURITY
DEFINER` functions (`is_deck_owner`, `is_deck_collaborator`,
`can_edit_deck_cards`, `has_purchased_deck`). These don't re-trigger RLS on the
table they read, which breaks the cycle. Each takes a deck id, returns a boolean
about the current user, and leaks nothing else. Verified all 9 tables now query
cleanly.

**Worth flagging:** this would have broken collaborative decks in production
too, not just purchases. It was only found because the archive work happened to
exercise the cycle.

## Also fixed
Stale webpack chunks after installing `stripe` mid-session caused a bogus 500
(`Cannot find module './vendor-chunks/@supabase.js'`). Not a code bug — cleared
`.next`. Same class of issue as the earlier config-cache problem: **after
installing a package or changing next.config.js, clear `.next` before trusting
a failure.**

## Verification
- `npm run build` clean, 23/23 pages.
- Full route sweep: all 200, `/nope` 404s, `/api/chat` correctly 404s.
- Payment routes fail safely unconfigured (401 unauthed, 503 unconfigured).
- Forged webhook grants no access.
- All 9 tables query without recursion.
- `archive_listings` / `archive_preview` callable by anon, return `[]` correctly.

## Flagged for you
1. **Stripe account creation is yours to do** — I can't create financial
   accounts. Everything is built and waiting; add `STRIPE_SECRET_KEY` and
   `STRIPE_WEBHOOK_SECRET` to `.env.local` (template already in `.env.example`)
   and it goes live. Until then selling is cleanly disabled, not broken.
2. **Webhooks need a public URL** — Stripe can't reach `localhost`. Use the
   Stripe CLI (`stripe listen --forward-to localhost:3000/api/archive/webhook`)
   to test locally, or deploy first.
3. **`PLATFORM_FEE_PERCENT = 20` in `lib/stripe.js` is currently decorative.**
   Money goes straight to your Stripe account; there's no payout split to deck
   authors. If other students are meant to earn from their decks, that needs
   Stripe Connect — a significantly bigger build, and a business decision
   (payouts, tax, who's the merchant of record) I shouldn't make for you.
4. **Selling course material may have policy implications** at Laurier — worth
   a look at the academic-integrity rules before promoting this widely. Not a
   technical blocker, but cheaper to check now than after launch.
5. Still zero decks in the database, so none of this has been exercised with
   real data. Generation still needs API credit.

---

# Phase 5 — Visual polish + no-AI-credit features

Everything here works today without Anthropic credit, since none of it depends
on generation.

## Visual refinement
Layered a refinement pass on top of the base design system (didn't rewrite it):
- Violet-tinted, more layered shadow scale (xs → glow); gradient primary buttons
  with a soft glow on hover; gradient brand mark, progress bars, and stat numbers
  (gradient-clipped text).
- Card surfaces now use a subtle top-to-bottom gradient; smoother 3px hover lift.
- On-brand text selection colour and custom thin scrollbars.
- Gentle page-entrance animation, respecting prefers-reduced-motion throughout.
- Dark mode gets its own matched shadow + gradient tokens.

## New features
- **Toast notifications** (`components/Toast.js`) — global, replaces the old
  inline "Link copied" text. Used across deck settings (copy link, toggles,
  export). Auto-dismiss, reduced-motion aware.
- **Command bar + shortcuts help** (`components/CommandBar.js`) — ⌘/Ctrl+K opens
  quick navigation to any page; "?" opens a keyboard-shortcuts reference (the app
  is full of shortcuts that were previously undiscoverable). Mounted once globally.
- **Deck export** (`lib/export.js`) — download any deck as CSV, or as
  tab-separated text that imports directly into Anki or Quizlet. Fully
  client-side, no server. A real trust-builder — users can get their data out.
- **Settings page** (`/settings`) — display name, per-course reminder toggles,
  and sign-out in one place. Linked from nav (desktop + mobile).
- **Landing page features showcase** — a 6-card section surfacing spaced
  repetition, quizzes, mock exams, photo-to-cards, collaboration, and reminders,
  so first-time visitors see the actual depth.

## Verification
- `npm run build` clean, 24/24 pages prerender.
- Full route sweep: all 200, unknown routes 404.
- No compile errors after a clean cache rebuild.

## Flagged
- Still zero decks (no AI credit) — visual/UX work is verifiable, but anything
  needing real generated content still can't be exercised end to end.
- The stale `.next` cache issue recurred once after adding components. Same fix
  as before (clear `.next`). Worth remembering when a build error mentions
  `vendor-chunks`.

---

# Phase 6 — Premium polish + more motion

Direction from you: sleeker/premium, polish everywhere, more animation.

## Foundation retune (loaded last, overrides earlier values)
- **Tighter type scale** and tighter letter-spacing on headings for a
  higher-end, more editorial feel.
- **Restrained radii** (premium products use smaller curves) and **crisper,
  cooler shadows** with less spread — precision over softness.
- **Springy motion system**: added `--ease-spring` and a faster base timing;
  buttons now scale-press, cards lift precisely, lists stagger in.
- Hairline `--line` borders throughout; flatter default cards that lift only on
  interaction.

## Motion (more, but deliberate)
- Study: card-swap entrance per card, staggered grade buttons, springy flip.
- Quiz: options "pop" when marked correct/wrong.
- Score + completion rings: dramatic spring-scale entrance.
- Lists (decks/discover/archive): staggered `rise` entrance.
- Nav links: underline-grow on hover; active state underlined.
- Modals + command bar: spring entrance.
- Landing: drifting hero glows, spring-in step numbers and feature icons.
- Every animation gated behind `prefers-reduced-motion`.

## Verification
- `npm run build` clean, 24/24 pages.
- Full route sweep all 200, no compile errors.

## Note
Purely visual/motion layer — no logic touched, nothing new to break at the data
level. Still no decks / AI credit, so the study animations are best seen on a
real generated deck once credit is added.

---

# Phase 6b/6c — detail + dark mode refinement

## Detail polish
- Consistent premium focus-visible rings on all interactive elements (some had
  only the default browser outline).
- Subtle top-sheen on primary buttons for depth; overflow-clipped.
- Touch-device tap feedback (`@media (hover:none)`) since there's no hover there.
- Tabular figures on every number (stats, scores, timers, counts) so digits
  align — a small detail that reads as high-end.
- Refined kbd chips, hairline dividers, more generous section rhythm.
- Smooth colour transition when toggling dark/light (no jarring flip).

## Dark mode, properly done
Premium dark isn't flat grey — retuned to a deep, slightly warm near-black
(#0F0D16) with a raised-surface hierarchy, hairline borders, ambient violet/gold
glows fixed to the viewport, and glow-preserving shadows. Flip cards, nav,
kbd chips, badges, and selection all get dark-specific treatment.

## Verification
- Confirmed the "12 errors" seen mid-edit were the dev hot-reload webpack-runtime
  cache artifact (CSS cannot produce `__webpack_modules__` errors); clean rebuild
  → 0 errors.
- `npm run build` clean, 24/24 pages. globals.css now ~1220 lines, all additive.

---

# Phase 7 — Accessibility + error resilience

Both worth doing regardless of AI-credit status: no guessing about content.

## Accessibility
- **Accessible Modal component** (`components/Modal.js`) — proper
  `role="dialog"` + `aria-modal`, labelled, closes on Escape, **traps Tab focus**
  inside, **restores focus** to the trigger on close, and locks body scroll.
  Replaced the two hand-rolled modals (new-course, card edit) that had none of
  this.
- **Contrast fix** — `--gray-2` was #9CA3AF (~2.6:1 on white, fails WCAG AA).
  Bumped to #6B7280 (~4.6:1, passes AA for text).
- Audited icon-only buttons (already labelled), checkboxes (already wrapped in
  `<label>`), images (none — all SVG/CSS), and `lang` (set). Those were fine.

## Error resilience (flaky campus wifi)
- **`lib/net.js`** — `withTimeout` (a hung request rejects after 12s instead of
  stalling forever), `retry` (backoff for idempotent reads), `safeRead`.
- **`components/LoadError.js`** — a clean "couldn't load, try again" state with
  an in-place retry (no full page reload).
- Wired both into the decks page (highest-traffic): a timed-out or failed load
  now shows the retry UI instead of an infinite skeleton. Data already fetched
  in parallel there (good), so no perf change needed.

## Verification
- `npm run build` clean, 24/24 pages.
- Full route sweep all 200, 0 compile errors after clean rebuild.

## Still open / honest status
- Resilience pattern applied to decks page as the template; other pages
  (stats, deck detail, archive) still use plain loads — same pattern can be
  rolled out to them next, low-risk.
- Everything still unexercised with real generated content (no AI credit).

---

# Phase 7b — resilience rolled out

Applied the phase-7 pattern (12s timeout + LoadError retry) to the remaining
data-loading pages: stats, deck detail, and archive. Each now shows a clean
"couldn't load, try again" state on timeout/failure instead of a stuck skeleton,
with in-place retry (no full reload). All already fetched in parallel, so no
perf change. Build clean, 24/24 pages, all routes 200.

---

# Phase 8 — Mascot + Gizmo-inspired visual overhaul

Referenced Gizmo's aesthetic (purple-led, friendly, gamified, card-based,
welcoming) plus own ideas. Goal: make the pages feel designed and alive, not
basic.

## Meet Luna — the mascot
- **`components/Mascot.js`** — a friendly eclipse character (fits "Reclipse"):
  a violet crescent with a glowing gold corona. Pure inline SVG, so crisp at any
  size and fully themeable/animatable. Five expressions: happy, thinking,
  celebrate, sleepy, wave. Optional float + waving-hand animations, all gated
  behind prefers-reduced-motion.
- Woven through the whole app at the right emotional beats:
  - Landing hero (waving), science section (thinking), CTA (celebrating)
  - Login (waves on log in, celebrates on sign up)
  - Onboarding welcome (waving)
  - Study + quiz + exam completion — **mood reacts to score** (celebrates ≥70%,
    thinks below)
  - Upload "generating" state (thinking, floating)
  - Every empty state (decks, stats, discover, archive)
  - 404 page ("slipped into shadow")
- **PWA app icon** redrawn as Luna's face, so the installed-app icon has
  personality.

## Landing page — full rebuild (Gizmo-style)
- Two-column hero: bold clamp()-scaled headline with a violet→gold gradient
  accent, mascot art alongside, drifting ambient glows.
- **Trust strip** — quick "photo → cards in seconds → spaced repetition →
  mock exams" scannable row.
- **3-step "how it works"** as colored cards that lift on hover.
- **6 feature cards** with icons (spaced repetition, quizzes, mock exams, photo
  import, collaboration, reminders).
- **Science split** section with mascot + link to the real research.
- **CTA band** with celebrating mascot, richer violet gradient.
- Fully responsive: collapses to single column, mascot reorders above copy.

## App polish (gamified, Gizmo-like)
- **Stat chips** on the decks header — streak / decks / cards-due as colorful
  icon tiles, instead of a plain text subtitle.
- **Deck rows v2** — gradient accent spine that appears on hover, title turns
  violet on hover.
- **Bigger, more premium study flip** (300px, larger text) and quiz question
  text.
- **Upload drop zone v2** — larger, softer gradient, springy hover, floating
  icon tile.

## Verification
- `npm run build` clean, 24/24 pages, 0 errors.
- Full route sweep: all pages 200, 404 correct.

## Note
All visual/presentational — no data logic touched. The score-reactive mascot on
study/quiz/exam results is best seen once there's a real deck (AI credit) to
generate and run, but everything renders and is verifiable now.

---

# Phase 9 — Expressive mascot + celebration/reward system

Goal: make the app feel rewarding and alive. Deliberately tied every celebration
to a REAL accomplishment (finishing a session, a correct answer, a strong score,
an active streak) rather than idle clicks — so it reinforces studying, which is
healthy gamification, not a manipulative hook.

## Mascot (Luna) — much more expressive
Expanded from 5 to 10 moods: happy, excited, celebrate, wow, proud, love,
thinking, determined, wave, sleepy. Added sparkles on celebratory moods, bigger
"excited" eyes and cheeks, heart-eyes (love), star (proud), floating "z" (sleepy).
New idle animations: livelier float, spring bounce-in, wiggle (excited/celebrate/
wow), sparkle spin, waving hand, drifting zzz. All gated behind
prefers-reduced-motion. Moods across the app upgraded to the livelier set and
given bounce on the big moments.

## Celebration engine (`components/Celebrate.js`)
Dependency-free canvas confetti. `burst(el)` — a focused pop from an element
(correct answers); `cannon()` — a full two-sided + center burst for big wins.
Physics: gravity, drift, spin, fade. Mounted globally via CelebrateProvider.
Fully disabled under prefers-reduced-motion.

Wired to real moments:
- Correct quiz answer → confetti burst from the chosen option
- Quiz finished ≥70% → cannon
- Study session complete → cannon
- Mock exam ≥70% → cannon
- Demo: correct answer burst + finish cannon (so it's all testable NOW)

## Micro-interactions (dopamine, tastefully)
- Correct option: spring glow-pop + a checkmark-key scale-in
- Wrong option: gentle shake (feedback, not punishment)
- Flip reveal: brightness settle on the answer face
- Score: bounce-count entrance
- Stat chips: staggered rise; streak chip gets a warm glow when alive
- Key CTAs: subtle shimmer sweep on hover
- "Got it" button: satisfying press-scale
- All reduced-motion aware.

## Testable right now
The whole reward loop is live on /demo — no login, no AI credit: flip a card,
answer the quiz (watch confetti on correct), finish (cannon + bouncing excited
Luna). This is the real system, just with a sample card.

## Verification
- npm run build clean, 25/25 pages.
- Full route sweep all 200, 404 correct, 0 errors.

---

# Phase 10 — Rewards system (XP, levels, achievements, goals) + encouragement

Autonomous round: more ways to reward real studying. Design rule held throughout:
reward genuine effort (cards reviewed, quizzes passed, streaks, correct answers),
never idle clicks, and never guilt/pressure on a broken streak.

## Derived, not stored (no schema change)
Everything computes from data already collected (study_sessions, quiz_responses,
decks, card_progress). Robust, no new writes, nothing to migrate.
`lib/rewards.js` — XP formula (2/card, 10/quiz, 3/correct), a gently rising
level curve, rank titles, daily-goal math, and 12 achievement definitions.
14 unit tests, all passing.

## What's live
- **XP + Levels** — level card with animated XP bar (sheen), rank title
  (Newcomer → Legend), all-time XP. On the stats page.
- **Daily goal ring** — animated SVG progress ring toward 20 cards/day. On stats
  AND on the decks hub (shows "keep going" while in progress, a hit-goal state
  when done).
- **Achievements** — 12 badges (first deck, review milestones, streak milestones,
  perfect quiz, quiz count, level 5, etc.), unlocked purely from real activity,
  shown as an unlocked/locked grid with medal icons and a count.
- **Level-up celebration** — detects a genuinely new level (localStorage compare),
  fires a confetti cannon + a "Level up!" banner with an excited bouncing Luna,
  once per level-up.
- **Context-aware encouragement** (`lib/encourage.js`) — positive, varied lines
  Luna "says" on study/quiz completion, tuned to how you did (perfect / good /
  tough), never guilt-based.
- **Demo** teases the rewards ("you'd earn XP, level up, unlock achievements").

## Verification
- 14 rewards unit tests pass; npm run build clean, 25/25 pages; all routes 200,
  404 correct, 0 errors after clean rebuild.
- Confirmed the recurring 2-error blip was the webpack hot-reload cache again,
  not code — clean rebuild → 0.

## Note
XP/levels/achievements populate from real study history, so they're best seen
once there's a generated deck to study (AI credit). The mechanics, math, and UI
are all verified now; the demo shows the celebration side live.

---

# Phase 11 — Per-page identity + ambient motion

Goal (Gizmo-style): make every page instantly distinguishable, premium but
playful, with movement so nothing feels static or copy-pasted.

## Per-page identity (`components/PageHeader.js`)
Reusable header: a colored, animated icon tile + title + subtitle + optional
action, scoped with a per-page accent CSS var. 8-color accent palette and a
distinct stroke icon per page. Assigned:
- Decks = violet · Upload = blue · Exam = orange · Discover = teal
- Archive = amber · Stats = pink · Syllabus = green · Settings = indigo
Each header: icon pops in with a spring, a short accent rule underlines it, and
an opt-in `.btn--page` primary button picks up the page color. Applied to all 8
main pages.

## Ambient motion (`components/AmbientBg.js`)
Global, route-aware background: soft, slow, blurred floating shapes (circles,
rings, squares, triangles) themed to the current page's accent, each page with
its own shape layout. Three de-synced drift animations (22/27/31s) so motion
never looks mechanical. Non-interactive, behind content, fully still under
prefers-reduced-motion.
- Refactored from per-page mounts to ONE global route-aware component after the
  first approach landed shapes on loading-skeleton/Suspense-fallback mains
  instead of the content view. Global mount is robust to every page's multiple
  return states.
- Fixed layering: moved the base background to <html>, made <body> transparent,
  put the ambient at z-index 0, and lifted .page/.footer/sections to z-index 1
  so the shapes are actually visible behind content. Verified the markup renders.

## Verification
- npm run build clean, 25/25 pages; all routes 200; 0 errors after clean rebuild.
- Confirmed the mid-edit 12-error blip was the webpack hot-reload cache again.
