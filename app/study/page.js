'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { schedule, previewInterval } from '@/lib/srs';
import Mascot from '@/components/Mascot';
import { useCelebrate } from '@/components/Celebrate';
import { encourage } from '@/lib/encourage';
import { play } from '@/lib/sound';
import LoadError from '@/components/LoadError';
import { withTimeout } from '@/lib/net';

const RATINGS = [
  { v: 0, label: 'Again', cls: 'btn--again' },
  { v: 1, label: 'Hard', cls: 'btn--again' },
  { v: 2, label: 'Good', cls: 'btn--primary' },
  { v: 3, label: 'Easy', cls: 'btn--got' },
];

function StudyInner() {
  const params = useSearchParams();
  const deckId = params.get('deck');
  const dueOnly = params.get('mode') === 'due';
  const { user, loading: authLoading } = useAuth();
  const { cannon } = useCelebrate();

  const [deck, setDeck] = useState(null);
  const [queue, setQueue] = useState([]);
  const [progress, setProgress] = useState({}); // flashcard_id -> srs row
  const [total, setTotal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState('loading');
  const [reload, setReload] = useState(0);
  const [done, setDone] = useState(0);
  const [again, setAgain] = useState(0);
  const startedAt = useRef(Date.now());
  const logged = useRef(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
     try {
      let cards = [];
      if (dueOnly) {
        const { data: prog } = await supabase.from('card_progress')
          .select('*').lte('due_at', new Date().toISOString()).limit(2000);
        const ids = (prog || []).map((p) => p.flashcard_id);
        if (!ids.length) { setStatus('empty'); return; }
        const { data } = await supabase.from('flashcards').select('*').in('id', ids);
        cards = data || [];
        setProgress(Object.fromEntries((prog || []).map((p) => [p.flashcard_id, p])));
      } else {
        if (!deckId) { setStatus('empty'); return; }
        const [{ data: d }, { data: c }] = await Promise.all([
          supabase.from('decks').select('*').eq('id', deckId).is('deleted_at', null).maybeSingle(),
          supabase.from('flashcards').select('*').eq('deck_id', deckId).order('created_at'),
        ]);
        if (!d) { setStatus('error'); return; }
        setDeck(d);
        cards = c || [];
        // Scoped to this deck's own cards — fetching the user's whole SRS
        // history here (across every deck they've ever studied) was wasted
        // work that only grows with how long someone's used the app.
        const cardIds = cards.map((x) => x.id);
        const { data: prog } = cardIds.length
          ? await supabase.from('card_progress').select('*').in('flashcard_id', cardIds)
          : { data: [] };
        setProgress(Object.fromEntries((prog || []).map((p) => [p.flashcard_id, p])));
      }
      if (!cards.length) { setStatus('empty'); return; }
      setQueue(cards); setTotal(cards.length); setStatus('ready');
     } catch {
      setStatus('failed');
     }
    })();
  }, [user, deckId, dueOnly, reload]);

  const current = queue[0];

  const grade = useCallback(async (rating) => {
    if (!current) return;
    play(rating >= 2 ? 'correct' : 'next');
    const next = schedule(progress[current.id], rating);
    setProgress((p) => ({ ...p, [current.id]: next }));
    setRevealed(false);

    if (rating < 2) {
      setAgain((n) => n + 1);
      setQueue((q) => [...q.slice(1), q[0]]);   // relearn this session
    } else {
      setDone((n) => n + 1);
      setQueue((q) => q.slice(1));
    }

    supabase.from('card_progress').upsert(
      { user_id: user.id, flashcard_id: current.id, ...next },
      { onConflict: 'user_id,flashcard_id' }
    ).then(({ error }) => { if (error) console.error('card_progress save failed:', error); });
  }, [current, progress, user]);

  // Log the session once, when the queue empties.
  useEffect(() => {
    if (status === 'ready' && queue.length === 0 && total > 0 && !logged.current && user) {
      logged.current = true;
      supabase.from('study_sessions').insert({
        user_id: user.id, deck_id: deckId || null, kind: 'flashcards',
        reviewed: total + again, correct: total,
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      }).then(({ error }) => { if (error) console.error('study_sessions save failed:', error); });
    }
  }, [status, queue.length, total, again, user, deckId]);

  // Celebrate finishing a study session.
  const sessionDone = status === 'ready' && queue.length === 0 && total > 0;
  useEffect(() => {
    if (!sessionDone) return;
    play('complete'); const t = setTimeout(() => cannon(), 250); return () => clearTimeout(t); // study-celebrate
  }, [sessionDone, cannon]);

  useEffect(() => {
    function onKey(e) {
      if (status !== 'ready' || !queue.length) return;
      if (e.code === 'Space') { e.preventDefault(); setRevealed((r) => !r); return; }
      if (revealed && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) - 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, queue.length, revealed, grade]);

  const previews = useMemo(
    () => (current ? RATINGS.map((r) => previewInterval(progress[current.id], r.v)) : []),
    [current, progress]
  );

  if (authLoading || status === 'loading') {
    return <main className="page"><div className="skeleton" style={{ height: 360 }} /></main>;
  }
  if (status === 'failed') {
    return <main className="page"><LoadError onRetry={() => { setStatus('loading'); setReload((n) => n + 1); }} /></main>;
  }
  if (status === 'error') {
    return <main className="page"><div className="empty">
      <h3>We couldn&apos;t open that deck</h3><p>It may have been deleted.</p>
      <a href="/decks" className="btn btn--primary">Back to my decks</a></div></main>;
  }
  if (status === 'empty') {
    return <main className="page"><div className="empty">
      <h3>{dueOnly ? 'Nothing due right now' : 'This deck has no cards'}</h3>
      <p>{dueOnly ? 'Come back later, or study a deck directly.' : 'Add cards to this deck, or generate a new set.'}</p>
      {!dueOnly && deckId
        ? <a href={`/deck/${deckId}`} className="btn btn--primary">Add cards</a>
        : <a href="/decks" className="btn btn--primary">My decks</a>}
    </div></main>;
  }

  if (queue.length === 0) {
    const mins = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    return (
      <main className="page page--narrow">
        <div className="card center animate-in" style={{ padding: 'var(--s-7)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-2)' }}>
            <Mascot mood="excited" size={140} full bounce />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>Session complete</h1>
          <p className="muted" style={{ marginTop: 'var(--s-3)' }}>
            {total} card{total === 1 ? '' : 's'} in about {mins} minute{mins === 1 ? '' : 's'}.
            {again > 0 ? ` ${again} needed a second look, so they'll show up again in your reviews sooner than the rest.` : ' Clean run.'}
          </p>
          <p style={{ marginTop: 'var(--s-3)', fontWeight: 600, color: 'var(--violet-700)' }}>
            {encourage('sessionDone', total + again)}
          </p>
          <div className="row actions-sm-stack" style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: 'var(--s-6)' }}>
            {deckId && <a href={`/quiz?deck=${deckId}`} className="btn btn--primary">Take the quiz</a>}
            <a href="/decks" className="btn btn--ghost">My decks</a>
            <a href="/stats" className="btn btn--quiet">See progress</a>
          </div>
        </div>
      </main>
    );
  }

  const pct = total ? ((total - queue.length) / total) * 100 : 0;
  const isCloze = current.card_type === 'cloze';

  return (
    <main className="page page--narrow">
      <div className="study__bar">
        <a href="/decks" className="btn btn--quiet study__back" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
        </a>
        <div className="progress"><div className="progress__bar" style={{ width: `${pct}%` }} /></div>
        <span className="small muted" style={{ flex: 'none' }}>{queue.length} left</span>
      </div>

      <h2 className="study__title">
        {dueOnly ? 'Due for review' : deck?.title}
      </h2>

      <div className={`flip flip--stack${revealed ? ' flip--revealed' : ''}`}>
        <div className="flip__stack flip__stack--2" aria-hidden="true" />
        <div className="flip__stack flip__stack--1" aria-hidden="true" />
        {/* Space is handled by the window-level listener above (works from anywhere on
            the page); this only adds Enter, since a role="button" element is expected
            to respond to both, and the global listener only checks for Space. */}
        <div className="flip__inner" onClick={() => { setRevealed((r) => !r); play('flip'); }} role="button" tabIndex={0}
             onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setRevealed((r) => !r); play('flip'); } }}>
          <div className="flip__face">
            <span className="flip__label">{isCloze ? 'Fill in the blank' : 'Question'}</span>
            <p className="flip__text">{current.question}</p>
            <span className="flip__cue">Answer out loud first, then press <span className="kbd">Space</span> to flip</span>
          </div>
          <div className="flip__face flip__face--back">
            <span className="flip__label">Answer</span>
            <p className="flip__text">{current.answer}</p>
          </div>
        </div>
      </div>

      {revealed ? (
        <div className="animate-in">
          <p className="small muted grade__prompt">How well did you know it?</p>
          <div className="grade">
            {RATINGS.map((r, i) => (
              <button key={r.v} className={`btn grade__btn ${r.cls}`} onClick={() => grade(r.v)}>
                <span className="grade__label">{r.label}</span>
                <span className="grade__meta">
                  {previews[i]} <span className="kbd" aria-hidden="true">{r.v + 1}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button className="btn btn--primary btn--block btn--lg" onClick={() => { setRevealed(true); play('flip'); }}>
          Show answer
        </button>
      )}
    </main>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<main className="page"><div className="skeleton" style={{ height: 360 }} /></main>}>
      <StudyInner />
    </Suspense>
  );
}
