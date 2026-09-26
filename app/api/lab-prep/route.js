import Anthropic from '@anthropic-ai/sdk';
import { supabaseFromRequest } from '@/lib/supabaseServer';
import { isLaunchTrialActive } from '@/lib/premiumTrial';
import { buildLabPrepSystemPrompt } from '@/lib/labPrepPrompt';
import { MAX_SOURCE_CHARS, MAX_TOKENS_PER_REPLY, truncateSource, buildDeckSourceText, validateConversation } from '@/lib/labPrep';

export const maxDuration = 60;

// Fail fast instead of hanging. Replies are short (capped below), so this never needs 50s in practice.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 50_000, maxRetries: 0 });

// Haiku 4.5 by default — same override pattern as GENERATION_MODEL (app/api/generate/route.js).
const MODEL = process.env.LAB_PREP_MODEL || 'claude-haiku-4-5-20251001';

// Premium-only feature, so there's no free-tier variant of this limit.
//
// Worst-case cost per FULL session (MAX_TURNS=8 exchanges — no prompt
// caching is in play right now, see the note above the Anthropic call
// below, so this is also the TYPICAL cost, not just the worst case): source
// material + instructions ≈ 2.3k tokens, resent every turn alongside the
// growing conversation history (max_tokens capped at MAX_TOKENS_PER_REPLY
// each reply). Summed input across all 8 calls ≈ 46k tokens; summed output
// (max_tokens hit every time) ≈ 8 * MAX_TOKENS_PER_REPLY = 6.4k tokens. At
// Haiku 4.5 pricing ($1/$5 per MTok in/out): ≈ 46000/1e6*$1 + 6400/1e6*$5
// ≈ $0.078/session worst case. The single most expensive turn (turn 8, the
// deepest context) costs ≈ $0.013 on its own, so a PREMIUM_LAB_PREP_MONTHLY_TURN_LIMIT
// of 60 bounds worst-case spend at ≈ 60 * $0.013 ≈ $0.78/user/month — this
// is on top of, not instead of, the flashcard-generation budget's own
// worst case (see app/api/generate/route.js). Re-check this arithmetic if
// MODEL, MAX_TOKENS_PER_REPLY, MAX_TURNS, or this limit change.
const PREMIUM_LAB_PREP_MONTHLY_TURN_LIMIT = Number(process.env.PREMIUM_LAB_PREP_MONTHLY_TURN_LIMIT || 60);

export async function POST(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: 'Please log in to use Lab Prep.' }, { status: 401 });
  }

  // Premium: the global launch-week trial, or a real subscription. Not
  // Campus Archive — same check as app/api/generate/route.js.
  let premium = isLaunchTrialActive();
  if (!premium) {
    const { data: hasPremium, error: premiumError } = await supabase.rpc('has_premium_access');
    if (premiumError) {
      console.error('lab-prep: premium check failed:', premiumError);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
    premium = Boolean(hasPremium);
  }
  if (!premium) {
    return Response.json(
      {
        error: 'Lab Prep is a Reclipse Plus feature. Upgrade to generate lab-style practice problems from your decks and notes.',
        upgrade: true,
      },
      { status: 403 }
    );
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { deckId, sourceText: rawSourceText, messages } = body || {};

  const convCheck = validateConversation(messages);
  if (!convCheck.ok) return Response.json({ error: convCheck.error }, { status: 400 });

  let sourceLabel = 'your notes';
  let sourceText;
  if (deckId) {
    // RLS-scoped by the caller's own token, same as every other deck read in this app.
    const { data: deck } = await supabase.from('decks').select('id, title').eq('id', deckId).is('deleted_at', null).maybeSingle();
    if (!deck) return Response.json({ error: "We couldn't find that deck." }, { status: 404 });
    const { data: cards } = await supabase.from('flashcards').select('question, answer').eq('deck_id', deckId).order('position');
    if (!cards?.length) return Response.json({ error: 'That deck has no cards yet.' }, { status: 400 });
    sourceLabel = deck.title;
    sourceText = buildDeckSourceText(deck, cards);
  } else {
    sourceText = String(rawSourceText || '').trim();
    if (sourceText.length < 50) {
      return Response.json({ error: 'Select a deck or add at least a few sentences of material first.' }, { status: 400 });
    }
  }
  const { text: cappedSource } = truncateSource(sourceText, MAX_SOURCE_CHARS);

  // Monthly turn budget — reserved atomically before the AI call. A failed
  // reply still spent the reservation, same reservation-not-refunded design
  // as try_reserve_card_budget (018): a wasted attempt still costs real
  // Anthropic tokens.
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data: granted, error: turnError } = await supabase.rpc('try_reserve_lab_prep_turn', {
    p_user_id: user.id, p_today: today, p_month_start: monthStart,
    p_monthly_turn_limit: PREMIUM_LAB_PREP_MONTHLY_TURN_LIMIT,
  });
  if (turnError) {
    console.error('lab-prep: usage check failed:', turnError);
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  if (!granted) {
    return Response.json(
      { error: `You've used this month's Lab Prep limit (${PREMIUM_LAB_PREP_MONTHLY_TURN_LIMIT} messages). It resets next month.` },
      { status: 429 }
    );
  }

  try {
    const systemPrompt = buildLabPrepSystemPrompt({ sourceLabel, sourceText: cappedSource, maxTokens: MAX_TOKENS_PER_REPLY });
    // NOTE: no cache_control here. Prompt caching would help (the system
    // prompt is identical across every turn of a session), but the pinned
    // @anthropic-ai/sdk version (0.32.1) only supports it via the separate
    // client.beta.promptCaching.messages resource, not this plain
    // messages.create() call — adding cache_control here made every request
    // fail. Revisit once the SDK is upgraded (a version bump, not a new
    // dependency) past when caching became part of the stable endpoint.
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS_PER_REPLY,
      system: systemPrompt,
      messages,
    });
    const block = response.content.find((c) => c.type === 'text');
    const reply = block?.text?.trim();
    if (!reply) {
      return Response.json({ error: 'The AI returned an empty reply. Please try again.' }, { status: 502 });
    }
    return Response.json({ reply });
  } catch (err) {
    console.error('lab-prep error:', err);
    const msg = String(err?.message || '');
    if (msg.includes('credit balance')) {
      return Response.json(
        { error: 'The AI service is out of credit. Add credit in the Anthropic console to keep using Lab Prep.' },
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
      return Response.json({ error: 'That took too long. Please try again.' }, { status: 504 });
    }
    if (err?.status === 429 || err?.status === 529) {
      return Response.json({ error: 'The AI service is busy right now. Please try again in a moment.' }, { status: 503 });
    }
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
