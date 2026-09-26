import { describe, it, expect, vi, afterEach } from 'vitest';
import { nextOccurrenceOnOrAfter, upcomingLabOccurrences, shouldSendLabReminder } from '@/lib/labSchedule';
import { localToday } from '@/lib/dates';

describe('nextOccurrenceOnOrAfter', () => {
  it('returns the same date when it already falls on the target weekday', () => {
    // 2026-03-02 is a Monday.
    expect(nextOccurrenceOnOrAfter(1, '2026-03-02')).toBe('2026-03-02');
  });

  it('rolls forward to the next matching weekday', () => {
    // 2026-03-02 is a Monday; next Wednesday (3) is the 4th.
    expect(nextOccurrenceOnOrAfter(3, '2026-03-02')).toBe('2026-03-04');
  });

  it('wraps into the following week when the weekday already passed', () => {
    // 2026-03-06 is a Friday; next Monday (1) is the 9th.
    expect(nextOccurrenceOnOrAfter(1, '2026-03-06')).toBe('2026-03-09');
  });
});

describe('upcomingLabOccurrences', () => {
  it('lists weekly occurrences bounded by ends_on', () => {
    const lab = { weekday: 2, ends_on: '2026-03-24' }; // Tuesdays
    const dates = upcomingLabOccurrences(lab, { from: '2026-03-02' }); // Monday
    expect(dates).toEqual(['2026-03-03', '2026-03-10', '2026-03-17', '2026-03-24']);
  });

  it('respects the limit', () => {
    const lab = { weekday: 2, ends_on: '2026-12-31' };
    expect(upcomingLabOccurrences(lab, { from: '2026-03-02', limit: 2 })).toHaveLength(2);
  });

  it('returns nothing once the term has already ended', () => {
    const lab = { weekday: 2, ends_on: '2026-02-01' };
    expect(upcomingLabOccurrences(lab, { from: '2026-03-02' })).toEqual([]);
  });
});

describe('shouldSendLabReminder', () => {
  const baseLab = { weekday: 2, ends_on: '2026-03-24', active: true, last_reminder_sent_on: null }; // Tuesdays

  it('sends the day before the next occurrence', () => {
    // Monday 2026-03-02 -> next Tuesday is 2026-03-03, exactly 1 day out.
    const result = shouldSendLabReminder(baseLab, '2026-03-02');
    expect(result).toEqual({ send: true, occurrenceDate: '2026-03-03' });
  });

  it('does not send when it is not exactly the day before', () => {
    // Sunday 2026-03-01 -> next Tuesday is 2 days out.
    expect(shouldSendLabReminder(baseLab, '2026-03-01').send).toBe(false);
  });

  it('does not send twice for the same occurrence', () => {
    const alreadySent = { ...baseLab, last_reminder_sent_on: '2026-03-03' };
    expect(shouldSendLabReminder(alreadySent, '2026-03-02').send).toBe(false);
  });

  it('does not send once the term has ended', () => {
    const ended = { ...baseLab, ends_on: '2026-02-24' };
    expect(shouldSendLabReminder(ended, '2026-03-02').send).toBe(false);
  });

  it('does not send for a paused (inactive) lab', () => {
    const paused = { ...baseLab, active: false };
    expect(shouldSendLabReminder(paused, '2026-03-02').send).toBe(false);
  });

  it('sends correctly for a non-UTC timezone, from a fixed clock', () => {
    // Fixed instant: 2026-03-03T05:00:00Z (5am UTC). In America/Los_Angeles
    // (UTC-8 in March, before DST) that's still 2026-03-02, 9pm local — a
    // full calendar day behind UTC's date, which is exactly the case that
    // breaks naive server-UTC date comparisons.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T05:00:00Z'));
    try {
      const { date: localDate } = localToday('America/Los_Angeles');
      expect(localDate).toBe('2026-03-02'); // confirms the timezone gap is real, not assumed
      const result = shouldSendLabReminder(baseLab, localDate);
      expect(result).toEqual({ send: true, occurrenceDate: '2026-03-03' });
    } finally {
      vi.useRealTimers();
    }
  });
});

afterEach(() => { vi.useRealTimers(); });
