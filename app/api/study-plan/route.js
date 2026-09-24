import Anthropic from '@anthropic-ai/sdk';
import { supabaseFromRequest } from '@/lib/supabaseServer';
import { computeSessionDates, rankDecksByWeakness } from '@/lib/studyPlan';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 0 });
const MODEL = process.env.GENERATION_MODEL || 'claude-haiku-4-5-20251001';

function fallbackTip(deckTitle, daysBefore, eventTitle) {
  const when = daysBefore === 0 ? 'today' : daysBefore === 1 ? 'the day before' : `${daysBefore} days before`;
  return deckTitle
    ? `Review ${deckTitle} — ${when} ${eventTitle}.`
    : `Review your notes for ${eventTitle} — ${when}.`;
}

/** One Claude call for all of a plan's tips at once — dates and deck choice are already decided by the rules above; this only writes the sentence. */
async function generateTips({ event, courseName, sessions, deckTitle }) {
  const sessionList = sessions.map((date) => ({
    date,
    daysBeforeExam: Math.round((new Date(`${event.event_date}T00:00:00Z`) - new Date(`${date}T00:00:00Z`)) / 86400000),
  }));

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      system: `You write short, encouraging one-sentence study tips for a spaced study plan
leading up to a ${event.event_type}. The dates and which deck to review are already decided —
you only write the sentence, under 140 characters, naming what to focus on given how many
days before the ${event.event_type} that session falls.

Respond with ONLY valid JSON, no markdown fences: {"tips": ["...", ...]}
Return exactly ${sessionList.length} tips, in the same order as the sessions given.`,
      messages: [{
        role: 'user',
        content: JSON.stringify({
          event: event.title, course: courseName || null, deck: deckTitle || null, sessions: sessionList,
        }),
      }],
    });
    const block = response.content.find((c) => c.type === 'text');
    const cleaned = (block?.text || '').trim().replace(/^```json\s*/i, '').replace(/```$/, '');
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.tips) && parsed.tips.length === sessions.length) {
      return parsed.tips.map((t) => String(t).slice(0, 200));
    }
  } catch (err) {
    console.error('study-plan tip generation failed, using fallback tips:', err.message);
  }
  return sessionList.map((s) => fallbackTip(deckTitle, s.daysBeforeExam, event.title));
}

export async function POST(request) {
  const supabase = supabaseFromRequest(request);
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Please log in first.' }, { status: 401 });

  const { course_event_id } = await request.json().catch(() => ({}));
  if (!course_event_id) return Response.json({ error: 'Missing course_event_id.' }, { status: 400 });

  const { data: event, error: eventError } = await supabase
    .from('course_events')
    .select('id, title, event_date, event_type, course_id, courses(name)')
    .eq('id', course_event_id)
    .maybeSingle();
  if (eventError || !event) return Response.json({ error: 'Event not found.' }, { status: 404 });

  // Idempotent: a plan is generated once per event, not regenerated on every
  // calendar visit (that would re-spend Claude tokens for no reason).
  const { data: existing } = await supabase
    .from('study_plan_sessions')
    .select('*')
    .eq('course_event_id', course_event_id)
    .order('session_date');
  if (existing?.length) return Response.json({ sessions: existing });

  const today = new Date().toISOString().slice(0, 10);
  const dates = computeSessionDates(event.event_date, today);
  if (!dates.length) return Response.json({ sessions: [] }); // exam is today or already past

  // Pick the course's weakest deck (most due/low-ease/lapsed cards) to point the plan at.
  const { data: decks } = await supabase
    .from('decks')
    .select('id, title, flashcards(id)')
    .eq('course_id', event.course_id);

  const deckByFlashcard = new Map();
  for (const d of decks || []) for (const f of d.flashcards || []) deckByFlashcard.set(f.id, d.id);
  const flashcardIds = [...deckByFlashcard.keys()];

  const { data: progress } = flashcardIds.length
    ? await supabase.from('card_progress').select('flashcard_id, ease, lapses, due_at').in('flashcard_id', flashcardIds)
    : { data: [] };

  const cardsByDeck = new Map();
  for (const p of progress || []) {
    const deckId = deckByFlashcard.get(p.flashcard_id);
    if (!deckId) continue;
    if (!cardsByDeck.has(deckId)) cardsByDeck.set(deckId, []);
    cardsByDeck.get(deckId).push(p);
  }
  const ranked = rankDecksByWeakness(
    (decks || []).map((d) => ({ id: d.id, title: d.title, cards: cardsByDeck.get(d.id) || [] }))
  );
  const bestDeck = ranked[0] || null;

  const tips = await generateTips({ event, courseName: event.courses?.name, sessions: dates, deckTitle: bestDeck?.title });

  const rows = dates.map((session_date, i) => ({
    user_id: user.id,
    course_event_id,
    deck_id: bestDeck?.id ?? null,
    session_date,
    tip: tips[i],
    status: 'pending',
  }));

  const { data: inserted, error: insertError } = await supabase.from('study_plan_sessions').insert(rows).select();
  if (insertError) return Response.json({ error: 'Could not save the study plan.' }, { status: 500 });

  return Response.json({ sessions: inserted });
}
