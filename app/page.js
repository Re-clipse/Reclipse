'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import HeroDemo from '@/components/home/HeroDemo';
import SourceToCard from '@/components/home/SourceToCard';
import { PhotoSection, EditSection } from '@/components/home/PhotoAndEdit';
import './home.css';

// The homepage tells one story: your notes -> useful flashcards -> your next
// study session. Every upload button goes to the real /upload flow (through
// sign-up first when signed out, which /upload needs anyway).

const SUPPORT = [
  ['Courses', 'Keep each class’s decks together in one place.'],
  ['Review what’s due', 'Cards come back on a spaced schedule, sooner when you miss them.'],
  ['A quiz with every set', 'Each upload also writes multiple-choice practice questions.'],
  ['Mock exams', 'Mix questions from several decks into one timed exam.'],
  ['Your activity', 'See the sessions and reviews you’ve actually done.'],
];

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);
  const uploadHref = signedIn ? '/upload' : '/login?mode=signup&next=/upload';

  return (
    <main className="hx">
      <section className="hx-hero" aria-labelledby="hero-h">
        <div className="hx-wrap hx-hero__grid">
          <div className="hx-hero__copy">
            <p className="hx-kicker">Notes in, flashcards out</p>
            <h1 id="hero-h" className="hx-display hx-display--hero"><span>Your notes.</span> <span>Ready to study.</span></h1>
            <p className="hx-lede">Upload a PDF or photos of your notes. Turn them into flashcards you can review, edit, and study.</p>
            <div className="hx-actions">
              <a href={uploadHref} className="hx-btn hx-btn--accent hx-btn--lg">Upload my notes</a>
              <a href="#example" className="hx-btn hx-btn--outline hx-btn--lg">Try an example</a>
            </div>
            <ul className="hx-specs" aria-label="What you can upload">
              <li>PDF</li><li>Photo</li><li>Text file</li>
              <li className="hx-specs__note">Up to 15 MB (photos 5 MB) · Free to start</li>
            </ul>
          </div>
          <HeroDemo />
        </div>
      </section>

      <SourceToCard />
      <PhotoSection uploadHref={uploadHref} />
      <EditSection />

      <section className="hx-sec hx-support" aria-labelledby="sup-h">
        <div className="hx-wrap hx-support__grid">
          <div>
            <p className="hx-kicker">After the cards</p>
            <h2 id="sup-h" className="hx-h2 hx-h2--sm">Then keep studying in the same place.</h2>
          </div>
          <ul className="hx-support__list">
            {SUPPORT.map(([t, d]) => <li key={t}><strong>{t}</strong><span>{d}</span></li>)}
          </ul>
        </div>
      </section>

      <section className="hx-final" aria-labelledby="final-h">
        <div className="hx-wrap hx-final__inner">
          <h2 id="final-h" className="hx-display hx-display--final">Your notes are already written. <span>Put them to work.</span></h2>
          <a href={uploadHref} className="hx-btn hx-btn--plum hx-btn--lg">Upload my notes</a>
        </div>
      </section>
    </main>
  );
}
