'use client';

import { useEffect, useRef, useState } from 'react';
import examples from '@/lib/homeExamples.json';
import DeckPreview, { DemoNote } from './DeckPreview';
import { useMedia, useReducedMotion } from './motion';

// The hero demonstration: a bundled sample file goes into the upload area, a
// passage is highlighted, and a card comes out of it, then the deck becomes a
// working preview. It plays once (about 6s), can be skipped or replayed, and
// uses prepared cards, so viewing the page never uploads or generates anything.

/** The sample economics PDF, typeset as readable HTML (same text as the bundled file). */
export function PdfPage({ highlight, className = '' }) {
  const L = (t) => (t === highlight ? <mark className="doc-mark">{t}</mark> : t);
  return (
    <div className={`doc doc--pdf ${className}`}>
      <p className="doc__title">Economics — Choices and Trade-offs</p>
      <p className="doc__meta">Introductory economics · Sample notes</p>
      <p className="doc__h">Scarcity</p>
      <p>{L('Scarcity means available resources are limited relative to people’s wants.')} Because we can’t have everything, every choice involves giving something up.</p>
      <p className="doc__h">Opportunity cost</p>
      <p>{L('Opportunity cost is the value of the next-best alternative forgone.')}</p>
      <p className="doc__ex">If you spend an evening studying instead of working a paid shift, the opportunity cost is the pay you would have earned.</p>
      <p className="doc__h">Incentives</p>
      <p>{L('An incentive changes the costs or benefits of an action and can influence decisions.')}</p>
      <p className="doc__h">Thinking at the margin</p>
      <p>{L('Marginal thinking compares the additional benefit and additional cost of a choice.')}</p>
    </div>
  );
}

// Where each definition sits in the real notebook photo, as % of the image
// (1125 × 1500). Percentages, so the highlight stays aligned at any size.
export const PHOTO_MARKS = {
  membrane: { left: 14.2, top: 24.6, width: 70.5, height: 4.6 },
  cytoplasm: { left: 14.2, top: 29.6, width: 70, height: 2.4 },
  organelle: { left: 13.1, top: 44.2, width: 73.8, height: 4.4 },
  prokaryote: { left: 13.1, top: 49.1, width: 72.7, height: 5.3 },
  nucleus: { left: 11.5, top: 61.6, width: 73, height: 4.8 },
};
export const PHOTO_SRC = examples.photo.file;
export const PHOTO_ALT = 'Photo of handwritten biology notes, “Module 1 — Important terms and Concepts”: definitions of cell, cell membrane, cytoplasm, cytosol, cell wall, organelle, prokaryote, eukaryote, nucleus, nuclear envelope, nucleolus, nucleic acids, DNA and RNA.';

