'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Mascot from '@/components/Mascot';
import { GoalRing } from '@/components/Rewards';

function Icon({ path }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
  );
}

export default function Home() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <>
      {/* HERO */}
      <header className="lp-hero">
        <div className="lp-hero__glow" aria-hidden="true" />
        <div className="lp-hero__inner">
          <div className="lp-hero__copy">
            <h1 className="lp-hero__title rise delay-1">
              Study less.<br />Remember <span className="lp-grad">more.</span>
            </h1>
            <p className="lp-hero__sub rise delay-2">
              Reclipse turns your lecture notes into flashcards and quizzes built on active
              recall, so class time is for listening, not transcribing.
            </p>
            <div className="lp-hero__actions rise delay-3">
              {signedIn ? (
                <>
                  <a href="/upload" className="btn btn--primary btn--lg">Create a study set</a>
                  <a href="/decks" className="btn btn--ghost btn--lg">My decks</a>
                </>
              ) : (
                <>
                  <a href="/login?mode=signup" className="btn btn--primary btn--lg">Get started free</a>
                  <a href="/login" className="btn btn--ghost btn--lg">I have an account</a>
                </>
              )}
            </div>
            <p className="lp-hero__note rise delay-3">
              Free while in early access · <a href="/demo">try a 30-second demo</a> first
            </p>
          </div>
          <div className="lp-hero__art lp-art2" aria-hidden="true">
            <div className="lp-art2__luna"><Mascot mood="happy" size={132} float /></div>
            <div className="card lp-art2__card">
              <div className="lp-art2__tag">Biology: cell energy</div>
              <div className="lp-art2__q">What does the mitochondria produce?</div>
              <div className="lp-art2__foot">
                <span>Tap to reveal</span>
                <span>24 cards</span>
              </div>
            </div>
            <div className="card lp-art2__goal">
              <GoalRing done={14} goal={18} pct={78} />
              <span className="badge badge--accent">3 day streak</span>
            </div>
          </div>
        </div>
      </header>

      {/* TRUST STRIP */}
      <div className="lp-strip">
        <div className="lp-strip__inner">
          {[
            [<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></>, 'Snap a photo of your notes'],
            [<><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/></>, 'Cards in seconds'],
            [<><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 3v6h6"/></>, 'Spaced repetition built in'],
            [<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5" fill="currentColor"/></>, 'Practice quizzes & mock exams'],
          ].map(([icon, t]) => (
            <div key={t} className="lp-strip__item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="section">
        <div className="section__inner">
          <div className="section__head">
            <h2>Three steps. About a minute.</h2>
            <p>No new system to learn. Use the notes you already have.</p>
          </div>
          <div className="lp-steps lp-steps--line">
            {[
              ['01', 'Upload', 'Drop in a PDF, snap a photo of your notes, or paste text.', 'violet'],
              ['02', 'We build it', 'Flashcards, fill-in-the-blanks and a quiz from your material.', 'amber'],
              ['03', 'Recall', 'Answers stay hidden until you commit. That\u2019s what makes it stick.', 'green'],
            ].map(([n, title, body, tone]) => (
              <div key={n} className="lp-step rise">
                <div className={`lp-step__num lp-step__num--${tone}`}>{n}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section section--tint">
        <div className="section__inner">
          <div className="section__head">
            <h2>Everything you need to actually learn it</h2>
            <p>Not just flashcards. A full study loop, built around how memory works.</p>
          </div>
          <div className="lp-bento">
            <div className="lp-feature rise lp-bento__lead">
              <div className="lp-feature__icon"><Icon path={<><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>} /></div>
              <div>
                <h3>Spaced repetition</h3>
                <p>Miss a card and it comes back sooner. Nail it and it fades. You review exactly what needs it.</p>
              </div>
              <div className="lp-intervals">
                <div className="lp-intervals__title">Review intervals</div>
                <div className="lp-intervals__bars">
                  {[['1d', 22], ['3d', 38], ['1w', 56], ['2w', 78], ['1mo', 100]].map(([l, h], i) => (
                    <div key={l} className="lp-intervals__col">
                      <div className="lp-intervals__bar" style={{ height: `${h}%`, opacity: 0.45 + i * 0.14 }} />
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {[
              [<><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>, 'Practice quizzes', 'Every set comes with a quiz that tests understanding, not just recognition.'],
              [<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>, 'Mock exams', 'Pull questions from any mix of decks into one timed exam. Simulate the real thing.'],
              [<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></>, 'Photo to flashcards', 'Snap handwritten notes or a whiteboard. We read them and build the cards.'],
              [<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></>, 'Study together', 'Share a deck with your group and build it together, or hand a friend a copy.'],
            ].map(([icon, title, body]) => (
              <div key={title} className="lp-feature rise">
                <div className="lp-feature__icon"><Icon path={icon} /></div>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </div>
            ))}
            <div className="lp-feature rise lp-bento__wide">
              <div className="lp-feature__icon"><Icon path={<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>} /></div>
              <div>
                <h3>Exam reminders</h3>
                <p>Upload your syllabus and we&apos;ll email you before each exam, quiz and lab.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SCIENCE */}
      <section className="section">
        <div className="section__inner lp-science">
          <div className="lp-science__copy">
            <h2 className="lp-quote">
              &ldquo;Rereading feels productive.<br />
              <span className="lp-grad">It mostly isn&apos;t.</span>&rdquo;
            </h2>
            <p>
              Decades of cognitive research keep finding the same thing: actively pulling an
              answer from memory strengthens it far more than looking it over again. It&apos;s
              called the testing effect, and Reclipse is built around it from the ground up.
            </p>
            <a href="https://doi.org/10.1126/science.1199327" target="_blank" rel="noopener" className="btn btn--ghost">
              Read the research &rarr;
            </a>
          </div>
          <div className="lp-science__art">
            <Mascot mood="thinking" size={220} float />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="lp-cta">
          <div className="lp-cta__copy">
            <h2>Ready to try it on this week&apos;s lecture?</h2>
            <p>Upload one set of notes and see what comes back. About a minute, start to finish.</p>
            <a href={signedIn ? '/upload' : '/login?mode=signup'} className="btn btn--accent btn--lg">
              {signedIn ? 'Create a study set' : 'Get started free'} &rarr;
            </a>
          </div>
          <div className="lp-cta__luna"><Mascot mood="celebrate" size={168} float /></div>
        </div>
      </section>
    </>
  );
}
