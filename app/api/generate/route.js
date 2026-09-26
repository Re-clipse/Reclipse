import Anthropic from '@anthropic-ai/sdk';
import { supabaseFromRequest } from '@/lib/supabaseServer';
import { parseGeneration, MAX_FLASHCARDS, MAX_QUIZ_QUESTIONS } from '@/lib/generation';
import { buildSystemPrompt } from '@/lib/generationPrompt';
import { isLaunchTrialActive } from '@/lib/premiumTrial';

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

// Usage is measured in CARDS, not generation-call count, since one call can
// produce anywhere from a handful of cards up to MAX_FLASHCARDS — a
// card-based budget is what actually tracks cost. Free: 1 generation/day
// (no monthly-count throttle, just this daily one), up to 900 cards/month —
// the same total the old flat 30-generation/month cap allowed. Premium: no
// daily limit, up to 2700 cards/month (90 generations' worth).
//
// Cost per generation at Haiku 4.5 pricing ($1/$5 per MTok in/out): roughly
// (~1.4k system prompt + up to 6k notes) * $1/MTok + up to 9k max_tokens
// output * $5/MTok =~ $0.05 typical; the one-retry-on-bad-parse path below
// can double that to ~$0.10 worst case. So free tier (900 cards ≈ 30
// generations' worth) lands ~$1.50-3/user/month worst case, unchanged from
// before; premium (2700 cards ≈ 90 generations' worth) lands ~$4.50-9/user
// /month worst case — re-check this arithmetic if MODEL, max_tokens, or
// these limits change.
const FREE_DAILY_GENERATION_LIMIT = Number(process.env.FREE_DAILY_GENERATION_LIMIT || 1);
const FREE_MONTHLY_CARD_LIMIT = Number(process.env.FREE_MONTHLY_CARD_LIMIT || 900);
const PREMIUM_MONTHLY_CARD_LIMIT = Number(process.env.PREMIUM_MONTHLY_CARD_LIMIT || 2700);

export async function POST(request) {
  const supabase = supabaseFromRequest(request);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: 'Please log in to generate a study set.' }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;

  // Premium: the global launch-week trial (everyone has it until a real
  // cutoff date is configured) OR a real paid subscription. Not Campus
  // Archive — that's a separate, shelved product.
  let premium = isLaunchTrialActive();
  if (!premium) {
    const { data: hasPremium, error: premiumError } = await supabase.rpc('has_premium_access');
    if (premiumError) {
      console.error('generate: premium check failed:', premiumError);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
    premium = Boolean(hasPremium);
  }

  // Daily throttle — free tier only, checked and reserved atomically (an
  // advisory-locked Postgres function) before we spend anything on the API
  // call. Premium has no daily limit, so it never calls this.
  if (!premium) {
    const { data: allowedToday, error: dailyError } = await supabase.rpc('try_increment_daily_generation', {
      p_user_id: user.id, p_today: today, p_daily_limit: FREE_DAILY_GENERATION_LIMIT,
    });
    if (dailyError) {
      console.error('generate: daily usage check failed:', dailyError);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
    if (!allowedToday) {
      return Response.json(
        { error: "You've hit today's free study set limit. Upgrade to Reclipse Plus for unlimited daily generations, or try again tomorrow." },
        { status: 429 }
      );
    }
  }

  let text;
  try { ({ text } = await request.json()); } catch { text = ''; }
  if (!text || text.trim().length < 50) {
    return Response.json({ error: 'Please provide at least a few sentences of notes to work with.' }, { status: 400 });
  }
  if (text.length > MAX_INPUT_CHARS) text = text.slice(0, MAX_INPUT_CHARS);

  // Monthly card budget — sized by tier, reserved before the AI call. A
  // failed/unparseable attempt still spends the reservation (see the RPC's
  // own comment): a wasted attempt still costs real Anthropic tokens.
  const monthlyCardLimit = premium ? PREMIUM_MONTHLY_CARD_LIMIT : FREE_MONTHLY_CARD_LIMIT;
  const { data: granted, error: budgetError } = await supabase.rpc('try_reserve_card_budget', {
    p_user_id: user.id, p_today: today, p_month_start: monthStart,
    p_monthly_card_limit: monthlyCardLimit, p_requested: MAX_FLASHCARDS,
  });
  if (budgetError) {
    console.error('generate: card budget check failed:', budgetError);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  if (!granted) {
    return Response.json(
      {
        error: premium
          ? `You've used this month's flashcard limit (${monthlyCardLimit} cards). It resets next month.`
          : `You've used this month's free flashcard limit (${monthlyCardLimit} cards). Upgrade to Reclipse Plus for more.`,
      },
      { status: 429 }
    );
  }
  const cardBudget = granted;

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