export function PhotoPage({ highlight, className = '' }) {
  const m = highlight && PHOTO_MARKS[highlight];
  return (
    <div className={`doc doc--photo ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PHOTO_SRC} width="1125" height="1500" alt={PHOTO_ALT} />
      {m && <span key={highlight} className="doc-mark doc-mark--box" aria-hidden="true" style={{ left: `${m.left}%`, top: `${m.top}%`, width: `${m.width}%`, height: `${m.height}%` }} />}
    </div>
  );
}

/** A piece cut from the real photo: the region of one definition, for the lifted strip. */
function PhotoCrop({ mark }) {
  const m = PHOTO_MARKS[mark];
  if (!m) return null;
  return (
    <span className="hd__crop" style={{
      aspectRatio: `${m.width * 1125} / ${m.height * 1500}`,
      backgroundImage: `url(${PHOTO_SRC})`,
      backgroundSize: `${10000 / m.width}% auto`,
      backgroundPosition: `${(m.left / (100 - m.width)) * 100}% ${(m.top / (100 - m.height)) * 100}%`,
    }} />
  );
}

const SOURCES = {
  pdf: { label: 'PDF notes', subject: examples.pdf.subject, tone: 'tangerine', cards: examples.pdf.flashcards },
  photo: { label: 'Photo of notes', subject: examples.photo.subject, tone: 'pistachio', cards: examples.photo.flashcards },
};
// The three visual states, as six steps (start times in ms):
// 0 source settles · 1 passage highlights · 2 passage lifts off as a strip
// 3 strip becomes the question card, source recedes · 4 deck settles behind
// 5 result: source shrinks to a thumbnail, controls appear. About 5.5s, once.
const TIMELINE = [0, 900, 1900, 2900, 4100, 5300];
const DONE = TIMELINE.length - 1;

export default function HeroDemo() {
  const reduced = useReducedMotion();
  const fine = useMedia('(hover: hover) and (pointer: fine)');
  const root = useRef(null);
  const scene = useRef(null);
  const [kind, setKind] = useState('pdf');
  const [phase, setPhase] = useState(0);
  const [run, setRun] = useState(0); // remounts the deck on replay/switch so it starts at card 1
  const timers = useRef([]);
  const src = SOURCES[kind];

  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const play = () => {
    stop();
    setPhase(0);
    timers.current = TIMELINE.slice(1).map((t, i) => setTimeout(() => setPhase(i + 1), t));
  };

  // Play once, when the hero is on screen. Reduced motion: the finished result, no choreography.
  useEffect(() => {
    if (reduced) { stop(); setPhase(DONE); return; }
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); stop(); };
  }, [reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const playing = phase < DONE;
  const skip = () => { stop(); setPhase(DONE); };
  const replay = () => { setRun((r) => r + 1); play(); };
  function choose(k) {
    if (k === kind) return;
    setKind(k);
    setRun((r) => r + 1);
    if (playing) play(); // mid-sequence: start over with the new source; finished: show its cards
  }

  function tilt(e) {
    if (!fine || reduced || !scene.current) return;
    const b = scene.current.getBoundingClientRect();
    scene.current.style.setProperty('--ty', `${(((e.clientX - b.left) / b.width) - 0.5) * 10}deg`); // ±5°
    scene.current.style.setProperty('--tx', `${(0.5 - (e.clientY - b.top) / b.height) * 7}deg`); // ±3.5°
  }
  const untilt = () => { scene.current?.style.setProperty('--ty', '0deg'); scene.current?.style.setProperty('--tx', '0deg'); };

  const passage = src.cards[0]?.passage;

  return (
    <div ref={root} id="example" className="hd" data-phase={phase} data-kind={kind}>
      <div className="hd__top">
        <div role="group" aria-label="Choose an example" className="hd__choices">
          {Object.entries(SOURCES).map(([k, s]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => choose(k)} className={`hd__choice${kind === k ? ' is-on' : ''}`}>
              <span className={`hd__icon hd__icon--${k}`} aria-hidden="true" />{s.label}
            </button>
          ))}
        </div>
        {playing
          ? <button type="button" className="hd__quiet" onClick={skip}>Skip to cards</button>
          : !reduced && <button type="button" className="hd__quiet" onClick={replay}><span aria-hidden="true">↺</span> Replay</button>}
      </div>

      <div ref={scene} className="hd__scene" onPointerMove={tilt} onPointerLeave={untilt}>
        <div className="hd__doc" aria-hidden="true">
          {kind === 'pdf' ? <PdfPage highlight={phase >= 1 ? passage : null} /> : <PhotoPage highlight={phase >= 1 ? passage : null} />}
        </div>
        {/* the highlighted passage, lifted off the page on its way to becoming the question */}
        <div className="hd__clip" aria-hidden="true">{kind === 'pdf' ? <span>{passage}</span> : <PhotoCrop mark={passage} />}</div>
        <div className="hd__deck" inert={playing ? '' : undefined}>
          <DeckPreview key={`${kind}-${run}`} cards={src.cards} subject={src.subject} tone={src.tone} idPrefix="hero" />
        </div>
      </div>

      <DemoNote id="hero-about">Uses sample notes and prepared flashcards. Your files are processed when you upload them.</DemoNote>
    </div>
  );
}
