import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  computeXp,
  xpForLevel,
  levelFromXp,
  rankTitle,
  cardsToday,
  ACHIEVEMENTS,
  evaluateAchievements,
} from '@/lib/rewards';

describe('computeXp', () => {
  it('returns 0 for no activity at all', () => {
    expect(computeXp({})).toBe(0);
    expect(computeXp({ sessions: [], responses: [] })).toBe(0);
  });

  it('awards 2 XP per card reviewed', () => {
    expect(computeXp({ sessions: [{ reviewed: 10, kind: 'flashcards' }] })).toBe(20);
  });

  it('awards 10 XP per non-flashcard (quiz) session, on top of cards reviewed', () => {
    expect(computeXp({ sessions: [{ reviewed: 5, kind: 'quiz' }] })).toBe(5 * 2 + 10);
  });

  it('does not count a flashcards-kind session as a quiz attempt', () => {
    expect(computeXp({ sessions: [{ reviewed: 5, kind: 'flashcards' }] })).toBe(10);
  });

  it('awards 3 XP per correct response', () => {
    expect(computeXp({ responses: [{ correct: true }, { correct: false }, { correct: true }] })).toBe(6);
  });

  it('combines all three sources', () => {
    const xp = computeXp({
      sessions: [{ reviewed: 20, kind: 'flashcards' }, { reviewed: 4, kind: 'quiz' }],
      responses: [{ correct: true }, { correct: true }, { correct: false }],
    });
    // 24 cards * 2 = 48, 1 quiz * 10 = 10, 2 correct * 3 = 6 -> 64
    expect(xp).toBe(64);
  });

  it('treats a session with no `reviewed` field as 0 cards, not NaN', () => {
    expect(computeXp({ sessions: [{ kind: 'flashcards' }] })).toBe(0);
  });
});

describe('xpForLevel', () => {
  it('level 1 (and below) requires 0 XP', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(-5)).toBe(0);
  });

  it('is strictly increasing for level >= 1', () => {
    let prev = xpForLevel(1);
    for (let l = 2; l <= 25; l++) {
      const cur = xpForLevel(l);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });

  it('matches the documented curve for the first few levels', () => {
    expect(xpForLevel(2)).toBe(60);
    expect(xpForLevel(3)).toBe(180);
    expect(xpForLevel(4)).toBe(360);
  });
});

describe('levelFromXp', () => {
  it('starts at level 1 with 0 XP', () => {
    const r = levelFromXp(0);
    expect(r.level).toBe(1);
    expect(r.into).toBe(0);
    expect(r.pct).toBe(0);
  });

  it('handles negative XP gracefully (still level 1, no crash)', () => {
    const r = levelFromXp(-100);
    expect(r.level).toBe(1);
  });

  it('is exactly at 0% right after leveling up', () => {
    const boundary = xpForLevel(2);
    const r = levelFromXp(boundary);
    expect(r.level).toBe(2);
    expect(r.into).toBe(0);
    expect(r.pct).toBe(0);
  });

  it('is at 100% progress one XP below the next level (never rounds up to the next level)', () => {
    const boundary = xpForLevel(3) - 1;
    const r = levelFromXp(boundary);
    expect(r.level).toBe(2);
    expect(r.toNext).toBe(1);
  });

  it('round-trips consistently with xpForLevel (into + curBase == xp)', () => {
    for (const xp of [0, 1, 59, 60, 200, 1000, 5000]) {
      const r = levelFromXp(xp);
      expect(xpForLevel(r.level) + r.into).toBe(xp);
      expect(r.into + r.toNext).toBe(r.span);
    }
  });

  it('produces a sensible level for a large XP total', () => {
    const r = levelFromXp(100000);
    expect(r.level).toBeGreaterThan(10);
    expect(xpForLevel(r.level)).toBeLessThanOrEqual(100000);
    expect(xpForLevel(r.level + 1)).toBeGreaterThan(100000);
  });
});

describe('rankTitle', () => {
  it('maps level bands to titles, including exact boundaries', () => {
    expect(rankTitle(1)).toBe('Newcomer');
    expect(rankTitle(2)).toBe('Newcomer');
    expect(rankTitle(3)).toBe('Getting going');
    expect(rankTitle(5)).toBe('Rising');
    expect(rankTitle(8)).toBe('Sharp');
    expect(rankTitle(11)).toBe('Scholar');
    expect(rankTitle(15)).toBe('Mastermind');
    expect(rankTitle(20)).toBe('Legend');
    expect(rankTitle(99)).toBe('Legend');
  });
});

describe('cardsToday', () => {
  const NOW = new Date('2026-09-24T15:00:00.000Z');
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to a goal of 20 and 0 done with no sessions', () => {
    const r = cardsToday([]);
    expect(r).toEqual({ done: 0, goal: 20, pct: 0, met: false });
  });

  it('only counts sessions created today', () => {
    const r = cardsToday([
      { created_at: '2026-09-24T10:00:00.000Z', reviewed: 5 },
      { created_at: '2026-09-23T10:00:00.000Z', reviewed: 100 }, // yesterday, ignored
    ]);
    expect(r.done).toBe(5);
  });

  it('caps displayed percent at 100 even when the goal is exceeded', () => {
    const r = cardsToday([{ created_at: '2026-09-24T10:00:00.000Z', reviewed: 40 }], 20);
    expect(r.done).toBe(40);
    expect(r.pct).toBe(100);
    expect(r.met).toBe(true);
  });

  it('is not met when done is short of the goal', () => {
    const r = cardsToday([{ created_at: '2026-09-24T10:00:00.000Z', reviewed: 19 }], 20);
    expect(r.met).toBe(false);
    expect(r.pct).toBe(95);
  });

  it('handles a custom goal', () => {
    const r = cardsToday([{ created_at: '2026-09-24T10:00:00.000Z', reviewed: 5 }], 10);
    expect(r.pct).toBe(50);
  });
});

describe('evaluateAchievements', () => {
  it('returns every achievement, unlocked flag false when stats are empty', () => {
    const out = evaluateAchievements({});
    expect(out).toHaveLength(ACHIEVEMENTS.length);
    expect(out.every((a) => a.unlocked === false)).toBe(true);
  });

  it('unlocks only the achievements whose thresholds are met', () => {
    const out = evaluateAchievements({ decks: 1, sessions: 1, reviewed: 50, streak: 3 });
    const unlocked = out.filter((a) => a.unlocked).map((a) => a.id);
    expect(unlocked.sort()).toEqual(
      ['first-deck', 'first-session', 'cards-50', 'streak-3'].sort()
    );
  });

  it('unlocks a boolean-flag achievement (perfectQuiz) only when true', () => {
    expect(evaluateAchievements({ perfectQuiz: true }).find((a) => a.id === 'perfect-quiz').unlocked).toBe(true);
    expect(evaluateAchievements({ perfectQuiz: false }).find((a) => a.id === 'perfect-quiz').unlocked).toBe(false);
    expect(evaluateAchievements({}).find((a) => a.id === 'perfect-quiz').unlocked).toBe(false);
  });

  it('unlocks everything when every threshold is comfortably exceeded', () => {
    const out = evaluateAchievements({
      decks: 999, sessions: 999, reviewed: 999999, streak: 999,
      perfectQuiz: true, quizzes: 999, level: 999,
    });
    expect(out.every((a) => a.unlocked)).toBe(true);
  });

  it('does not mutate the shared ACHIEVEMENTS definitions', () => {
    evaluateAchievements({ decks: 5 });
    expect(ACHIEVEMENTS.find((a) => a.id === 'decks-5').unlocked).toBeUndefined();
  });
});
