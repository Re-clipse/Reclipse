// Context-aware encouragement from Luna. Positive and varied — never guilt or
// pressure. Picks a line deterministically-ish from the context so it feels
// intentional, with a little rotation.

const LINES = {
  sessionDone: [
    'That\u2019s how it sticks. Retrieval beats rereading every time.',
    'Every card you recalled just got a little more permanent.',
    'Future-you, sitting the exam, says thanks.',
    'Short and consistent wins. Nicely done.',
  ],
  perfectQuiz: [
    'Flawless. You clearly know this cold.',
    'Perfect run — that\u2019s exam-ready.',
    'Not a single miss. Luna is impressed.',
  ],
  goodQuiz: [
    'Solid work. Review the misses and you\u2019ve got it.',
    'Strong pass. The gaps are small and fixable.',
  ],
  toughQuiz: [
    'Now you know exactly what to focus on. That\u2019s the whole point.',
    'Every miss is a card worth another look. You\u2019ve got this.',
  ],
  streak: [
    'day streak. Momentum is the secret ingredient.',
    'days in a row. This is what real progress looks like.',
  ],
  welcomeBack: [
    'Ready when you are.',
    'Let\u2019s make this session count.',
    'Pick a deck and let\u2019s go.',
  ],
};

export function encourage(key, seed = 0) {
  const list = LINES[key] || LINES.welcomeBack;
  return list[Math.abs(seed) % list.length];
}
