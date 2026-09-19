function text(value, max, allowEmpty = false) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) throw new Error('Invalid study text');
  return value.trim().slice(0, max);
}

export function parseModelJSON(response) {
  if (response.stop_reason === 'max_tokens') throw new Error('Incomplete AI response');
  const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

export function normalizeStudyMaterial(value) {
  if (!value || !Array.isArray(value.flashcards) || !value.flashcards.length || !Array.isArray(value.quiz)) {
    throw new Error('Invalid study set');
  }
  return {
    summary: text(value.summary ?? '', 2000, true),
    flashcards: value.flashcards.slice(0, 14).map(f => ({
      question: text(f?.question, 2000), answer: text(f?.answer, 4000),
      type: f.type === 'cloze' ? 'cloze' : 'basic',
    })),
    quiz: value.quiz.slice(0, 8).map(q => {
      if (!Array.isArray(q?.options) || q.options.length !== 4 ||
        !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
        throw new Error('Invalid quiz question');
      }
      return {
        question: text(q.question, 2000), options: q.options.map(o => text(o, 1000)),
        correctIndex: q.correctIndex, explanation: text(q.explanation ?? '', 2000, true),
      };
    }),
  };
}
