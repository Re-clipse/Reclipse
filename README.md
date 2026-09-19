# Reclipse

A study-assistance web app for university students: upload lecture notes/slides/PDFs,
get auto-generated flashcards and quizzes built on active recall.

## Stack

- **Next.js** (App Router) — frontend + API routes in one project
- **Claude API (Anthropic)** — turns uploaded notes into structured flashcards/quizzes
- **Supabase** — auth, Postgres database, file storage

## Setup — the two steps that still need you

I've built and installed everything I can from here. Two things still need a human,
because they involve creating accounts and reading back secret keys only you can access:

1. **Create a Supabase project** at https://supabase.com (free). In the SQL Editor,
   paste in the full contents of `supabase/schema.sql` and run it. Then grab your
   Project URL and anon key from Settings → API.
2. **Get a Claude API key** at https://console.anthropic.com (Settings → API Keys).

Once you have those three values, open `.env.local` (copy it from `.env.example` if it
doesn't exist yet) and fill them in:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
```

Then run:
```bash
npm run dev
```
and visit http://localhost:3000.
