'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getArchivePrice, formatArchivePrice } from '@/lib/archive';
import SwipeDeck from '@/components/home/SwipeDeck';
import ClozeTry from '@/components/home/ClozeTry';
import MemoryCards from '@/components/home/MemoryCards';
import StickyNotes from '@/components/home/StickyNotes';
import FlowThread from '@/components/home/FlowThread';

// Curved hand-off between sections, filled with the colour of the next one,
// so the page reads as one surface instead of stacked blocks.
function Wave({ to, flip }) {
  return (
    <svg className={`wave${flip ? ' wave--flip' : ''}`} viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,46 C220,92 420,6 720,40 C1010,72 1210,8 1440,38 L1440,90 L0,90 Z" style={{ fill: `var(--${to})` }} />
    </svg>
  );
}

// Faint chalk doodles on the board: the kind of thing left over from a lecture.
function ChalkDoodles() {
  return (
    <svg className="chalk" viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className="chalk__ink">
        <text x="70" y="110">ATP → energy</text>
        <text x="830" y="90">supply ↑ price ↓</text>
        <text x="980" y="560">1867</text>
        <text x="120" y="590">recall &gt; reread</text>
        <text x="560" y="610">day 1 · 6 · 15</text>
        <path d="M60 128 q90 12 190 -4" />
        <path d="M820 300 c40 -60 120 -60 160 0 s120 60 160 0" />
        <circle cx="1020" cy="548" r="46" />
        <path d="M1060 200 l60 0 m-12 -10 l12 10 -12 10" />
        <path d="M300 300 l0 160 l220 0" />
        <path d="M300 440 c50 -10 90 -90 140 -120 s60 -10 80 -8" />
      </g>
    </svg>
  );
}

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  const [price, setPrice] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  useEffect(() => { getArchivePrice().then(setPrice); }, []);

  const start = signedIn ? '/upload' : '/login?mode=signup';
  const startLabel = signedIn ? 'Make a new deck' : 'Make a deck from your notes';

  const notes = [
    { color: 'hl',   t: 'Mock exams', d: 'Mix questions from several decks into one timed exam.' },
    { color: 'pink', t: 'Photos of notes', d: 'Handwriting and whiteboards work. Snap it, check it, generate.' },
    { color: 'mint', t: 'Exam and lab reminders', d: 'Upload a syllabus. Get an email before every graded date.' },
    { color: 'sky',  t: 'Study with friends', d: 'Send a classmate a copy, or build one deck together.' },
    { color: 'hl',   t: 'Lab Prep', tag: 'Plus', d: 'Work through lab-style practice problems in a guided chat.' },
    { color: 'pink', t: 'Take it anywhere', d: 'Export any deck to CSV, Anki or Quizlet.' },
    { color: 'mint', t: 'Campus Archive', tag: price ? formatArchivePrice(price) : 'Soon',
      d: price ? <>Study sets other Laurier students have shared. <a href="/archive">Browse it</a>.</> : 'Study sets shared by other Laurier students.' },
  ];

  return (
    <main className="fl">
      <FlowThread />

      {/* 1. The board: where every lecture starts */}
      <header className="fl-board fl-hero">
        <ChalkDoodles />
        <div className="fl-wrap fl-hero__grid">
          <div>
            <h1 className="fl-display">
              Turn this week&apos;s lecture into <span className="fl-mark">flashcards</span>.
            </h1>
            <p className="fl-lede">
              Upload a PDF, a photo of the whiteboard, or pasted notes. Reclipse writes the cards
              and a practice quiz, then brings each card back right before you&apos;d forget it.
            </p>
            <div className="fl-actions">
              <a href={start} className="fl-btn fl-btn--hl">{startLabel}</a>
              {signedIn
                ? <a href="/decks" className="fl-link">Go to my decks</a>
                : <a href="/demo" className="fl-link">Try it without an account</a>}
            </div>
            <p className="fl-fine">Free while we launch. No credit card.</p>
          </div>
          <div className="fl-hero__deck" data-thread="center">
            <span className="fl-hand fl-hand--deck" aria-hidden="true">go on, swipe one</span>
            <SwipeDeck />
          </div>
        </div>
        <Wave to="cream" />
      </header>

      {/* 2. Your notes become cards */}
      <section className="fl-sec fl-sec--cream">
        <div className="fl-wrap">
          <p className="fl-step" data-thread="left">Step 1 · your notes</p>
          <h2 className="fl-h2">Paste a line from your notes. Watch it turn into a card.</h2>
          <ClozeTry />
        </div>
        <Wave to="butter" />
      </section>

      {/* 3. The cards stick */}
      <section className="fl-sec fl-sec--butter">
        <div className="fl-wrap">
          <p className="fl-step">Step 2 · your memory</p>
          <h2 className="fl-h2" data-thread="right">Then Reclipse makes sure it sticks until the exam.</h2>
          <p className="fl-sub">Slide the exam date. Each review pushes forgetting further away, and Reclipse schedules every one for you.</p>
          <MemoryCards />
        </div>
        <Wave to="cream" />
      </section>

      {/* 4. Everything else */}
      <section className="fl-sec fl-sec--cream">
        <div className="fl-wrap">
          <p className="fl-step" data-thread="left">Also on the desk</p>
          <h2 className="fl-h2">Everything else you&apos;ll use before an exam.</h2>
          <span className="fl-hand fl-hand--notes" aria-hidden="true">drag them around</span>
          <StickyNotes notes={notes} />
        </div>
        <Wave to="board" />
      </section>

      {/* 5. Back to the board, your turn */}
      <section className="fl-board fl-end">
        <div className="fl-wrap fl-end__inner">
          <h2 className="fl-display fl-display--sm" data-thread="center">Bring this week&apos;s notes.</h2>
          <a href={start} className="fl-btn fl-btn--hl">{startLabel}</a>
          <span className="fl-hand fl-hand--end" aria-hidden="true">about a minute, start to finish</span>
          <figure className="fl-quote">
            <blockquote>
              Students who practiced recalling a text remembered more of it a week later than
              students who made concept maps from it.
            </blockquote>
            <figcaption>
              Karpicke &amp; Blunt, <a href="https://doi.org/10.1126/science.1199327" target="_blank" rel="noopener">Science (2011)</a>
            </figcaption>
          </figure>
        </div>
      </section>
    </main>
  );
}
