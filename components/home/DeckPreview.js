'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './motion';

/** A short visible label plus an accessible "About this demo" disclosure (click, touch or keyboard). */
export function DemoNote({ id, label = 'Interactive sample', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="dn">
      <span className="dn__label">{label}</span>
      <button type="button" className="dn__btn" aria-expanded={open} aria-controls={id}
              onClick={() => setOpen((o) => !o)} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
        About this demo
      </button>
      <p id={id} className="dn__panel" hidden={!open}>{children}</p>
    </div>
  );
}

// A small, working flashcard deck for the homepage examples. Everything lives
// in component state: nothing here is saved or touches anyone's study history.
// Unrevealed answers stay out of the accessibility tree.
//
// Next/previous: the current card lifts off and drops behind the stack while the
// next one comes forward. Touch: swipe sideways (vertical scrolling still works);
// a swipe never counts as a tap, so it can't reveal the answer. Keyboard: arrow keys.
export default function DeckPreview({ cards, subject, tone = 'tangerine', onIndex, idPrefix }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [leaving, setLeaving] = useState(null); // the card on its way to the back
  const front = useRef(null);
  const drag = useRef(null);
  const swallowClick = useRef(false);
  const leaveTimer = useRef(0);
  const n = cards.length;
  const card = cards[i];

  const refocus = useRef(false);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);
  // The front card is a new element after each move; keep keyboard focus on it.
  useEffect(() => { if (refocus.current) { refocus.current = false; front.current?.focus(); } }, [i]);

  function go(d) {
    const next = (i + d + n) % n;
    refocus.current = document.activeElement === front.current;
    if (!reduced) {
      clearTimeout(leaveTimer.current);
      setLeaving({ card, revealed, dir: d, id: Date.now() });
      leaveTimer.current = setTimeout(() => setLeaving(null), 640); // matches the CSS animation
    }
    setI(next); setRevealed(false); onIndex?.(next);
  }
  function flip() {
    if (swallowClick.current) { swallowClick.current = false; return; } // that was a swipe, not a tap
    setRevealed((r) => !r);
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse') return; // mouse users click; dragging is for touch and pen
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, horizontal: null };
  }
  function onPointerMove(e) {
    const g = drag.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.horizontal === null && Math.hypot(dx, dy) > 8) g.horizontal = Math.abs(dx) > Math.abs(dy);
    if (!g.horizontal) return; // vertical: let the page scroll
    g.dx = dx;
    front.current?.classList.add('is-dragging');
    front.current?.style.setProperty('--drag', `${Math.max(-120, Math.min(120, dx))}px`);
  }
  function endDrag(cancelled) {
    const g = drag.current;
    drag.current = null;
    front.current?.classList.remove('is-dragging');
    front.current?.style.removeProperty('--drag');
    if (!g?.horizontal) return;
    swallowClick.current = true;
    setTimeout(() => { swallowClick.current = false; }, 80);
    if (!cancelled && Math.abs(g.dx) > 50) go(g.dx < 0 ? 1 : -1);
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  }

  const face = (c, isRevealed) => (
    <>
      <span className="dp__face dp__face--front" aria-hidden="true">
        <span className={`dp__tab dp__tab--${tone}`}>{subject}</span>
        <span className="dp__k">{c.type === 'cloze' ? 'Fill the blank' : 'Question'}</span>
        <span className="dp__q">{c.question}</span>
        <span className="dp__hint">{isRevealed === undefined ? 'Tap to reveal' : ''}</span>
      </span>
      <span className="dp__face dp__face--back" aria-hidden="true">
        <span className="dp__tab dp__tab--lavender dp__tab--right">Answer</span>
        <span className="dp__k">{subject}</span>
        <span className="dp__a">{c.answer}</span>
      </span>
    </>
  );

  return (
    <div className="dp" role="group" aria-label={`${subject} sample deck`} aria-describedby={`${idPrefix}-keys`} onKeyDown={onKeyDown}>
      <p id={`${idPrefix}-keys`} className="sr-only">Left and right arrow keys move between cards.</p>
      <div className="dp__stack" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
           onPointerUp={() => endDrag(false)} onPointerCancel={() => endDrag(true)}>
        {[2, 1].map((off) => (
          <div key={off} className={`dp__slot dp__slot--${off}`} aria-hidden="true">
            <div className={`dp__card dp__card--back dp__pos-${off}`}>
              <div className="dp__face"><span className={`dp__tab dp__tab--${off === 1 ? 'lavender' : tone}`}>{subject}</span></div>
            </div>
          </div>
        ))}
        {leaving && (
          <div key={leaving.id} className={`dp__ghost dp__ghost--${leaving.dir > 0 ? 'next' : 'prev'}`} aria-hidden="true">
            <span className={`dp__flip${leaving.revealed ? ' is-flipped' : ''}`}>{face(leaving.card, leaving.revealed)}</span>
          </div>
        )}
        <div className="dp__slot dp__slot--0">
          <button type="button" ref={front} key={i} className={`dp__card dp__pos-0${revealed ? ' is-revealed' : ''}${leaving ? ' is-arriving' : ''}`} onClick={flip}
                  aria-pressed={revealed} aria-describedby={`${idPrefix}-pos`}
                  aria-label={revealed ? `Answer: ${card.answer}. Show question` : `Question: ${card.question}. Reveal answer`}>
            <span className="dp__flip">{face(card)}</span>
          </button>
        </div>
      </div>
      {/* one compact row under the card: previous, reveal, next, position */}
      <div className="dp__bar">
        <button type="button" className="dp__nav" onClick={() => go(-1)} aria-label="Previous card">←</button>
        <button type="button" className="dp__reveal" onClick={flip}>{revealed ? 'Show question' : 'Reveal answer'}</button>
        <button type="button" className="dp__nav" onClick={() => go(1)} aria-label="Next card">→</button>
        <span id={`${idPrefix}-pos`} className="dp__pos" aria-label={`Card ${i + 1} of ${n}`}>{i + 1} / {n}</span>
      </div>
      <p className="sr-only" aria-live="polite">{revealed ? `Answer: ${card.answer}` : ''}</p>
    </div>
  );
}
