import { describe, it, expect } from 'vitest';
import {
  extractJson,
  shuffled,
  normalizeGeneration,
  parseGeneration,
  MAX_FLASHCARDS,
  MAX_QUIZ_QUESTIONS,
} from '@/lib/generation';

describe('extractJson', () => {
  it('parses a clean JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences and surrounding prose', () => {
    const raw = 'Sure, here you go:\n```json\n{"a":1,"b":[1,2]}\n```\nHope that helps!';
    expect(extractJson(raw)).toEqual({ a: 1, b: [1, 2] });
  });

  it('finds the object even with leading/trailing whitespace', () => {
    expect(extractJson('   \n{"a":1}\n   ')).toEqual({ a: 1 });
  });

  it('throws when there is no JSON object at all', () => {
    expect(() => extractJson('no json here')).toThrow('no JSON object in reply');
  });

  it('throws on empty/null/undefined input', () => {
    expect(() => extractJson('')).toThrow();
    expect(() => extractJson(null)).toThrow();
    expect(() => extractJson(undefined)).toThrow();
  });

  it('throws on malformed JSON between the braces', () => {
    expect(() => extractJson('{"a": }')).toThrow();
  });

  it('uses the first "{" and last "}", tolerating nested braces', () => {
    const raw = 'prefix {"a": {"nested": true}} suffix';
    expect(extractJson(raw)).toEqual({ a: { nested: true } });
  });
});

describe('shuffled', () => {
  it('returns a new array, never mutating the input', () => {
    const input = [1, 2, 3, 4];
    const copy = [...input];
    shuffled(input, () => 0);
    expect(input).toEqual(copy);
  });

  it('preserves the same elements (a permutation, not a subset)', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input, Math.random);
    expect(out.slice().sort()).toEqual(input.slice().sort());
    expect(out).toHaveLength(input.length);
  });

  it('is deterministic given an injected rng', () => {
    const rng = () => 0; // always picks index 0 -> effectively reverses via Fisher-Yates with j=0
    const a = shuffled([1, 2, 3, 4], rng);
    const b = shuffled([1, 2, 3, 4], rng);
    expect(a).toEqual(b);
  });

  it('handles an empty array', () => {
    expect(shuffled([], Math.random)).toEqual([]);
  });

  it('handles a single-element array', () => {
    expect(shuffled([42], Math.random)).toEqual([42]);
  });
});

