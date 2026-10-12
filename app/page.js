'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { previewInterval } from '@/lib/srs';
import { getArchivePrice, formatArchivePrice } from '@/lib/archive';

// The hero card is the real study flip, with real grading intervals from
// lib/srs.js. A card already reviewed twice, so the buttons show the gaps a
// student would actually see mid-semester.
const DEMO_PROGRESS = { ease: 2.5, interval_days: 6, reps: 2, lapses: 0 };
const RATINGS = [
  { v: 0, label: 'Again' },
  { v: 1, label: 'Hard' },
  { v: 2, label: 'Good' },
  { v: 3, label: 'Easy' },
];

const DEMO_CARDS = [
  { label: 'Question', q: 'Why does testing yourself beat rereading?',
    a: 'Pulling an answer out of memory strengthens it. Rereading mostly makes the page look familiar.' },
  { label: 'Fill in the blank', q: 'Most forgetting happens in the first _____ after you learn something.',
    a: '24 hours' },
  { label: 'Question', q: 'What are the three stages of memory?',
    a: 'Encoding, storage and retrieval.' },
];

const SAMPLE_NOTES = `PS101 · Week 6 · Memory

- encoding -> storage -> retrieval
- testing effect: recalling info strengthens
  memory more than rereading it
  (Roediger & Karpicke 2006)
- spacing: reviews spread over days beat
  one long session
- Ebbinghaus forgetting curve: steepest
  drop in first 24h`;

