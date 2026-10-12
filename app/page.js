'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getArchivePrice, formatArchivePrice } from '@/lib/archive';
import SwipeDeck from '@/components/home/SwipeDeck';
import ClozeTry from '@/components/home/ClozeTry';
import ForgettingCurve from '@/components/home/ForgettingCurve';

const NOTES = [
  { color: 'hl',   t: 'Mock exams', d: 'Mix questions from several decks into one timed exam.' },
  { color: 'pink', t: 'Photos of notes', d: 'Handwriting and whiteboards work. Snap it, check it, generate.' },
  { color: 'mint', t: 'Exam and lab reminders', d: 'Upload a syllabus. Get an email before every graded date.' },
  { color: 'sky',  t: 'Study with friends', d: 'Send a classmate a copy, or build one deck together.' },
  { color: 'hl',   t: 'Lab Prep', tag: 'Plus', d: 'Work through lab-style practice problems in a guided chat.' },
  { color: 'pink', t: 'Take it anywhere', d: 'Export any deck to CSV, Anki or Quizlet.' },
];

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [price, setPrice] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  useEffect(() => { getArchivePrice().then(setPrice); }, []);

  const start = signedIn ? '/upload' : '/login?mode=signup';
  const startLabel = signedIn ? 'Make a new deck' : 'Make a deck from your notes';

  return (
    <main className="h2o">
      {/* HERO: graph paper, poster headline, a deck you can actually study */}
      <header className="h2o-hero">
        <div className="h2o-wrap h2o-hero__grid">
          <div className="h2o-hero__copy">
            <p className="h2o-kicker">Made at Wilfrid Laurier University</p>
            <h1 className="h2o-display">
              Turn this week&apos;s lecture into <span className="h2o-mark">flashcards</span>.
            </h1>
            <p className="h2o-lede">
              Upload a PDF, a photo of the whiteboard, or pasted notes. Reclipse writes the cards
              and a practice quiz, then brings each card back right before you&apos;d forget it.
            </p>
            <div className="h2o-actions">
              <a href={start} className="h2o-btn h2o-btn--ink">{startLabel}</a>
              {signedIn
                ? <a href="/decks" className="h2o-link">Go to my decks</a>
                : <a href="/demo" className="h2o-link">Try it without an account</a>}
            </div>
            <p className="h2o-fine">Free while we launch. No credit card.</p>
          </div>
          <div className="h2o-hero__deck">
            <span className="h2o-hand h2o-hand--deck" aria-hidden="true">go on, swipe one</span>
            <SwipeDeck />
          </div>
        </div>
      </header>

      {/* TRY IT: yellow band */}
      <section className="h2o-band h2o-band--yellow">
        <div className="h2o-wrap">
          <div className="h2o-head">
            <span className="h2o-num">01</span>
            <h2 className="h2o-h2">Try it with a line from your notes.</h2>
          </div>
          <ClozeTry />
        </div>
      </section>

      {/* WHY IT WORKS: cobalt band */}
      <section className="h2o-band h2o-band--cobalt">
        <div className="h2o-wrap">
          <div className="h2o-head">
            <span className="h2o-num">02</span>
            <h2 className="h2o-h2">You forget most of a lecture in a day. Reviews fix that.</h2>
          </div>
          <p className="h2o-sub">
            Drag through the month. Each time you review a card, it sticks longer, so the next
            review can wait. Reclipse schedules all of it for you.
          </p>
          <ForgettingCurve />
        </div>
      </section>

      {/* EVERYTHING ELSE: sticky notes */}
      <section className="h2o-band h2o-band--paper">
        <div className="h2o-wrap">
          <div className="h2o-head">
            <span className="h2o-num">03</span>
            <h2 className="h2o-h2">Also on the desk.</h2>
          </div>
          <div className="h2o-notes">
            {NOTES.map((n, i) => (
              <div key={n.t} className={`h2o-note h2o-note--${n.color}`} style={{ '--tilt': `${[-2, 1.5, -1, 2, -1.5, 1][i]}deg` }}>
                <h3>{n.t}{n.tag && <span className="h2o-note__tag">{n.tag}</span>}</h3>
                <p>{n.d}</p>
              </div>
            ))}
            <div className="h2o-note h2o-note--mint" style={{ '--tilt': '-0.5deg' }}>
              <h3>Campus Archive{price && <span className="h2o-note__tag">{formatArchivePrice(price)}</span>}</h3>
              <p>
                {price
                  ? <>Study sets other Laurier students have shared. <a href="/archive">Browse it</a>.</>
                  : 'Study sets shared by other Laurier students. Coming soon.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* RESEARCH + CTA: ink band */}
      <section className="h2o-band h2o-band--ink">
        <div className="h2o-wrap h2o-end">
          <figure className="h2o-quote">
            <blockquote>
              Students who practiced recalling a text remembered more of it a week later than
              students who made concept maps from it.
            </blockquote>
            <figcaption>
              Karpicke &amp; Blunt, <a href="https://doi.org/10.1126/science.1199327" target="_blank" rel="noopener">Science (2011)</a>
            </figcaption>
          </figure>
          <div className="h2o-end__cta">
            <h2 className="h2o-display h2o-display--sm">Bring this week&apos;s notes.</h2>
            <a href={start} className="h2o-btn h2o-btn--yellow">{startLabel}</a>
            <span className="h2o-hand h2o-hand--end" aria-hidden="true">about a minute, start to finish</span>
          </div>
        </div>
      </section>
    </main>
  );
}
