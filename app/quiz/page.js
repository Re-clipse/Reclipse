'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import LoadError from '@/components/LoadError';
import { withTimeout } from '@/lib/net';
import { useAuth } from '@/lib/useAuth';
import Mascot from '@/components/Mascot';
import { useCelebrate } from '@/components/Celebrate';
import { encourage } from '@/lib/encourage';
import { play } from '@/lib/sound';
import { getReferralCode } from '@/lib/referral';
import ReferralPrompt from '@/components/ReferralPrompt';

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
  const [reload, setReload] = useState(0);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState([]);
  const [referral, setReferral] = useState(null);
  const startedAt = useRef(Date.now());
  const logged = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (!deckId) { setStatus('empty'); return; }
    (async () => {
      try {
        const [{ data: d }, { data: q }] = await withTimeout(Promise.all([
          supabase.from('decks').select('*').eq('id', deckId).is('deleted_at', null).maybeSingle(),
          supabase.from('quiz_questions').select('*').eq('deck_id', deckId),
        ]), 12000, 'quiz');
        if (!d) { setStatus('error'); return; }
        setDeck(d); setQuestions(q || []);
        setStatus((q || []).length ? 'ready' : 'empty');
      } catch {
        // Timed out or offline: offer a retry rather than a skeleton that never ends.
        setStatus('failed');
      }
    })();
  }, [user, deckId, reload]);

  const q = questions[i];

  const choose = useCallback((idx, ev) => {
    if (picked !== null || !q) return;
    setPicked(idx);
    const ok = idx === q.correct_index;
    if (ok) { setCorrect((c) => c + 1); burst(ev?.currentTarget, { count: 22, power: 8 }); play('correct'); }
    else { setWrong((w) => [...w, { ...q, chosen: idx }]); play('wrong'); }

    supabase.from('quiz_responses').insert({
      user_id: user.id, question_id: q.id, deck_id: deckId, chosen_index: idx, correct: ok,
    }).then(({ error }) => { if (error) console.error('quiz_responses save failed:', error); });
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
      }).then(({ error }) => { if (error) console.error('study_sessions save failed:', error); });
      if (onboarding) {
        supabase.from('profiles')
          .upsert({ user_id: user.id, onboarded_at: new Date().toISOString() }, { onConflict: 'user_id' })
          .then(({ error }) => { if (error) console.error('onboarded_at save failed:', error); });
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

  // The onboarding tutorial quiz is a student's first real "aha" moment —
  // they just built and cleared their first deck — but until now nothing
  // celebrated it; the XP/achievement pop only ever ran on /stats, a page
  // a brand-new user has no reason to have visited yet.
  const [onboardingReward, setOnboardingReward] = useState(null);
  useEffect(() => {
    if (!finished || !onboarding) return;
    setOnboardingReward({ kind: 'Achievement unlocked', msg: 'First steps + Warm-up' });
    play('achieve');
    const t = setTimeout(() => cannon(), 200);
    const clear = setTimeout(() => setOnboardingReward(null), 4200);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, [finished, onboarding, cannon]);

  useEffect(() => {
    if (!finished || !onboarding) return;
    getReferralCode().then(setReferral);
  }, [finished, onboarding]);

  if (authLoading || status === 'loading') {
    return <main className="page"><div className="skeleton" style={{ height: 360 }} /></main>;
  }
  if (status === 'failed') {
    return <main className="page"><LoadError onRetry={() => { setStatus('loading'); setReload((n) => n + 1); }} /></main>;
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
          {onboardingReward && (
            <div className="reward-pop">
              <Mascot mood="excited" size={56} bounce />
              <div>
                <div className="reward-pop__t">{onboardingReward.kind}</div>
                <div className="reward-pop__m">{onboardingReward.msg}</div>
              </div>
            </div>
          )}
          <div className="progress u-mb-6"><div className="progress__bar" style={{ width: '100%' }} /></div>
          <div className="card center animate-in u-p-7">
            <div className="mascot-wrap">
              <Mascot mood="excited" size={120} bounce />
            </div>
            <span className="badge">Step 3 of 3: complete</span>
            <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--s-4)' }}>You&apos;re all set</h1>
            <p className="muted u-mt-3">
              Scored {correct} of {questions.length} on the tutorial quiz. Your first deck is saved.
              From here you can upload more notes, review on a schedule, or share a deck with your study group.
            </p>
            <div className="row actions-sm-stack u-row-center u-mt-6">
              <a href="/decks" className="btn btn--primary btn--lg">Go to my decks</a>
            </div>
          </div>

          <ReferralPrompt code={referral?.code} link={referral?.link}
            title="Studying with classmates? Invite them"
            note="Share your link — every friend who signs up raises your monthly AI-generation limit by 5, and if they later subscribe to Campus Archive, you both also get a discount." />
        </main>
      );
    }

    return (
      <main className="page page--narrow">
        <div className="card center animate-in u-p-7">
          <div className="mascot-wrap">
            <Mascot mood={pct >= 70 ? 'excited' : 'determined'} size={110} bounce />
          </div>
          <p className="muted small">You scored</p>
          <div className="score">{pct}%</div>
          <p className="muted u-mt-2">
            {correct} of {questions.length} correct
            {pct === 100 ? ' Perfect run.' : pct >= 70 ? ' Solid. Review the misses below.' : ' Worth another pass through the flashcards.'}
          </p>
          <p className="u-mt-3 u-accent-text">
            {encourage(pct === 100 ? 'perfectQuiz' : pct >= 70 ? 'goodQuiz' : 'toughQuiz', correct)}
          </p>
          <div className="row actions-sm-stack u-row-center u-mt-6">
            <button className="btn btn--primary" onClick={() => {
              setI(0); setPicked(null); setCorrect(0); setWrong([]); logged.current = false; startedAt.current = Date.now();
            }}>Retake</button>
            <a href={`/study?deck=${deckId}`} className="btn btn--ghost">Study flashcards</a>
            <a href="/decks" className="btn btn--quiet">My decks</a>
          </div>
        </div>

        {wrong.length > 0 && (
          <div className="u-mt-6">
            <h3 className="u-mb-4">What to review</h3>
            <div className="stack">
              {wrong.map((w) => (
                <div key={w.id} className="card">
                  <div style={{ fontWeight: 650, marginBottom: 'var(--s-2)' }}>{w.question}</div>
                  <p className="small" style={{ color: 'var(--error)' }}>You chose: {w.options[w.chosen]}</p>
                  <p className="small" style={{ color: 'var(--success)' }}>Correct: {w.options[w.correct_index]}</p>
                  {w.explanation && <p className="small muted u-mt-2">{w.explanation}</p>}
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
        <span className="small muted u-flex-none">{i + 1} / {questions.length}</span>
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
                {answered && idx === q.correct_index && <span className="sr-only"> — correct answer</span>}
                {answered && idx === picked && idx !== q.correct_index && <span className="sr-only"> — your answer, incorrect</span>}
              </button>
            );
          })}
        </div>
        {answered && (
          <>
            <div className="explain" role="status" aria-live="polite">
              <strong>{picked === q.correct_index ? 'Correct' : 'Not quite'}</strong>
              {q.explanation || 'No explanation was provided for this question.'}
            </div>
            <button className="btn btn--primary btn--block btn--lg u-mt-5"  onClick={next}>
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
