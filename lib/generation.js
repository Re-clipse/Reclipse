// Parsing and validation for the study-set JSON the model returns.
// Kept separate from the route so it can be tested without calling the API.

export const MAX_FLASHCARDS = 30;
export const MAX_QUIZ_QUESTIONS = 6;

/** Pull the JSON object out of a model reply, tolerating code fences and stray prose. */
export function extractJson(raw) {
  const text = String(raw || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(text.slice(start, end + 1));
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Cards that only make sense with the notes in front of you.
const VAGUE = /\b(the text|the lecture|the notes|the passage|according to|as described|as mentioned|above)\b/i;

/** Fisher-Yates shuffle that returns a new array. `rng` is injectable so tests are deterministic. */
export function shuffled(list, rng = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Turn whatever the model returned into a safe, well-formed study set.
 * Anything malformed or low quality is dropped rather than saved, because a bad quiz
 * row (wrong option count, out-of-range answer) would break the quiz page later.
 */
export function normalizeGeneration(parsed, { rng = Math.random, maxCards = MAX_FLASHCARDS } = {}) {
  const seen = new Set();
  const flashcards = (Array.isArray(parsed?.flashcards) ? parsed.flashcards : [])
    .map((f) => ({
      question: str(f?.question),
      answer: str(f?.answer),
      // A "cloze" card without an actual blank is just a mislabeled basic card
      // (models sometimes tag a card cloze without leaving a "_____" gap).
      type: f?.type === 'cloze' && /_{3,}/.test(str(f?.question)) ? 'cloze' : 'basic',
    }))
    .filter((f) => {
      if (!f.question || !f.answer) return false;
      if (VAGUE.test(f.question)) return false;                       // needs the notes to make sense
      const q = squash(f.question); const a = squash(f.answer);
      if (f.type === 'basic' && a.length >= 3 && a.length <= 40 && q.includes(a)) return false; // answer given away
      if (seen.has(q)) return false;                                   // duplicate question
      seen.add(q);
      return true;
    })
    .slice(0, maxCards);

  const quiz = (Array.isArray(parsed?.quiz) ? parsed.quiz : [])
    .map((q) => {
      const options = Array.isArray(q?.options) ? q.options.map(str) : [];
      const idx = Number(q?.correctIndex);
      return {
        question: str(q?.question),
        options,
        correctIndex: Number.isInteger(idx) ? idx : -1,
        explanation: str(q?.explanation),
      };
    })
    .filter((q) => q.question && q.options.length === 4 && q.options.every(Boolean)
      && q.correctIndex >= 0 && q.correctIndex < 4)
    .slice(0, MAX_QUIZ_QUESTIONS)
    // Models put the right answer in the first slot far too often; shuffle so position
    // never gives it away.
    .map((q) => {
      const order = shuffled([0, 1, 2, 3], rng);
      return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
    });

  const summary = typeof parsed?.summary === 'string' ? parsed.summary.slice(0, 2000) : '';
  return { summary, flashcards, quiz };
}

/** Raw reply text -> normalized study set. Throws if the reply is unusable. */
export function parseGeneration(raw, opts) {
  return normalizeGeneration(extractJson(raw), opts);
}
