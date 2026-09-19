import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJSON, normalizeStudyMaterial } from '../lib/studyMaterial.mjs';

const card = { question: ' Why? ', answer: ' Because. ', type: 'cloze' };
const quiz = { question: 'Pick one', options: ['a','b','c','d'], correctIndex: 1, explanation: 'b is correct' };
test('model output is normalized and bounded before it reaches the database', () => {
  const result = normalizeStudyMaterial({ summary: 's'.repeat(3000), flashcards: Array(20).fill(card), quiz: Array(12).fill(quiz) });
  assert.equal(result.summary.length, 2000);
  assert.equal(result.flashcards.length, 14);
  assert.equal(result.quiz.length, 8);
  assert.equal(result.flashcards[0].question, 'Why?');
  assert.equal(result.flashcards[0].type, 'cloze');
});
for (const invalid of [null, {}, { flashcards: [], quiz: [] },
  { flashcards: [null], quiz: [] }, { flashcards: [{ ...card, answer: '' }], quiz: [] },
  { flashcards: [card], quiz: [{ ...quiz, correctIndex: 4 }] },
  { flashcards: [card], quiz: [{ ...quiz, correctIndex: '1' }] },
  { flashcards: [card], quiz: [{ ...quiz, options: ['a','b'] }] },
  { flashcards: [card], quiz: [{ ...quiz, options: ['a','b',null,'d'] }] },
]) {
  test(`reject malformed study material: ${JSON.stringify(invalid)}`, () => assert.throws(() => normalizeStudyMaterial(invalid)));
}
test('fenced model JSON is accepted and non-text blocks are ignored', () => {
  assert.deepEqual(parseModelJSON({ content: [{ type: 'thinking' }, { type: 'text', text: '```json\n{"events": []}\n```' }] }), { events: [] });
});
test('truncated model output is rejected even if a JSON fragment parses', () => {
  assert.throws(() => parseModelJSON({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{}' }] }));
});
