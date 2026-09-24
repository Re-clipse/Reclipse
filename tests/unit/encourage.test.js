import { describe, it, expect } from 'vitest';
import { encourage } from '@/lib/encourage';

describe('encourage', () => {
  it('returns a non-empty string for every known key', () => {
    for (const key of ['sessionDone', 'perfectQuiz', 'goodQuiz', 'toughQuiz', 'streak', 'welcomeBack']) {
      expect(typeof encourage(key)).toBe('string');
      expect(encourage(key).length).toBeGreaterThan(0);
    }
  });

  it('falls back to welcomeBack lines for an unknown key', () => {
    const fallback = encourage('not-a-real-key', 0);
    expect(['Ready when you are.', 'Let’s make this session count.', 'Pick a deck and let’s go.']).toContain(fallback);
  });

  it('is deterministic for the same key and seed', () => {
    expect(encourage('sessionDone', 3)).toBe(encourage('sessionDone', 3));
  });

  it('varies with the seed (not always the same line)', () => {
    const lines = new Set([0, 1, 2, 3].map((seed) => encourage('sessionDone', seed)));
    expect(lines.size).toBeGreaterThan(1);
  });

  it('handles a negative seed without throwing, and stays in range', () => {
    expect(() => encourage('streak', -1)).not.toThrow();
    expect(typeof encourage('streak', -1)).toBe('string');
  });

  it('defaults the seed to 0 when omitted', () => {
    expect(encourage('goodQuiz')).toBe(encourage('goodQuiz', 0));
  });
});
