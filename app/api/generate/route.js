import Anthropic from '@anthropic-ai/sdk';
import { supabaseFromRequest } from '@/lib/supabaseServer';
import { parseGeneration, MAX_FLASHCARDS, MAX_QUIZ_QUESTIONS } from '@/lib/generation';
import { buildSystemPrompt } from '@/lib/generationPrompt';

// Generating a full set takes 10-30s. Without this, hosts like Vercel cut the request off
// at their short default and the student sees a confusing failure.
export const maxDuration = 60;

// Fail fast instead of hanging. A set takes 15-35s; the route's own limit is 60s.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 50_000, maxRetries: 0 });

// Hard limits — enforced server-side, since the UI can always be bypassed.
const MAX_INPUT_CHARS = 24000;
// Haiku 4.5 is Anthropic's cheapest current model and is plenty for turning notes into cards.
// Set GENERATION_MODEL to trade cost for quality (e.g. claude-sonnet-5) without a code change.
const MODEL = process.env.GENERATION_MODEL || 'claude-haiku-4-5-20251001';
const DAILY_GENERATION_LIMIT = Number(process.env.DAILY_GENERATION_LIMIT || 5);
// Cost cap. At Haiku 4.5 pricing ($1/$5 per MTok in/out), one call is roughly
// (~1.4k system prompt + up to 6k notes) * $1/MTok + up to 9k max_tokens output
// * $5/MTok =~ $0.05; the one-retry-on-bad-parse path below can double that.
// So 30 generations/month lands around $1.50-3/user/month at worst case, not
// $1 — re-check this arithmetic if MODEL, max_tokens, or this limit change.
const MONTHLY_GENERATION_LIMIT = Number(process.env.MONTHLY_GENERATION_LIMIT || 30);
// Free (non-Campus Archive) monthly flashcard budget. Built and ready, but
// gated off by default: at launch every user gets free Campus Archive
// access, so this must not restrict anyone until FREE_TIER_LIMIT_ENABLED is
// flipped to 'true' once that trial period ends — no code change needed then.
const FREE_TIER_MONTHLY_CARD_LIMIT = Number(process.env.FREE_TIER_MONTHLY_CARD_LIMIT || 75);
const FREE_TIER_LIMIT_ENABLED = process.env.FREE_TIER_LIMIT_ENABLED === 'true';

export async function POST(request) {
  const supabase = supabaseFromRequest(request);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: 'Please log in to generate a study set.' }, { status: 401 });
  }

  // Daily and monthly caps, checked and reserved atomically before we spend
  // anything on the API call — a Postgres function serializes this per user
  // (advisory lock) so two concurrent requests can't both read "under the
  // limit" before either writes. Reserving up front, kept even if this
  // generation attempt fails downstream, is deliberate: a failed attempt
  // still spent real Anthropic tokens, which is exactly the cost this cap
  // exists to bound (see the arithmetic above).
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data: allowed, error: usageError } = await supabase.rpc('try_increment_generation_usage', {
    p_user_id: user.id, p_today: today, p_month_start: monthStart,
    p_daily_limit: DAILY_GENERATION_LIMIT, p_monthly_limit: MONTHLY_GENERATION_LIMIT,
  });
  if (usageError) {
    console.error('generate: usage check failed:', usageError);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  if (!allowed) {
    return Response.json(
      { error: `You've hit today's or this month's study set limit. Try again later.` },
      { status: 429 }
    );
  }

  let text;
  try { ({ text } = await request.json()); } catch { text = ''; }
  if (!text || text.trim().length < 50) {
    return Response.json({ error: 'Please provide at least a few sentences of notes to work with.' }, { status: 400 });
  }
  if (text.length > MAX_INPUT_CHARS) text = text.slice(0, MAX_INPUT_CHARS);

  // Free-tier card cap. Disabled by default (see FREE_TIER_LIMIT_ENABLED above);
  // when on, premium (Campus Archive) users are unaffected.
  let cardBudget = MAX_FLASHCARDS;
  if (FREE_TIER_LIMIT_ENABLED) {
    const { data: hasArchiveAccess, error: archiveError } = await supabase.rpc('has_archive_access');
    if (archiveError) {
      console.error('generate: archive access check failed:', archiveError);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
    if (!hasArchiveAccess) {
      const { data: granted, error: budgetError } = await supabase.rpc('try_reserve_free_card_budget', {
        p_user_id: user.id, p_today: today, p_month_start: monthStart,
        p_monthly_limit: FREE_TIER_MONTHLY_CARD_LIMIT, p_requested: MAX_FLASHCARDS,
      });
      if (budgetError) {
        console.error('generate: free card budget check failed:', budgetError);
        return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
      }
      if (!granted) {
        return Response.json(
          { error: `You've used this month's free flashcard limit (${FREE_TIER_MONTHLY_CARD_LIMIT} cards). Upgrade to Campus Archive for unlimited generation.` },
          { status: 429 }
        );
      }
      cardBudget = granted;
    }
  }

  try {
    const systemPrompt = buildSystemPrompt({ maxCards: cardBudget, maxQuiz: MAX_QUIZ_QUESTIONS });

    // One retry if the reply can't be parsed (e.g. cut off mid-JSON): a second attempt
    // usually succeeds, and we only bill the student's daily quota once either way.
    let parsed = null;
    const startedAt = Date.now();
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      // A second try only fits if the first failed quickly.
      if (attempt > 0 && Date.now() - startedAt > 20_000) break;
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 9000,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
      });
      const block = response.content.find((c) => c.type === 'text');
      try {
        parsed = parseGeneration(block?.text, { maxCards: cardBudget });
      } catch (parseErr) {
        console.error(`generate: unusable reply (attempt ${attempt + 1}, stop_reason=${response.stop_reason}):`, parseErr.message);
      }
    }
    if (!parsed) {
      return Response.json(
        { error: 'The AI returned something we could not read. Please try again.' },
        { status: 502 }
      );
    }

    if (!parsed.flashcards.length) {
      return Response.json(
        { error: "We couldn't pull any study material out of that text. Try notes with more detail." },
        { status: 422 }
      );
    }

    return Response.json(parsed);
  } catch (err) {
    console.error('generate error:', err);
    const msg = String(err?.message || '');
    if (msg.includes('credit balance')) {
      return Response.json(
        { error: 'The AI service is out of credit. Add credit in the Anthropic console to keep generating.' },
        { status: 502 }
      );
    }
    if (err?.status === 401) {
      return Response.json(
        { error: 'The AI service rejected our API key. Check ANTHROPIC_API_KEY on the server.' },
        { status: 502 }
      );
    }
    if (err?.name === 'APIConnectionTimeoutError' || /timed out/i.test(msg)) {
      return Response.json(
        { error: 'That took too long. Try a shorter section of notes.' },
        { status: 504 }
      );
    }
    if (err?.status === 429 || err?.status === 529) {
      return Response.json(
        { error: 'The AI service is busy right now. Please try again in a moment.' },
        { status: 503 }
      );
    }
    return Response.json(
      { error: 'Something went wrong generating your study set. Please try again.' },
      { status: 500 }
    );
  }
}
