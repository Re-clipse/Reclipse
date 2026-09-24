/**
 * Rule-based study-plan scheduling. Dates come from here, never from the AI —
 * see app/api/study-plan/route.js, which only asks Claude for the short
 * per-session tip text once the dates and decks are already decided.
 */

// Days-before-the-exam offsets to try, closest to the exam first.
const CANDIDATE_OFFSETS = [1, 3, 7, 14, 21];
const MAX_SESSIONS = 4;

function fromISO(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`);
}
function toISO(date) {
  return date.toISOString().slice(0, 10);
}
function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Spaced session dates leading up to an exam, closest-to-exam offsets kept
 * first when there isn't room for all of them. Returns dates in chronological
 * (ascending) order, as YYYY-MM-DD strings. Empty if the exam is today or
 * already past.
 */
export function computeSessionDates(examDateStr, todayStr) {
  const exam = fromISO(examDateStr);
  const today = fromISO(todayStr);
  const daysUntil = Math.round((exam - today) / 86400000);
  if (daysUntil <= 0) return [];

  let offsets = CANDIDATE_OFFSETS.filter((o) => o <= daysUntil);
  if (!offsets.length) offsets = [Math.min(1, daysUntil)]; // exam is very soon — one session right before it

  return offsets
    .slice(0, MAX_SESSIONS)
    .map((o) => toISO(addDays(exam, -o)))
    .sort();
}

/**
 * Orders a course's decks by how much they need review: due cards, low-ease
 * cards, and lapses all count as "weak". The highest-scoring deck is what a
 * study session should point at.
 *
 * decks: [{ id, title, cards: [{ ease, lapses, due_at }] }]
 */
export function rankDecksByWeakness(decks) {
  const now = Date.now();
  return decks
    .map((deck) => {
      const score = (deck.cards || []).reduce((sum, card) => {
        const due = card.due_at && new Date(card.due_at).getTime() <= now ? 1 : 0;
        const weak = card.ease != null && card.ease < 2.0 ? 1.5 : 0;
        return sum + due + weak + (card.lapses || 0);
      }, 0);
      return { ...deck, weaknessScore: score };
    })
    .sort((a, b) => b.weaknessScore - a.weaknessScore);
}
