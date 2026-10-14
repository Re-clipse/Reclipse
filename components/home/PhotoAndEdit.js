'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '@/components/Modal';
import examples from '@/lib/homeExamples.json';
import DeckPreview, { DemoNote } from './DeckPreview';
import { PhotoPage, PHOTO_ALT, PHOTO_SRC } from './HeroDemo';
import { useEnteredView } from './motion';

/* ---------- "Paper notes work, too." ---------- */

const VIEWS = [['photo', 'Original photo'], ['cards', 'Flashcards']];

const PHOTO_CARDS = examples.photo.flashcards;

export function PhotoSection({ uploadHref }) {
  const stageRef = useRef(null);
  const inView = useEnteredView(stageRef, 0.2);
  const [view, setView] = useState('photo');
  const [card, setCard] = useState(0);
  const [zoom, setZoom] = useState(false);
  const closeZoom = useCallback(() => setZoom(false), []); // stable, so the modal keeps focus handling intact
  const tabs = useRef([]);
  // The photo always shows which handwritten line the current card comes from.
  const passage = PHOTO_CARDS[view === 'photo' ? 0 : card]?.passage;

  function onKey(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = view === 'photo' ? 'cards' : 'photo';
    setView(next);
    tabs.current[next === 'photo' ? 0 : 1]?.focus();
  }

  return (
    <section aria-labelledby="ph-h" className="hx-sec hx-sec--pistachio">
      <div className="hx-wrap ph__grid">
        <div>
          <p className="hx-kicker">Photos</p>
          <h2 id="ph-h" className="hx-h2">Paper notes work, too.</h2>
          <p className="hx-sub">Take a photo of a notebook page or the whiteboard and upload it. You’ll see the text Reclipse read from it, so you can fix anything it misread before it writes your cards.</p>
          <ol className="ph__steps">
            <li><span>1</span>Snap the page</li>
            <li><span>2</span>Upload it</li>
            <li><span>3</span>Check the text, then make cards</li>
          </ol>
          <p className="ph__tip"><strong>Tip:</strong> Use a clear photo with the whole page in frame. Very messy handwriting may need a few fixes.</p>
          <a href={uploadHref} className="hx-btn hx-btn--ink">Upload a photo</a>
        </div>

        <div ref={stageRef} className={`ph__stage is-${view} hx-settle${inView ? ' is-in' : ''}`}>
          <div role="tablist" aria-label="Photo example" className="ph__tabs" onKeyDown={onKey}>
            {VIEWS.map(([k, label], i) => (
              <button key={k} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`ph-tab-${k}`}
                      aria-selected={view === k} aria-controls="ph-panel" tabIndex={view === k ? 0 : -1}
                      onClick={() => setView(k)} className={`ph__tab${view === k ? ' is-on' : ''}`}>{label}</button>
            ))}
          </div>
          {/* One stage for both views, so switching is a connected move rather than a swap:
              the photo shrinks into a thumbnail as the deck comes forward, and back. */}
          <div role="tabpanel" id="ph-panel" aria-labelledby={`ph-tab-${view}`} className="ph__scene">
            <div className="ph__photo" aria-hidden={view === 'cards'}>
              <PhotoPage highlight={passage} />
            </div>
            <button type="button" className="ph__view" onClick={() => setZoom(true)}>
              <span aria-hidden="true">⤢</span> View notes
            </button>
            <div className="ph__deck" aria-hidden={view !== 'cards'} inert={view !== 'cards' ? '' : undefined}>
              <DeckPreview cards={PHOTO_CARDS} subject={examples.photo.subject} tone="pistachio" idPrefix="photo" onIndex={setCard} />
            </div>
            <p className="ph__link" hidden={view !== 'photo'}>
              <span className="ph__swatch" aria-hidden="true" />The highlighted line becomes card 1.
              <button type="button" onClick={() => setView('cards')}>See the card</button>
            </p>
          </div>
          {/* Portalled to <body>: the stage's container query would otherwise trap the fixed overlay. */}
          {zoom && createPortal(
            <Modal title="Biology notes: Module 1" onClose={closeZoom}>
              <div className="notes-view">
                <button type="button" className="notes-view__close" onClick={closeZoom}>Close</button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={PHOTO_SRC} width="1125" height="1500" alt={PHOTO_ALT} />
              </div>
            </Modal>,
            document.body,
          )}
          <DemoNote id="photo-about">Uses a sample photo of handwritten notes and prepared flashcards. Your photos are read when you upload them.</DemoNote>
        </div>
      </div>
    </section>
  );
}

