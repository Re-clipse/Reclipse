import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { schedule, previewInterval } from '@/lib/srs';

const NOW = new Date('2026-09-24T12:00:00.000Z');

describe('schedule (SM-2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a brand-new card at ease 2.5 / 0 reps when prev is null/undefined', () => {
    const r = schedule(undefined, 2);
    expect(r.reps).toBe(1);
    expect(r.interval_days).toBe(1);
    expect(r.lapses).toBe(0);
  });

  it('first "good" rating sets interval to 1 day', () => {
    const r = schedule(null, 2);
    expect(r.interval_days).toBe(1);
    const due = new Date(r.due_at);
    expect(due.toISOString().slice(0, 10)).toBe('2026-09-25');
  });

  it('second consecutive "good" rating sets interval to 6 days', () => {
    let card = schedule(null, 2);
    card = schedule(card, 2);
    expect(card.reps).toBe(2);
    expect(card.interval_days).toBe(6);
  });

  it('third+ "good" rating multiplies the previous interval by ease', () => {
    let card = schedule(null, 2); // reps 1, interval 1
    card = schedule(card, 2);      // reps 2, interval 6
    const easeBefore = card.ease;
    card = schedule(card, 2);      // reps 3, interval = round(6 * ease)
    expect(card.reps).toBe(3);
    expect(card.interval_days).toBe(Math.round(6 * easeBefore));
  });

  it('an "easy" rating (3) applies an extra 1.3x boost on top of the normal interval', () => {
    let good = schedule(null, 2);
    good = schedule(good, 2); // now at reps 2, interval 6, to get to the 3rd-rep multiply branch
    const easyFromSameState = schedule(schedule(null, 2), 3);
    // Compare the "easy" second review against the "good" second review at the same prior state.
    const goodSecond = schedule(schedule(null, 2), 2);
    expect(easyFromSameState.interval_days).toBeGreaterThan(goodSecond.interval_days);
  });

  it('rating below 2 ("hard"/"blackout") is a lapse: resets reps and interval, lowers ease', () => {
    let card = schedule(null, 2);
    card = schedule(card, 2); // reps 2
    const easeBefore = card.ease;
    const lapsesBefore = card.lapses;
    card = schedule(card, 0); // blackout
    expect(card.reps).toBe(0);
    expect(card.interval_days).toBe(0);
    expect(card.lapses).toBe(lapsesBefore + 1);
    expect(card.ease).toBeLessThan(easeBefore);
    expect(card.last_rating).toBe(0);
  });

  it('a lapse schedules the card to come back in ~10 minutes, not days', () => {
    const card = schedule(null, 0);
    const due = new Date(card.due_at);
    const diffMinutes = (due.getTime() - NOW.getTime()) / 60000;
    expect(diffMinutes).toBeCloseTo(10, 0);
  });

  it('ease never drops below the 1.3 floor even after repeated lapses', () => {
    let card = null;
    for (let i = 0; i < 20; i++) card = schedule(card, 0);
    expect(card.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('ease is rounded to 2 decimal places', () => {
    const card = schedule(null, 2);
    expect(card.ease).toBe(Number(card.ease.toFixed(2)));
  });

  it('a "hard" rating of exactly 1 is still treated as a lapse (interval resets)', () => {
    let card = schedule(null, 2);
    card = schedule(card, 2);
    card = schedule(card, 1);
    expect(card.reps).toBe(0);
    expect(card.interval_days).toBe(0);
  });

  it('due_at and updated_at are valid ISO timestamps', () => {
    const card = schedule(null, 2);
    expect(() => new Date(card.due_at).toISOString()).not.toThrow();
    expect(new Date(card.updated_at).toISOString().slice(0, 19)).toBe(NOW.toISOString().slice(0, 19));
  });
});

describe('previewInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows "<10m" for a lapse', () => {
    expect(previewInterval(null, 0)).toBe('<10m');
    expect(previewInterval(null, 1)).toBe('<10m');
  });

  it('shows "1d" for the first good review', () => {
    expect(previewInterval(null, 2)).toBe('1d');
  });

  it('shows days for intervals under a month', () => {
    const afterTwo = schedule(schedule(null, 2), 2); // interval 6
    expect(previewInterval(afterTwo, 2)).toMatch(/^\d+d$/);
  });

  it('formats growing intervals correctly at each bucket: days, then months, then years', () => {
    // Repeatedly answer "good" so the interval compounds by `ease` each time,
    // and check the returned preview's format against the *actual* interval
    // the scheduler produced — rather than guessing magic numbers, this
    // tracks the real day/month/year thresholds (30 / 365) as they're crossed.
    let card = null;
    const seenBuckets = new Set();
    for (let i = 0; i < 12; i++) {
      const next = schedule(card, 2);
      const preview = previewInterval(card, 2);
      if (next.interval_days < 1) {
        expect(preview).toBe('<10m');
        seenBuckets.add('sub-day');
      } else if (next.interval_days === 1) {
        expect(preview).toBe('1d');
        seenBuckets.add('day');
      } else if (next.interval_days < 30) {
        expect(preview).toBe(`${next.interval_days}d`);
        seenBuckets.add('days');
      } else if (next.interval_days < 365) {
        expect(preview).toBe(`${Math.round(next.interval_days / 30)}mo`);
        seenBuckets.add('months');
      } else {
        expect(preview).toBe(`${(next.interval_days / 365).toFixed(1)}y`);
        seenBuckets.add('years');
      }
      card = next;
    }
    // With ease starting at 2.5 and compounding, 12 "good" reviews in a row
    // should comfortably cross from days into months (and often years).
    expect(seenBuckets.has('day') || seenBuckets.has('days')).toBe(true);
    expect(seenBuckets.has('months') || seenBuckets.has('years')).toBe(true);
  });

  it('does not mutate the previous card object', () => {
    const prev = { ease: 2.5, interval_days: 6, reps: 2, lapses: 0 };
    const snapshot = { ...prev };
    previewInterval(prev, 2);
    expect(prev).toEqual(snapshot);
  });
});
