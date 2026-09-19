'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import Mascot from '@/components/Mascot';
import { useCelebrate } from '@/components/Celebrate';
import { encourage } from '@/lib/encourage';
import { play } from '@/lib/sound';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

function QuizInner() {
  const params = useSearchParams();
  const deckId = params.get('deck');
  const onboarding = params.get('onboarding') === '1';
  const { user, loading: authLoading } = useAuth();
  const { burst, cannon } = useCelebrate();

  const [deck, setDeck] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState([]);
  const startedAt = useRef(Date.now());
  const logged = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (!deckId) { setStatus('empty'); return; }
    (async () => {
      const [{ data: d }, { data: q }] = await Promise.all([
        supabase.from('decks').select('*').eq('id', deckId).maybeSingle(),
        supabase.from('quiz_questions').select('*').eq('deck_id', deckId),
      ]);
      if (!d) { setStatus('error'); return; }
      setDeck(d); setQuestions(q || []);
      setStatus((q || []).length ? 'ready' : 'empty');
    })();
  }, [user, deckId]);

  const q = questions[i];

  const choose = useCallback((idx, ev) => {
    if (picked !== null || !q) return;
    setPicked(idx);
    const ok = idx === q.correct_index;
    if (ok) { setCorrect((c) => c + 1); burst(ev?.currentTarget, { count: 22, power: 8 }); play('correct'); }
    else { setWrong((w) => [...w, { ...q, chosen: idx }]); play('wrong'); }

    supabase.from('quiz_responses').insert({
      user_id: user.id, question_id: q.id, deck_id: deckId, chosen_index: idx, correct: ok,
    }).then(() => {});
  }, [picked, q, user, deckId]);

  const next = useCallback(() => { setPicked(null); setI((n) => n + 1); play('next'); }, []);

  useEffect(() => {
    function onKey(e) {
      if (status !== 'ready' || !q) return;
      if (picked === null) {
        const idx = KEYS.indexOf(e.key.toUpperCase());
        if (idx >= 0 && idx < (q.options?.length || 0)) choose(idx);
      } else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); next(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, q, picked, choose, next]);

  useEffect(() => {
    if (status === 'ready' && questions.length && i >= questions.length && !logged.current && user) {
      logged.current = true;
      supabase.from('study_sessions').insert({
        user_id: user.id, deck_id: deckId, kind: 'quiz',
        reviewed: questions.length, correct,
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      }).then(() => {});
      if (onboarding) {
        supabase.from('profiles')
          .upsert({ user_id: user.id, onboarded_at: new Date().toISOString() }, { onConflict: 'user_id' })
          .then(() => {});
      }
    }
  }, [status, i, questions.length, correct, user, deckId, onboarding]);

  // Celebrate a strong result once, when the results screen appears.
  const finished = status === 'ready' && questions.length > 0 && i >= questions.length;
  useEffect(() => {
    if (!finished) return;
    const pctNow = Math.round((correct / questions.length) * 100);
    if (pctNow >= 70) { play('complete'); const t = setTimeout(() => cannon(), 250); return () => clearTimeout(t); } // quiz-celebrate
  }, [finished, correct, questions.length, cannon]);

  if (authLoading || status === 'loading') {
    return <main className="page"><div className="skeleton" style={{ height: 360 }} /></main>;
  }
  if (status === 'error') {
    return <main className="page"><div className="empty"><h3>We couldn&apos;t open that quiz</h3>
      <a href="/decks" className="btn btn--primary">Back to my decks</a></div></main>;
  }
  if (status === 'empty') {
    return <main className="page"><div className="empty"><h3>No quiz questions here</h3>
      <p>Generate a new study set to get a quiz.</p>
      <a href="/upload" className="btn btn--primary">Create a study set</a></div></main>;
  }

  if (i >= questions.length) {
    const pct = Math.round((correct / questions.length) * 100);

    if (onboarding) {
      return (
        <main className="page page--narrow">
          <div className="progress" style={{ marginBottom: 'var(--s-6)' }}><div className="progress__bar" style={{ width: '100%' }} /></div>
          <div className="card center animate-in" style={{ padding: 'var(--s-7)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
              <Mascot mood="excited" size={120} bounce />
            </div>
            <span className="badge">Step 3 of 3 — complete</span>
            <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--s-4)' }}>You&apos;re all set</h1>
            <p className="muted" style={{ marginTop: 'var(--s-3)' }}>
              Scored {correct} of {questions.length} on the tutorial quiz. Your first deck is saved —
              from here you can upload more notes, review on a schedule, or share a deck with your study group.
            </p>
            <div className="row actions-sm-stack" style={{ justifyContent: 'center', marginTop: 'var(--s-6)' }}>
              <a href="/decks" className="btn btn--primary btn--lg">Go to my decks</a>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="page page--narrow">
        <div className="card center animate-in" style={{ padding: 'var(--s-7)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
            <Mascot mood={pct >= 70 ? 'excited' : 'determined'} size={110} bounce />
          </div>
          <p className="muted small">You scored</p>
          <div className="score">{pct}%</div>
          <p className="muted" style={{ marginTop: 'var(--s-2)' }}>
            {correct} of {questions.length} correct
            {pct === 100 ? ' — perfect run.' : pct >= 70 ? ' — solid. Review the misses below.' : ' — worth another pass through the flashcards.'}
          </p>
          <p style={{ marginTop: 'var(--s-3)', fontWeight: 600, color: 'var(--violet-700)' }}>
            {encourage(pct === 100 ? 'perfectQuiz' : pct >= 70 ? 'goodQuiz' : 'toughQuiz', correct)}
          </p>
          <div className="row actions-sm-stack" style={{ justifyContent: 'center', marginTop: 'var(--s-6)' }}>
            <button className="btn btn--primary" onClick={() => {
              setI(0); setPicked(null); setCorrect(0); setWrong([]); logged.current = false; startedAt.current = Date.now();
            }}>Retake</button>
            <a href={`/study?deck=${deckId}`} className="btn btn--ghost">Study flashcards</a>
            <a href="/decks" className="btn btn--quiet">My decks</a>
          </div>
        </div>

        {wrong.length > 0 && (
          <div style={{ marginTop: 'var(--s-6)' }}>
            <h3 style={{ marginBottom: 'var(--s-4)' }}>What to review</h3>
            <div className="stack">
              {wrong.map((w) => (
                <div key={w.id} className="card">
                  <div style={{ fontWeight: 650, marginBottom: 'var(--s-2)' }}>{w.question}</div>
                  <p className="small" style={{ color: 'var(--error)' }}>You chose: {w.options[w.chosen]}</p>
                  <p className="small" style={{ color: 'var(--success)' }}>Correct: {w.options[w.correct_index]}</p>
                  {w.explanation && <p className="small muted" style={{ marginTop: 'var(--s-2)' }}>{w.explanation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    );
  }

  const options = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
  const answered = picked !== null;

  return (
    <main className="page page--narrow">
      <div className="study__bar">
        <a href="/decks" className="btn btn--quiet" aria-label="Back">←</a>
        <div className="progress"><div className="progress__bar" style={{ width: `${(i / questions.length) * 100}%` }} /></div>
        <span className="small muted" style={{ flex: 'none' }}>{i + 1} / {questions.length}</span>
      </div>

      <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--s-4)' }}>{deck?.title}</h2>

      <div className="card animate-in" key={i}>
        <p className="q__text">{q.question}</p>
        <div className="options">
          {options.map((opt, idx) => {
            let cls = 'option';
            if (answered) {
              if (idx === q.correct_index) cls += ' option--correct';
              else if (idx === picked) cls += ' option--wrong';
              else cls += ' option--muted';
            }
            return (
              <button key={idx} className={cls} onClick={(ev) => choose(idx, ev)} disabled={answered}>
                <span className="option__key">{KEYS[idx]}</span><span>{opt}</span>
              </button>
            );
          })}
        </div>
        {answered && (
          <>
            <div className="explain">
              <strong>{picked === q.correct_index ? 'Correct' : 'Not quite'}</strong>
              {q.explanation || 'No explanation was provided for this question.'}
            </div>
            <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 'var(--s-5)' }} onClick={next}>
              {i + 1 === questions.length ? 'See results' : 'Next question'} <span className="kbd hide-sm">Enter</span>
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<main className="page"><div className="skeleton" style={{ height: 360 }} /></main>}>
      <QuizInner />
    </Suspense>
  );
}
