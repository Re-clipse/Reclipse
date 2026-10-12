'use client';

import { useRef, useState } from 'react';

// Homepage hero: a stack of index cards you can actually study. Tap to flip,
// drag right for "got it", left for "again" (or use the buttons / arrow keys).
// Cards cycle forever, so there's always one on top.
const CARDS = [
  { tag: 'PS101 · Memory', tape: 'var(--hl)', q: 'Why does testing yourself beat rereading?', a: 'Pulling an answer out of memory strengthens it. Rereading mostly makes the page look familiar.' },
  { tag: 'BU111 · Marketing', tape: 'var(--pink)', q: 'The four Ps of marketing are product, price, place and _____.', a: 'Promotion' },
  { tag: 'BI110 · Cells', tape: 'var(--mint)', q: 'What does the mitochondria produce?', a: 'ATP, the cell’s main energy currency.' },
  { tag: 'EC120 · Micro', tape: 'var(--sky)', q: 'If price rises and quantity demanded barely changes, demand is _____.', a: 'Inelastic' },
  { tag: 'HI101 · Canada', tape: 'var(--hl)', q: 'In what year did Confederation create the Dominion of Canada?', a: '1867' },
];
const TILT = [-3, 2.5, -1.5, 3.5, -2];
const THRESHOLD = 110;

export default function SwipeDeck() {
  const [order, setOrder] = useState(() => CARDS.map((_, i) => i));
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [fly, setFly] = useState(null); // 'left' | 'right'
  const [tally, setTally] = useState({ got: 0, again: 0 });
  const start = useRef(null);
  const moved = useRef(false);

  function commit(dir) {
    if (fly) return;
    setFly(dir);
    setTally((t) => (dir === 'right' ? { ...t, got: t.got + 1 } : { ...t, again: t.again + 1 }));
    setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setFly(null);
      setFlipped(false);
      setDrag({ x: 0, y: 0, active: false });
    }, 280);
  }

  function onPointerDown(e) {
    if (fly) return;
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  }
  function onPointerMove(e) {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(x) > 5 || Math.abs(y) > 5) moved.current = true;
    setDrag({ x, y: y * 0.4, active: true });
  }
  function onPointerUp() {
    if (!start.current) return;
    start.current = null;
    if (drag.x > THRESHOLD) return commit('right');
    if (drag.x < -THRESHOLD) return commit('left');
    setDrag({ x: 0, y: 0, active: false });
    if (!moved.current) setFlipped((f) => !f);
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); commit('right'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); commit('left'); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
  }

  const lean = Math.max(-1, Math.min(1, drag.x / THRESHOLD));

  return (
    <div className="deck2" tabIndex={0} onKeyDown={onKeyDown}
         aria-label="Practice flashcards. Space flips, right arrow means got it, left arrow means again.">
      <div className="deck2__stack">
        {order.slice(0, 4).reverse().map((idx) => {
          const pos = order.indexOf(idx);
          const card = CARDS[idx];
          const isTop = pos === 0;
          let transform = `translate(${pos * 6}px, ${pos * 10}px) rotate(${TILT[idx]}deg) scale(${1 - pos * 0.035})`;
          if (isTop) {
            if (fly) transform = `translate(${fly === 'right' ? 140 : -140}%, -40px) rotate(${fly === 'right' ? 24 : -24}deg)`;
            else transform = `translate(${drag.x}px, ${drag.y}px) rotate(${TILT[idx] * (1 - Math.abs(lean)) + lean * 14}deg)`;
          }
          return (
            <div key={idx}
                 className={`deck2__card${isTop ? ' is-top' : ''}${isTop && flipped ? ' is-flipped' : ''}${isTop && drag.active ? ' is-dragging' : ''}`}
                 style={{ transform, zIndex: 10 - pos }}
                 {...(isTop ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } : {})}>
              <div className="deck2__tape" style={{ background: card.tape }} aria-hidden="true" />
              <div className="deck2__inner">
                <div className="deck2__face">
                  <span className="deck2__tag">{card.tag}</span>
                  <p className="deck2__text">{card.q}</p>
                  <span className="deck2__hint">tap to flip</span>
                </div>
                <div className="deck2__face deck2__face--back">
                  <span className="deck2__tag">Answer</span>
                  <p className="deck2__text">{card.a}</p>
                  <span className="deck2__hint">drag right if you got it</span>
                </div>
              </div>
              {isTop && (
                <>
                  <span className="deck2__stamp deck2__stamp--got" style={{ opacity: Math.max(0, lean) }} aria-hidden="true">Got it</span>
                  <span className="deck2__stamp deck2__stamp--again" style={{ opacity: Math.max(0, -lean) }} aria-hidden="true">Again</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="deck2__controls">
        <button type="button" className="deck2__btn deck2__btn--again" onClick={() => commit('left')}>&larr; Again</button>
        <button type="button" className="deck2__btn" onClick={() => setFlipped((f) => !f)}>Flip</button>
        <button type="button" className="deck2__btn deck2__btn--got" onClick={() => commit('right')}>Got it &rarr;</button>
      </div>
      <p className="deck2__tally" aria-live="polite">
        <span><b>{tally.got}</b> got it</span>
        <span><b>{tally.again}</b> coming back in 10 min</span>
      </p>
    </div>
  );
}
