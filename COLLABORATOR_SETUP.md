# Reclipse — setup for a new developer

Welcome. This gets you from zero to running the app locally.

## 1. Get the code
```bash
git clone <the-github-repo-url>
cd reclipse
npm install
```

## 2. Get access to the shared database
Ask Ethan to invite your email to the Supabase project
(Supabase dashboard → Project Settings → Team → Invite).
Then from Supabase → Project Settings → API, copy the Project URL and the
anon (publishable) key.

## 3. Get your own API keys (free — don't use anyone else's)
- **Anthropic** (flashcard/quiz generation): console.anthropic.com → API keys.
  Needs a little credit loaded to actually generate.
- **Resend** (email): resend.com → API keys. Free tier is fine.
- **Stripe** (payments — only if working on the archive feature): dashboard.stripe.com,
  stay in **test mode**, copy the test secret key.

## 4. Create your env file
Copy the template and fill in your values:
```bash
cp .env.example .env.local
```
`.env.local` is gitignored — never commit it, never paste keys into chat.

Fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...        # from Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # from Supabase (publishable key)
SUPABASE_SERVICE_ROLE_KEY=...       # from Supabase (secret key) — only needed for some server routes
ANTHROPIC_API_KEY=...               # your own
RESEND_API_KEY=...                  # your own
STRIPE_SECRET_KEY=...               # your own test key (optional)
DAILY_GENERATION_LIMIT=5
DAILY_IMAGE_LIMIT=10
DAILY_SYLLABUS_LIMIT=5
CRON_SECRET=...                    # random secret; must match the scheduler's Bearer token
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 5. Run it
```bash
npm run dev
```
Visit http://localhost:3000

## Security regression tests

With Node.js 22 or newer, run `npm test`. Tests exercise the actual upload and
reminder handlers with mocked authentication, PDF, AI and database adapters.
They do not send emails, spend AI credits, or access your database.

Uploads now require a verified login token; both the notes and syllabus screens
send it automatically. Scheduled reminders return 503 when `CRON_SECRET` is
missing or blank, and 401 when the supplied Bearer token does not match. Configure
the same secret in the deployment and scheduler before enabling reminders.

## Database upgrade required for this version

Read `docs/SECURITY_RELEASE.md` before deploying. This version requires the new
`secure_ai_usage_and_atomic_save` migration after the existing SQL files 001–005.
The server-only Supabase service-role key is now required for AI usage accounting.
Do not publish the app alone: generation fails closed if the quota function or
server key is unavailable, and saving requires the new transactional function.

## Working together (Git basics)
- Pull latest before you start:  `git pull`
- Make your changes, then:       `git add -A && git commit -m "what you did"`
- Share them:                    `git push`
- IMPORTANT: don't run `npm run build` while `npm run dev` is running — they
  share the .next folder and it breaks the dev server. Stop dev first if you
  need a production build.

## The stack
Next.js (App Router) · React · Supabase (auth + Postgres) · Claude API (Anthropic)
· Resend (email) · Stripe (payments, test) · deployed target: Vercel.
See REDESIGN_LOG.md for the full history of what's been built.
