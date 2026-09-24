import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { streakFrom, activityByDay, pct } from '@/lib/stats';

// streakFrom/activityByDay both anchor "today" on `new Date()`, so every test
// pins the system clock to a fixed instant instead of depending on wall-clock
// time when the suite happens to run.
const NOW = new Date('2026-09-24T12:00:00.000Z'); // a Thursday, midday UTC

function isoDaysAgo(n, hour = '12:00:00.000') {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10) + `T${hour}Z`;
}

describe('streakFrom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for empty input', () => {
    expect(streakFrom([])).toBe(0);
  });

  it('returns 0 for null/undefined input', () => {
    expect(streakFrom(null)).toBe(0);
    expect(streakFrom(undefined)).toBe(0);
  });

  it('returns 0 when the most recent session is neither today nor yesterday', () => {
    expect(streakFrom([isoDaysAgo(2)])).toBe(0);
  });

  it('counts a single session today as a 1-day streak', () => {
    expect(streakFrom([isoDaysAgo(0)])).toBe(1);
  });

  it('keeps the streak alive off a session yesterday, even with none today', () => {
    expect(streakFrom([isoDaysAgo(1)])).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(streakFrom([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(2)])).toBe(3);
  });

  it('counts consecutive days ending yesterday (nothing logged yet today)', () => {
    expect(streakFrom([isoDaysAgo(1), isoDaysAgo(2), isoDaysAgo(3)])).toBe(3);
  });

  it('stops at the first gap', () => {
    // today, yesterday, then a gap at day 2, then day 3 — streak should be 2
    expect(streakFrom([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(3)])).toBe(2);
  });

  it('collapses multiple sessions on the same day to one day of streak', () => {
    const sameDayMorning = isoDaysAgo(0, '00:05:00.000');
    const sameDayNight = isoDaysAgo(0, '23:55:00.000');
    expect(streakFrom([sameDayMorning, sameDayNight, isoDaysAgo(1)])).toBe(2);
  });

  it('ignores unrelated far-future/past noise once the streak breaks', () => {
    expect(streakFrom([isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(10)])).toBe(2);
  });

  it('handles a long unbroken streak', () => {
    const dates = Array.from({ length: 30 }, (_, i) => isoDaysAgo(i));
    expect(streakFrom(dates)).toBe(30);
  });

  describe('day-boundary / timezone characterization', () => {
    // streakFrom normalizes every timestamp (including "today") through
    // `.toISOString().slice(0,10)`, i.e. the UTC calendar day — regardless
    // of the host process's local timezone. These tests pin TZ explicitly
    // so a future change to local-time bucketing doesn't silently flip a
    // student's streak depending on where the server runs.
    const realTZ = process.env.TZ;
    afterEach(() => {
      process.env.TZ = realTZ;
    });

    it('a session just before UTC midnight still counts as "today" in a UTC+ timezone', () => {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
      // 23:59 UTC today is still the same UTC calendar day.
      const lateUtc = NOW.toISOString().slice(0, 10) + 'T23:59:00.000Z';
      expect(streakFrom([lateUtc])).toBe(1);
    });

    it('a session just after UTC midnight the next day does NOT count as "today"', () => {
      process.env.TZ = 'America/New_York'; // UTC-4/UTC-5
      const nextUtcDay = new Date(NOW);
      nextUtcDay.setUTCDate(nextUtcDay.getUTCDate() + 1);
      const justAfterMidnightUtc = nextUtcDay.toISOString().slice(0, 10) + 'T00:01:00.000Z';
      // From "today"'s perspective this timestamp is tomorrow, so it should
      // not be found under today's or yesterday's key.
      expect(streakFrom([justAfterMidnightUtc])).toBe(0);
    });
  });
});

describe('activityByDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to a 28-day window ending today, all zero for no sessions', () => {
    const out = activityByDay([]);
    expect(out).toHaveLength(28);
    expect(out.every((d) => d.count === 0)).toBe(true);
    expect(out[out.length - 1].date).toBe(NOW.toISOString().slice(0, 10));
    expect(out[0].date).toBe(isoDaysAgo(27).slice(0, 10));
  });

  it('respects a custom window size', () => {
    const out = activityByDay([], 7);
    expect(out).toHaveLength(7);
  });

  it('places sessions on their correct day and aggregates same-day counts', () => {
    const out = activityByDay(
      [isoDaysAgo(0), isoDaysAgo(0), isoDaysAgo(1), isoDaysAgo(5)],
      7
    );
    const byDate = Object.fromEntries(out.map((d) => [d.date, d.count]));
    expect(byDate[isoDaysAgo(0).slice(0, 10)]).toBe(2);
    expect(byDate[isoDaysAgo(1).slice(0, 10)]).toBe(1);
    expect(byDate[isoDaysAgo(5).slice(0, 10)]).toBe(1);
    expect(byDate[isoDaysAgo(2).slice(0, 10)]).toBe(0);
  });

  it('drops sessions that fall outside the requested window', () => {
    const out = activityByDay([isoDaysAgo(10)], 5);
    expect(out.every((d) => d.count === 0)).toBe(true);
  });

  it('handles an empty/undefined dates argument without throwing', () => {
    expect(() => activityByDay(undefined, 3)).not.toThrow();
    expect(activityByDay(undefined, 3)).toHaveLength(3);
  });
});

describe('pct', () => {
  it('returns 0 when the denominator is 0 (avoids NaN/Infinity)', () => {
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
  });

  it('computes a rounded percentage', () => {
    expect(pct(1, 2)).toBe(50);
    expect(pct(0, 5)).toBe(0);
    expect(pct(5, 5)).toBe(100);
  });

  it('rounds to the nearest integer (banker-free rounding via Math.round)', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
  });

  it('handles a numerator greater than the denominator', () => {
    expect(pct(10, 5)).toBe(200);
  });
});
