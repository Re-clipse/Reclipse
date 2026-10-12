'use client';

import { useMemo, useState } from 'react';

// "Try it with your own notes": turns one sentence into a fill-in-the-blank
// card, live, in the browser. It's a simple heuristic (no AI call, no cost),
// and the copy says so; the real generator reads the whole upload.
const EXAMPLES = [
  { label: 'Biology', text: 'Photosynthesis converts light energy into chemical energy stored in glucose.' },
  { label: 'Economics', text: 'Opportunity cost is the value of the next best alternative you give up.' },
  { label: 'History', text: 'The Treaty of Versailles formally ended the First World War in 1919.' },
];

const STOP = new Set(('the a an and or but of to in on at by for from with into onto over under about as is are was were be been being ' +
  'this that these those it its their there which who whom whose what when where why how than then so such can could would should ' +
  'will may might must do does did done have has had not no yes also more most less very just only your you they them our we ' +
  'value next best give stored formally ended').split(' '));

function makeCard(text) {
  const sentence = (text || '').trim().split(/(?<=[.!?])\s+/)[0] || '';
  const words = sentence.match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9'’-]*/g) || [];
  if (words.length < 4) return null;
  let best = null;
  words.forEach((w, i) => {
    const bare = w.toLowerCase();
    if (STOP.has(bare) || w.length < 4) return;
    let score = w.length;
    if (/^\d{3,4}$/.test(w)) score += 8;                 // years and figures make good blanks
    if (i > 0 && /^[A-Z]/.test(w)) score += 5;          // proper nouns mid-sentence
    if (i === 0) score -= 10;                           // first word is rarely the point
    score += (i / words.length) * 4;                    // the answer usually comes late in the sentence
    if (!best || score > best.score) best = { w, score };
  });
  if (!best) return null;
  const q = sentence.replace(best.w, '_____');
  return { q, a: best.w.replace(/[.,;:]$/, '') };
}

export default function ClozeTry() {
  const [text, setText] = useState(EXAMPLES[0].text);
  const [shown, setShown] = useState(false);
  const card = useMemo(() => makeCard(text), [text]);

  return (
    <div className="try2">
      <div className="try2__input">
        <label htmlFor="try2-text" className="try2__label">Paste one line from your notes</label>
        <textarea id="try2-text" className="try2__text" rows={4} value={text} spellCheck={false}
                  onChange={(e) => { setText(e.target.value); setShown(false); }} />
        <div className="try2__chips" aria-label="Examples">
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button"
                    className={`try2__chip${text === ex.text ? ' is-on' : ''}`}
                    onClick={() => { setText(ex.text); setShown(false); }}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="try2__out">
        <span className="try2__arrow" aria-hidden="true">becomes</span>
        <button type="button" className={`try2__card${shown ? ' is-shown' : ''}`} onClick={() => setShown((s) => !s)}
                disabled={!card} aria-live="polite">
          <span className="try2__tag">Fill in the blank</span>
          <span className="try2__q">{card ? card.q : 'Type a full sentence and a card appears here.'}</span>
          {card && (
            <span className="try2__a">
              {shown ? <>Answer: <b>{card.a}</b></> : 'Tap to check your answer'}
            </span>
          )}
        </button>
        <p className="try2__fine">
          This preview is a quick trick that runs in your browser. The real thing reads your whole
          upload and writes up to 30 cards plus a quiz.
        </p>
      </div>
    </div>
  );
}