describe('normalizeGeneration', () => {
  it('returns empty structures for garbage/missing input', () => {
    expect(normalizeGeneration({})).toEqual({ summary: '', flashcards: [], quiz: [] });
    expect(normalizeGeneration(null)).toEqual({ summary: '', flashcards: [], quiz: [] });
    expect(normalizeGeneration(undefined)).toEqual({ summary: '', flashcards: [], quiz: [] });
  });

  it('keeps a well-formed basic flashcard', () => {
    const out = normalizeGeneration({
      flashcards: [{ question: 'What is 2+2?', answer: 'Four' }],
    });
    expect(out.flashcards).toEqual([{ question: 'What is 2+2?', answer: 'Four', type: 'basic' }]);
  });

  it('drops flashcards missing a question or answer', () => {
    const out = normalizeGeneration({
      flashcards: [{ question: '', answer: 'x' }, { question: 'x', answer: '' }, { question: '  ', answer: '  ' }],
    });
    expect(out.flashcards).toEqual([]);
  });

  it('trims whitespace on questions and answers', () => {
    const out = normalizeGeneration({ flashcards: [{ question: '  Q  ', answer: '  A  ' }] });
    expect(out.flashcards[0]).toMatchObject({ question: 'Q', answer: 'A' });
  });

  it('only keeps type "cloze" when the question actually has a blank', () => {
    const withBlank = normalizeGeneration({
      flashcards: [{ question: 'The capital is _____.', answer: 'Paris', type: 'cloze' }],
    });
    expect(withBlank.flashcards[0].type).toBe('cloze');

    const withoutBlank = normalizeGeneration({
      flashcards: [{ question: 'What is the capital?', answer: 'Paris', type: 'cloze' }],
    });
    expect(withoutBlank.flashcards[0].type).toBe('basic');
  });

  it('drops flashcards whose question references "the notes"/"the lecture" (needs external context)', () => {
    const out = normalizeGeneration({
      flashcards: [
        { question: 'According to the text, what is mitosis?', answer: 'Cell division' },
        { question: 'As mentioned above, what happened?', answer: 'Something' },
        { question: 'What is mitosis in a standalone question?', answer: 'Cell division process' },
      ],
    });
    expect(out.flashcards).toHaveLength(1);
    expect(out.flashcards[0].question).toBe('What is mitosis in a standalone question?');
  });

  it('drops a basic card whose short answer is simply repeated in the question (answer given away)', () => {
    const out = normalizeGeneration({
      flashcards: [{ question: 'The powerhouse of the cell is the mitochondria, right?', answer: 'mitochondria' }],
    });
    expect(out.flashcards).toHaveLength(0);
  });

  it('keeps a card whose long answer happens to share words with the question (only short give-aways are dropped)', () => {
    const out = normalizeGeneration({
      flashcards: [{
        question: 'Why does the mitochondria matter for energy production in a cell?',
        answer: 'It is the primary site of ATP synthesis via oxidative phosphorylation, powering nearly all cellular work',
      }],
    });
    expect(out.flashcards).toHaveLength(1);
  });

  it('deduplicates flashcards with the same question, ignoring case/punctuation', () => {
    const out = normalizeGeneration({
      flashcards: [
        { question: 'What is DNA?', answer: 'Genetic material' },
        { question: 'what is dna???', answer: 'Genetic material, again' },
      ],
    });
    expect(out.flashcards).toHaveLength(1);
  });

  it('caps flashcards at MAX_FLASHCARDS', () => {
    const many = Array.from({ length: MAX_FLASHCARDS + 20 }, (_, i) => ({
      question: `Unique testable question number ${i} about topic ${i}?`,
      answer: `Answer ${i}`,
    }));
    const out = normalizeGeneration({ flashcards: many });
    expect(out.flashcards).toHaveLength(MAX_FLASHCARDS);
  });

  it('handles flashcards not being an array at all', () => {
    expect(normalizeGeneration({ flashcards: 'nope' }).flashcards).toEqual([]);
    expect(normalizeGeneration({ flashcards: { a: 1 } }).flashcards).toEqual([]);
  });

  it('keeps a well-formed quiz question with exactly 4 options', () => {
    const out = normalizeGeneration({
      quiz: [{ question: 'Q?', options: ['a', 'b', 'c', 'd'], correctIndex: 1, explanation: 'because' }],
    }, { rng: () => 0 });
    expect(out.quiz).toHaveLength(1);
    expect(out.quiz[0].options).toHaveLength(4);
    expect(out.quiz[0].options[out.quiz[0].correctIndex]).toBe('b');
  });

  it('drops quiz questions without exactly 4 options', () => {
    const out = normalizeGeneration({
      quiz: [
        { question: 'Q1', options: ['a', 'b', 'c'], correctIndex: 0 },
        { question: 'Q2', options: ['a', 'b', 'c', 'd', 'e'], correctIndex: 0 },
      ],
    });
    expect(out.quiz).toHaveLength(0);
  });

  it('drops quiz questions with an empty option or an out-of-range correctIndex', () => {
    const out = normalizeGeneration({
      quiz: [
        { question: 'Q1', options: ['a', '', 'c', 'd'], correctIndex: 0 },
        { question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndex: 4 },
        { question: 'Q3', options: ['a', 'b', 'c', 'd'], correctIndex: -1 },
      ],
    });
    expect(out.quiz).toHaveLength(0);
  });

  it('coerces a non-integer correctIndex to -1 (and drops the question)', () => {
    const out = normalizeGeneration({
      quiz: [{ question: 'Q', options: ['a', 'b', 'c', 'd'], correctIndex: 'two' }],
    });
    expect(out.quiz).toHaveLength(0);
  });

  it('preserves the correct answer\'s text through the option shuffle', () => {
    // With a fixed rng, the shuffle is deterministic; regardless of the
    // resulting order, correctIndex must still point at the original
    // correct option's text.
    const out = normalizeGeneration({
      quiz: [{ question: 'Q', options: ['wrong1', 'RIGHT', 'wrong2', 'wrong3'], correctIndex: 1 }],
    }, { rng: () => 0.999 });
    expect(out.quiz[0].options[out.quiz[0].correctIndex]).toBe('RIGHT');
    expect(out.quiz[0].options.slice().sort()).toEqual(['RIGHT', 'wrong1', 'wrong2', 'wrong3'].sort());
  });

  it('caps quiz questions at MAX_QUIZ_QUESTIONS', () => {
    const many = Array.from({ length: MAX_QUIZ_QUESTIONS + 5 }, (_, i) => ({
      question: `Q${i}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0,
    }));
    const out = normalizeGeneration({ quiz: many });
    expect(out.quiz).toHaveLength(MAX_QUIZ_QUESTIONS);
  });

  it('truncates an overly long summary to 2000 characters', () => {
    const out = normalizeGeneration({ summary: 'x'.repeat(3000) });
    expect(out.summary).toHaveLength(2000);
  });

  it('coerces a non-string summary to an empty string', () => {
    expect(normalizeGeneration({ summary: 12345 }).summary).toBe('');
    expect(normalizeGeneration({ summary: null }).summary).toBe('');
  });
});

describe('parseGeneration (raw text -> normalized study set)', () => {
  it('parses a full, realistic model reply end to end', () => {
    const raw = `Here is the study set:
\`\`\`json
{
  "summary": "- Point one\\n- Point two",
  "flashcards": [
    {"question": "What triggers proactive interference?", "answer": "Old learning disrupting new learning", "type": "basic"}
  ],
  "quiz": [
    {"question": "Which best describes proactive interference?", "options": ["A","B","C","D"], "correctIndex": 2, "explanation": "because"}
  ]
}
\`\`\``;
    const out = parseGeneration(raw, { rng: () => 0 });
    expect(out.summary).toContain('Point one');
    expect(out.flashcards).toHaveLength(1);
    expect(out.quiz).toHaveLength(1);
  });

  it('throws (rather than silently returning junk) when the reply has no JSON', () => {
    expect(() => parseGeneration('sorry, I cannot help with that')).toThrow();
  });
});
