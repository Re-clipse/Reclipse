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
// Keeps per-user AI spend to roughly $1/month even at worst-case token usage (see lib/generationPrompt.js).
const MONTHLY_GENERATION_LIMIT = Number(process.env.MONTHLY_GENERATION_LIMIT || 30);

export async function POST(request) {
  const supabase = supabaseFromRequest(request);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: 'Please log in to generate a study set.' }, { status: 401 });
  }

  // Daily and monthly caps, checked before we spend anything on the API call.
  // Daily guards against a burst; monthly is the real cost cap (~$1/user/month at worst case).
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const { data: usageRows } = await supabase
    .from('usage_limits').select('usage_date, generations_count')
    .eq('user_id', user.id).gte('usage_date', monthStart);

  const usedToday = usageRows?.find((r) => r.usage_date === today)?.generations_count || 0;
  if (usedToday >= DAILY_GENERATION_LIMIT) {
    return Response.json(
      { error: `You've hit today's limit of ${DAILY_GENERATION_LIMIT} study sets. Try again tomorrow.` },
      { status: 429 }
    );
  }
  const usedThisMonth = (usageRows || []).reduce((n, r) => n + (r.generations_count || 0), 0);
  if (usedThisMonth >= MONTHLY_GENERATION_LIMIT) {
    return Response.json(
      { error: `You've hit this month's limit of ${MONTHLY_GENERATION_LIMIT} study sets. It resets next month.` },
      { status: 429 }
    );
  }

  let text;
  try { ({ text } = await request.json()); } catch { text = ''; }
  if (!text || text.trim().length < 50) {
    return Response.json({ error: 'Please provide at least a few sentences of notes to work with.' }, { status: 400 });
  }
  if (text.length > MAX_INPUT_CHARS) text = text.slice(0, MAX_INPUT_CHARS);

  try {
    const systemPrompt = buildSystemPrompt({ maxCards: MAX_FLASHCARDS, maxQuiz: MAX_QUIZ_QUESTIONS });

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
        parsed = parseGeneration(block?.text);
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

    await supabase.from('usage_limits').upsert(
      { user_id: user.id, usage_date: today, generations_count: usedToday + 1 },
      { onConflict: 'user_id,usage_date' }
    );

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
