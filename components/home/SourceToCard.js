'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMedia, useReducedMotion, useScrollProgress } from './motion';
import { DemoNote } from './DeckPreview';

// "Questions built from what you're learning": one passage beside the card it
// becomes. On wide screens a short sticky sequence (one extra viewport) ties
// the three stages to scroll; the stage buttons work everywhere.

const STAGES = [
  { title: 'Find the idea', text: 'The passage that matters most.' },
  { title: 'Ask about it', text: 'A question that makes you apply it.' },
  { title: 'Check the answer', text: 'Short, and drawn from the notes.' },
];
const STAGE_AT = [0, 0.3, 0.64]; // track progress where each stage begins (sticky mode)
const HOLD_PX = 24; // a clicked stage holds until the visitor scrolls this far

const QUESTION = 'You spend an hour studying instead of taking your next-best option: a paid work shift. What is the opportunity cost?';
const ANSWER = 'The earnings you give up from that work shift.';

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const measure = (r, vh) => -r.top / (r.height - vh);

export default function SourceToCard() {
  const reduced = useReducedMotion();
  const wide = useMedia('(min-width: 1024px) and (min-height: 660px)');
  const sticky = wide && !reduced;
  const track = useRef(null);
  const scene = useRef(null);
  const hold = useRef(null); // scrollY at the moment a point was clicked
  const [stage, setStage] = useState(0);
  const [stepped, setStepped] = useState(true); // true: click-driven (eased); false: scroll-driven (direct)

  // One source of truth for the scene: --k (passage -> question) and --r (answer),
  // plus --pf for the progress track. Scroll writes them continuously; a click
  // writes the values of its stage.
  const paint = useCallback((k, r, pf) => {
    const el = scene.current?.closest('.stc');
    if (!el) return;
    el.style.setProperty('--k', k.toFixed(3));
    el.style.setProperty('--r', r.toFixed(3));
    el.style.setProperty('--pf', pf.toFixed(3));
  }, []);

  const onProgress = useCallback((p) => {
    if (hold.current !== null) {
      if (Math.abs(window.scrollY - hold.current) < HOLD_PX) return; // keep the clicked stage
      hold.current = null;
      setTimeout(() => { if (hold.current === null) setStepped(false); }, 420); // ease the hand-back, then follow scroll directly
    } else {
      setStepped(false);
    }
    setStage(p < STAGE_AT[1] ? 0 : p < STAGE_AT[2] ? 1 : 2);
    // motion starts exactly at each stage boundary, so the active point always matches the scene
    paint(clamp01((p - STAGE_AT[1]) / 0.2), clamp01((p - STAGE_AT[2]) / 0.14), clamp01(p / STAGE_AT[2]));
  }, [paint]);
  useScrollProgress(track, onProgress, measure, sticky);

  function go(n) {
    hold.current = sticky ? window.scrollY : null;
    setStepped(true);
    setStage(n);
    paint(n >= 1 ? 1 : 0, n >= 2 ? 1 : 0, n / 2);
  }

  // Not pinned (mobile, reduced motion): the buttons alone drive the scene.
  useEffect(() => { if (!sticky) { hold.current = null; setStepped(true); paint(stage >= 1 ? 1 : 0, stage >= 2 ? 1 : 0, stage / 2); } }, [sticky]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section ref={track} aria-labelledby="stc-h" className={`hx-sec hx-sec--plum stc${sticky ? ' stc--sticky' : ''}${stepped ? ' stc--stepped' : ''}`} data-stage={stage}>
      <div className="stc__frame">
        <div className="hx-wrap stc__grid">
          <div>
            <p className="hx-kicker hx-kicker--dark">The output</p>
            <h2 id="stc-h" className="hx-h2 hx-h2--light">Questions built from what you’re learning.</h2>
            <p className="hx-sub hx-sub--light">
              Reclipse looks for the ideas an exam would test and asks you to use them, not just repeat a sentence back.
            </p>
            <ol className="stc__stages" aria-label="How a passage becomes a card">
              {STAGES.map((s, n) => (
                <li key={s.title}>
                  <button type="button" onClick={() => go(n)} aria-current={stage === n ? 'step' : undefined}
                          className={`stc__stage${stage === n ? ' is-on' : ''}${stage > n ? ' is-done' : ''}`}>
                    <span className="stc__n">{n + 1}</span>
                    <span><span className="stc__t">{s.title}</span><span className="stc__d">{s.text}</span></span>
                  </button>
                </li>
              ))}
            </ol>
            <DemoNote id="stc-about" label="Example: from passage to question">Uses a passage from the sample lecture notes and a prepared card. Cards don’t currently link back to a page in your notes.</DemoNote>
          </div>

          <div ref={scene} className="stc__scene">
            <div className="stc__source">
              <p className="stc__src-k">Economics · Choices and trade-offs</p>
              <p className="stc__dim">Scarcity means available resources are limited relative to people’s wants, so every choice involves giving something up.</p>
              <p className="stc__keyline">
                <mark className="stc__mark">Opportunity cost is the value of the next-best alternative forgone.</mark>
                <span className="stc__lift" aria-hidden="true">Opportunity cost is the value of the next-best alternative forgone.</span>
              </p>
              <p className="stc__dim">If you spend an evening studying instead of working a paid shift, the opportunity cost is the pay you would have earned.</p>
            </div>
            <div className="stc__card" aria-hidden={stage < 1}>
              <span className="dp__tab dp__tab--tangerine">Economics</span>
              <p className="dp__k">Question</p>
              <p className="stc__q">{QUESTION}</p>
              <div className="stc__answer" aria-hidden={stage < 2}>
                <p className="dp__k">Answer</p>
                <p className="stc__a">{ANSWER}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">Step {stage + 1} of 3: {STAGES[stage].title}.</p>
    </section>
  );
}