/* ---------- "Review it. Make it yours." ---------- */

const ORIGINAL = {
  question: 'After a term of Spanish, you struggle to recall the French you learned first. Which interference is this?',
  answer: 'Retroactive interference. This is when newer learning, like the Spanish you studied this term, gets in the way of remembering older learning, like your French, because the new material competes with the old when you try to recall it.',
};

export function EditSection() {
  const stageRef = useRef(null);
  const inView = useEnteredView(stageRef, 0.2);
  const [card, setCard] = useState(ORIGINAL);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);
  const qRef = useRef(null);
  const editing = draft !== null;
  const changed = card !== ORIGINAL;

  function start() { setDraft(card); setSaved(false); setTimeout(() => qRef.current?.focus(), 0); }
  function save(e) {
    e.preventDefault();
    if (!draft.question.trim() || !draft.answer.trim()) return;
    setCard({ question: draft.question.trim(), answer: draft.answer.trim() });
    setDraft(null); setSaved(true);
  }
  function reset() { setCard(ORIGINAL); setDraft(null); setSaved(false); }
  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;

  return (
    <section aria-labelledby="ed-h" className="hx-sec hx-sec--lavender">
      <div className="hx-wrap ed__grid">
        <div>
          <p className="hx-kicker">You’re in charge</p>
          <h2 id="ed-h" className="hx-h2">Review it. Make it yours.</h2>
          <p className="hx-sub">Every new deck opens with all of its cards listed. Rename the deck, edit any card, delete the ones you don’t need, then start studying. Each edit is saved to your deck when you confirm it.</p>
          <p className="ed__try">Try it: this answer is too long. Edit the card and cut it down.</p>
        </div>

        <div ref={stageRef} className={`ed__stage hx-settle${inView ? ' is-in' : ''}`}>
          <div className="ed__sheet" aria-hidden="true">
            <div className="ed__sheet-head">
              <span><strong>Psychology – Memory</strong><span>5 cards · quiz included</span></span>
              <span className="ed__fake-btn">Study</span>
            </div>
            {['You keep typing an old password…', 'Two students each study 3 hours…', 'You hear a phone number once…'].map((q) => (
              <div key={q} className="ed__row"><span>{q}</span><span className="ed__tools">✎ ×</span></div>
            ))}
          </div>

          <div className={`ed__card${editing ? ' is-editing' : ''}${saved ? ' is-saved' : ''}`}>
            <span className="dp__tab dp__tab--lavender">Psychology</span>
            {!editing ? (
              <>
                <p className="dp__k">Question</p>
                <p className="ed__q">{card.question}</p>
                <p className="dp__k ed__k-a">Answer <span className="ed__count">{words(card.answer)} words</span></p>
                <p className="ed__a">{card.answer}</p>
                <div className="ed__actions">
                  <button type="button" className="hx-btn hx-btn--ink" onClick={start}>Edit card</button>
                  {changed && <button type="button" className="hx-btn hx-btn--quiet" onClick={reset}>Reset example</button>}
                </div>
                <p className="ed__status" role="status">{saved && <><span className="ed__saved">✓ Saved</span> This example isn’t stored anywhere.</>}</p>
              </>
            ) : (
              <form onSubmit={save} className="ed__form">
                <label className="ed__label" htmlFor="ed-q">Question</label>
                <textarea id="ed-q" ref={qRef} rows={3} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
                <label className="ed__label" htmlFor="ed-a">Answer <span className="ed__count">{words(draft.answer)} words · aim for under 25</span></label>
                <textarea id="ed-a" rows={4} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
                <div className="ed__actions">
                  <button type="submit" className="hx-btn hx-btn--ink" disabled={!draft.question.trim() || !draft.answer.trim()}>Save</button>
                  <button type="button" className="hx-btn hx-btn--quiet" onClick={() => setDraft(null)}>Cancel</button>
                  <button type="button" className="hx-btn hx-btn--quiet" onClick={reset}>Reset example</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