const INTERVALS = [
  { t: '10 min', d: 'after a miss', miss: true },
  { t: '1 day', d: 'first time right' },
  { t: '6 days', d: 'second time' },
  { t: '15 days', d: 'third time' },
  { t: '5 weeks', d: 'and growing' },
];

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [price, setPrice] = useState(null);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  useEffect(() => { getArchivePrice().then(setPrice); }, []);

  const card = DEMO_CARDS[i];
  const start = signedIn ? '/upload' : '/login?mode=signup';

  function grade() {
    setRevealed(false);
    setI((n) => (n + 1) % DEMO_CARDS.length);
  }

  return (
    <main className="home">
      <header className="home-hero">
        <div className="home-wrap">
          <div>
            <p className="home-kicker">Made at Wilfrid Laurier University</p>
            <h1 className="home-title">
              Turn this week&apos;s lecture into <span className="hl">flashcards</span>.
            </h1>
            <p className="home-lede">
              Upload a PDF, a photo of the whiteboard, or pasted notes. Reclipse writes the
              cards and a practice quiz, then brings each card back right before you&apos;d
              forget it.
            </p>
            <div className="home-actions">
              <a href={start} className="btn btn--primary btn--lg">
                {signedIn ? 'Make a new deck' : 'Make a deck from your notes'}
              </a>
              {signedIn
                ? <a href="/decks" className="btn btn--quiet">Go to my decks</a>
                : <a href="/demo" className="btn btn--quiet">Try it without an account</a>}
            </div>
            <p className="home-fine">Free while we launch. No credit card.</p>
          </div>

          <div className="home-card-demo">
            <div className="home-card-under" aria-hidden="true" />
            <div className={`flip${revealed ? ' flip--revealed' : ''}`}>
              <div className="flip__inner" role="button" tabIndex={0}
                   aria-label={revealed ? 'Hide answer' : 'Show answer'}
                   onClick={() => setRevealed((r) => !r)}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRevealed((r) => !r); }
                   }}>
                <div className="flip__face">
                  <span className="flip__label">{card.label}</span>
                  <p className="flip__text">{card.q}</p>
                </div>
                <div className="flip__face flip__face--back">
                  <span className="flip__label">Answer</span>
                  <p className="flip__text">{card.a}</p>
                </div>
              </div>
            </div>
            <div className="home-card-meta">
              <span>PS101 · Memory</span>
              <span>card {i + 1} of {DEMO_CARDS.length}</span>
            </div>
            {revealed ? (
              <div className="home-grades" aria-label="How well did you know it?">
                {RATINGS.map((r) => (
                  <button key={r.v} type="button" className="btn btn--ghost" onClick={grade}>
                    {r.label}
                    <small>{previewInterval(DEMO_PROGRESS, r.v)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="home-grades">
                <button type="button" className="btn btn--ghost" onClick={() => setRevealed(true)}>
                  Show answer
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="home-section">
        <div className="home-wrap">
          <h2 className="home-h2">What comes back from one page of notes</h2>
          <p className="home-sub">
            Up to 30 flashcards, some of them fill-in-the-blank, plus a six-question quiz.
            You can edit any card before you study it.
          </p>
          <div className="home-io">
            <div>
              <div className="home-io__label">What you upload</div>
              <div className="home-notes">{SAMPLE_NOTES}</div>
            </div>
            <div>
              <div className="home-io__label">What Reclipse writes</div>
              <div className="home-out">
                <div className="home-out__card">
                  <div className="home-out__type">Flashcard</div>
                  <div className="home-out__q">Why does testing yourself beat rereading?</div>
                  <div className="home-out__a">Recalling an answer strengthens the memory. Rereading only makes it look familiar.</div>
                </div>
                <div className="home-out__card">
                  <div className="home-out__type">Fill in the blank</div>
                  <div className="home-out__q">Most forgetting happens in the first _____.</div>
                  <div className="home-out__a">24 hours</div>
                </div>
                <div className="home-out__card home-quiz">
                  <div className="home-out__type">Quiz question</div>
                  <div className="home-out__q">You reread a chapter three times the night before. What&apos;s the main problem?</div>
                  <ol>
                    <li>It takes too long</li>
                    <li className="is-right">It practices recognizing, not recalling</li>
                    <li>Rereading causes interference</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-wrap">
          <h2 className="home-h2">When cards come back</h2>
          <p className="home-sub">
            After each card you grade yourself. A miss comes back in ten minutes. Every time you
            get it right, the gap gets longer, so you spend your time on the cards you don&apos;t
            know yet. It&apos;s the SM-2 schedule, the same one Anki is built on.
          </p>
          <div className="home-steps">
            {INTERVALS.map((s) => (
              <div key={s.t} className={`home-step${s.miss ? ' home-step--miss' : ''}`}>
                <div className="home-step__t">{s.t}</div>
                <div className="home-step__d">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-wrap">
          <h2 className="home-h2">Also in Reclipse</h2>
          <dl className="home-list">
            <div><dt>Mock exams</dt><dd>Mix questions from several decks into one timed exam.</dd></div>
            <div><dt>Photos of notes</dt><dd>Handwriting and whiteboards work. Check the text before generating.</dd></div>
            <div><dt>Exam and lab reminders</dt><dd>Upload a syllabus and get an email before each graded date.</dd></div>
            <div><dt>Shared decks</dt><dd>Send a classmate a copy, or build one deck together.</dd></div>
            <div><dt>Export</dt><dd>Download any deck as CSV, or as a file Anki and Quizlet can import.</dd></div>
            <div><dt>Lab Prep <span className="tag">Plus</span></dt><dd>Work through lab-style practice problems in a guided chat.</dd></div>
            <div>
              <dt>Campus Archive {price && <span className="tag">{formatArchivePrice(price)}</span>}</dt>
              <dd>
                {price
                  ? <>Study sets other Laurier students have shared. <a href="/archive">Browse the archive</a>.</>
                  : <>Study sets shared by other Laurier students. Coming soon.</>}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="home-section">
        <div className="home-wrap home-research">
          <div className="home-research__cite">
            Karpicke &amp; Blunt (2011)<br />
            <a href="https://doi.org/10.1126/science.1199327" target="_blank" rel="noopener">Science, 331</a>
          </div>
          <p>
            Students who practiced recalling a science text remembered more of it a week later
            than students who made concept maps from it, even though the concept mappers expected
            to do better. Reclipse is built on that finding: you answer first, then check.
          </p>
        </div>
      </section>

      <section className="home-end">
        <div className="home-wrap">
          <h2 className="home-h2">Bring this week&apos;s notes.</h2>
          <a href={start} className="btn btn--primary btn--lg">
            {signedIn ? 'Make a new deck' : 'Make a deck from your notes'}
          </a>
        </div>
      </section>
    </main>
  );
}
