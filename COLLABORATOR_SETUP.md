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
NEXT_PUBLIC_SITE_URL=http://localhost:3000
EMAIL_UNSUBSCRIBE_SECRET=...         # any random string, e.g. `openssl rand -hex 32`
```

## 5. Run it
```bash
npm run dev
```
Visit http://localhost:3000

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
