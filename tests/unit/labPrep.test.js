import { describe, it, expect } from 'vitest';
import {
  MAX_SOURCE_CHARS, MAX_TURNS,
  truncateSource, sanitizeText, buildDeckSourceText, isPremiumUser, validateConversation, turnWithinMonthlyLimit,
} from '@/lib/labPrep';

describe('sanitizeText', () => {
  it('leaves normal text untouched', () => {
    expect(sanitizeText('Given a = 1, find b.')).toBe('Given a = 1, find b.');
  });

  it('keeps newlines and tabs', () => {
    expect(sanitizeText('line one\n\tline two')).toBe('line one\n\tline two');
  });

  it('strips control characters', () => {
    expect(sanitizeText('a\u0000b\u001Fc\u007Fd')).toBe('abcd');
  });

  it('strips an unpaired high surrogate', () => {
    expect(sanitizeText('before\uD800after')).toBe('beforeafter');
  });

  it('strips an unpaired low surrogate but keeps the preceding character', () => {
    expect(sanitizeText('before\uDC00after')).toBe('beforeafter');
  });

  it('keeps a properly paired surrogate (a real emoji)', () => {
    expect(sanitizeText('math 🔬 lab')).toBe('math 🔬 lab');
  });

  it('handles a lone low surrogate as the very first character', () => {
    expect(sanitizeText('\uDC00rest')).toBe('rest');
  });
});

describe('truncateSource', () => {
  it('leaves short text untouched', () => {
    expect(truncateSource('hello world')).toEqual({ text: 'hello world', truncated: false });
  });

  it('caps to the character budget and flags truncation', () => {
    const long = 'x'.repeat(MAX_SOURCE_CHARS + 500);
    const { text, truncated } = truncateSource(long);
    expect(text).toHaveLength(MAX_SOURCE_CHARS);
    expect(truncated).toBe(true);
  });

  it('trims whitespace before measuring', () => {
    expect(truncateSource('  padded  ')).toEqual({ text: 'padded', truncated: false });
  });

  it('strips unpaired surrogates before measuring', () => {
    expect(truncateSource('math\uD800problem')).toEqual({ text: 'mathproblem', truncated: false });
  });
});

describe('buildDeckSourceText', () => {
  it('joins the deck title and Q/A pairs', () => {
    const deck = { title: 'BI110 Cell Biology' };
    const cards = [{ question: 'What is mitosis?', answer: 'Cell division.' }];
    expect(buildDeckSourceText(deck, cards)).toBe(
      'BI110 Cell Biology\n\nQ: What is mitosis?\nA: Cell division.'
    );
  });

  it('falls back to a placeholder title', () => {
    expect(buildDeckSourceText(null, [])).toBe('Untitled deck\n');
  });
});

describe('isPremiumUser', () => {
  it('is true during the launch trial regardless of subscription state', () => {
    expect(isPremiumUser({ trialActive: true, hasPremiumAccess: false })).toBe(true);
  });
  it('is true with a real subscription once the trial has ended', () => {
    expect(isPremiumUser({ trialActive: false, hasPremiumAccess: true })).toBe(true);
  });
  it('is false with neither', () => {
    expect(isPremiumUser({ trialActive: false, hasPremiumAccess: false })).toBe(false);
  });
});

describe('validateConversation', () => {
  it('rejects an empty conversation', () => {
    expect(validateConversation([]).ok).toBe(false);
    expect(validateConversation(null).ok).toBe(false);
  });

  it('accepts a single opening user message', () => {
    expect(validateConversation([{ role: 'user', content: 'go' }]).ok).toBe(true);
  });

  it('accepts a properly alternating conversation ending on user', () => {
    const messages = [
      { role: 'user', content: 'go' },
      { role: 'assistant', content: 'here are some problems' },
      { role: 'user', content: 'give me a hint' },
    ];
    expect(validateConversation(messages).ok).toBe(true);
  });

  it('rejects a conversation that does not end on user', () => {
    const messages = [
      { role: 'user', content: 'go' },
      { role: 'assistant', content: 'here are some problems' },
    ];
    expect(validateConversation(messages).ok).toBe(false);
  });

  it('rejects out-of-order roles', () => {
    const messages = [
      { role: 'assistant', content: 'go' },
      { role: 'user', content: 'ok' },
    ];
    expect(validateConversation(messages).ok).toBe(false);
  });

  it('rejects a blank message', () => {
    expect(validateConversation([{ role: 'user', content: '   ' }]).ok).toBe(false);
  });

  it('rejects a conversation past MAX_TURNS exchanges', () => {
    const messages = [];
    for (let i = 0; i < MAX_TURNS + 1; i++) {
      messages.push({ role: 'user', content: `q${i}` }, { role: 'assistant', content: `a${i}` });
    }
    expect(validateConversation(messages).ok).toBe(false);
  });

  it('accepts a conversation at exactly MAX_TURNS exchanges', () => {
    const messages = [];
    for (let i = 0; i < MAX_TURNS - 1; i++) {
      messages.push({ role: 'user', content: `q${i}` }, { role: 'assistant', content: `a${i}` });
    }
    messages.push({ role: 'user', content: 'last one' });
    expect(validateConversation(messages).ok).toBe(true);
  });
});

describe('turnWithinMonthlyLimit', () => {
  it('allows a turn below the limit', () => {
    expect(turnWithinMonthlyLimit(5, 60)).toBe(true);
  });
  it('blocks a turn once the limit is reached', () => {
    expect(turnWithinMonthlyLimit(60, 60)).toBe(false);
  });
  it('blocks a turn past the limit', () => {
    expect(turnWithinMonthlyLimit(61, 60)).toBe(false);
  });
  it('treats a missing count as zero', () => {
    expect(turnWithinMonthlyLimit(undefined, 60)).toBe(true);
  });
});
