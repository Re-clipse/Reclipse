// Rewards system — all DERIVED from data the app already collects
// (study_sessions, quiz_responses, decks, card_progress). No new writes, no
// schema change. Rewards attach to real studying: cards reviewed, quizzes
// taken, correct answers, streaks. Nothing rewards idle clicking, and nothing
// punishes or guilt-trips a broken streak.

// ---------- XP ----------
// Earn XP for genuine effort. Reviewing is the core habit, so it's the base;
// quizzes and correctness add a bit on top.
export function computeXp({ sessions = [], responses = [] }) {
  const reviewed = sessions.reduce((n, s) => n + (s.reviewed || 0), 0);
  const quizzesTaken = sessions.filter((s) => s.kind !== 'flashcards').length;
  const correct = responses.filter((r) => r.correct).length;
  // 2 XP per card reviewed, 10 XP per quiz attempt, 3 XP per correct answer.
  return reviewed * 2 + quizzesTaken * 10 + correct * 3;
}

// Levels use a gently rising curve so early levels come quickly (encouraging)
// and later ones take real work. XP needed to *reach* level L (L>=1).
export function xpForLevel(level) {
  if (level <= 1) return 0;
  // 60, 150, 270, 420, ... roughly quadratic
  return Math.round(30 * (level - 1) * level);
}

export function levelFromXp(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const curBase = xpForLevel(level);
  const nextBase = xpForLevel(level + 1);
  const into = xp - curBase;
  const span = nextBase - curBase;
  return {
    level,
    into,
    span,
    toNext: span - into,
    pct: span ? Math.round((into / span) * 100) : 0,
  };
}

// A friendly rank title per level band — a bit of flavor.
export function rankTitle(level) {
  if (level >= 20) return 'Legend';
  if (level >= 15) return 'Mastermind';
  if (level >= 11) return 'Scholar';
  if (level >= 8) return 'Sharp';
  if (level >= 5) return 'Rising';
  if (level >= 3) return 'Getting going';
  return 'Newcomer';
}

// ---------- Daily goal ----------
export function cardsToday(sessions, goal = 20) {
  const today = new Date().toISOString().slice(0, 10);
  const done = sessions
    .filter((s) => (s.created_at || '').slice(0, 10) === today)
    .reduce((n, s) => n + (s.reviewed || 0), 0);
  return { done, goal, pct: Math.min(100, Math.round((done / goal) * 100)), met: done >= goal };
}

// ---------- Achievements ----------
// Each: id, title, description, icon (emoji-free — a key svg name), and a
// predicate over computed stats. Unlocked purely from real activity.
export const ACHIEVEMENTS = [
  { id: 'first-deck', title: 'First steps', desc: 'Create your first deck', test: (s) => s.decks >= 1 },
  { id: 'first-session', title: 'Warm-up', desc: 'Finish your first study session', test: (s) => s.sessions >= 1 },
  { id: 'cards-50', title: 'Getting serious', desc: 'Review 50 cards', test: (s) => s.reviewed >= 50 },
  { id: 'cards-250', title: 'Grinder', desc: 'Review 250 cards', test: (s) => s.reviewed >= 250 },
  { id: 'cards-1000', title: 'Relentless', desc: 'Review 1,000 cards', test: (s) => s.reviewed >= 1000 },
  { id: 'streak-3', title: 'Habit forming', desc: 'Keep a 3-day streak', test: (s) => s.streak >= 3 },
  { id: 'streak-7', title: 'On a roll', desc: 'Keep a 7-day streak', test: (s) => s.streak >= 7 },
  { id: 'streak-30', title: 'Unstoppable', desc: 'Keep a 30-day streak', test: (s) => s.streak >= 30 },
  { id: 'perfect-quiz', title: 'Flawless', desc: 'Score 100% on a quiz', test: (s) => s.perfectQuiz },
  { id: 'quiz-10', title: 'Quiz whiz', desc: 'Take 10 quizzes', test: (s) => s.quizzes >= 10 },
  { id: 'decks-5', title: 'Library', desc: 'Build 5 decks', test: (s) => s.decks >= 5 },
  { id: 'level-5', title: 'Rising star', desc: 'Reach level 5', test: (s) => s.level >= 5 },
];

export function evaluateAchievements(stats) {
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: !!a.test(stats) }));
}
