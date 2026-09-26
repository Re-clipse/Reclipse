// Pure, dependency-free helpers for the Lab Prep AI chat (app/api/lab-prep/route.js),
// kept separate so the cost-control logic — context truncation, conversation
// shape, the premium gate, and the same monthly-limit arithmetic
// try_reserve_lab_prep_turn (migration 020) enforces in Postgres — can be
// unit tested without a live Supabase project or an Anthropic API key. Same
// split already used for lib/generation.js and lib/labSchedule.js.

export const MAX_SOURCE_CHARS = 6000;
export const MAX_TURNS = 8; // one turn = one user message + one assistant reply
export const MAX_TOKENS_PER_REPLY = 800;

// PDF/photo text extraction (app/api/extract-pdf/route.js) occasionally leaves
// behind control characters or lone (unpaired) surrogate code units — common
// with math-symbol fonts in lecture-slide PDFs — which the Anthropic API
// rejects outright rather than tolerating, turning one bad paste into a hard
// failure for the whole request. Strip both before the text goes anywhere near
// a prompt.
export function sanitizeText(text) {
  return String(text || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, (m) => m.slice(0, -1));
}

/** Cap source material (deck content or uploaded text) to a fixed character budget. */
export function truncateSource(text, maxChars = MAX_SOURCE_CHARS) {
  const clean = sanitizeText(text).trim();
  if (clean.length <= maxChars) return { text: clean, truncated: false };
  return { text: clean.slice(0, maxChars), truncated: true };
}

/** A deck's title + flashcards, as plain-text source material for the prompt. */
export function buildDeckSourceText(deck, cards) {
  const lines = (cards || []).map((c) => `Q: ${c.question}\nA: ${c.answer}`);
  return [deck?.title || 'Untitled deck', '', ...lines].join('\n');
}

/** Same rule app/api/generate/route.js and app/api/lab-prep/route.js both use:
 * premium during the global launch trial, or a real subscription. */
export function isPremiumUser({ trialActive, hasPremiumAccess }) {
  return Boolean(trialActive || hasPremiumAccess);
}

/**
 * Validate the client-sent conversation shape before it reaches the model: a
 * non-empty array, strictly alternating user/assistant starting AND ending
 * on 'user', every message a non-empty string, and no more than MAX_TURNS
 * exchanges — the hard cap on how much context (and therefore cost) one
 * session can accumulate, since the full history is resent every turn.
 */
export function validateConversation(messages) {
  if (!Array.isArray(messages) || !messages.length) {
    return { ok: false, error: 'Say something to start.' };
  }
  if (messages.length > MAX_TURNS * 2) {
    return { ok: false, error: 'This session has reached its limit. Start a new Lab Prep session to continue.' };
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
    if (!m || m.role !== expectedRole || typeof m.content !== 'string' || !m.content.trim()) {
      return { ok: false, error: 'Something went wrong with this conversation. Please start a new session.' };
    }
  }
  if (messages[messages.length - 1].role !== 'user') {
    return { ok: false, error: 'Something went wrong with this conversation. Please start a new session.' };
  }
  return { ok: true };
}

/**
 * The exact arithmetic try_reserve_lab_prep_turn (migration 020) performs
 * atomically in Postgres, mirrored here so the limit boundary itself is unit
 * tested — the same way lib/labSchedule.js mirrors send-reminders' timing
 * logic. This does NOT test the RPC's atomicity/locking (that needs a live
 * Supabase project — see tests/e2e/README.md), only that the arithmetic
 * (>=, not >) is right.
 */
export function turnWithinMonthlyLimit(usedThisMonth, monthlyLimit) {
  return (usedThisMonth || 0) < monthlyLimit;
}
