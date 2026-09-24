'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import LoadError from '@/components/LoadError';
import { useAuth } from '@/lib/useAuth';
import Mascot from '@/components/Mascot';
import { useCelebrate } from '@/components/Celebrate';
import { play } from '@/lib/sound';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
const LENGTHS = [10, 20, 30];
const MINUTES = [10, 20, 30, 45];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ExamPage() {
  const { user, loading: authLoading } = useAuth();
  const { cannon } = useCelebrate();

  const [decks, setDecks] = useState([]);
  const [chosen, setChosen] = useState(new Set());
  const [length, setLength] = useState(20);
  const [minutes, setMinutes] = useState(20);
  const [phase, setPhase] = useState('setup'); // setup | running | results
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [loadErr, setLoadErr] = useState('');
  const [decksFailed, setDecksFailed] = useState(false);
  const [decksReload, setDecksReload] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!user) return;
    setDecksFailed(false);
    supabase.from('decks')
      .select('id, title, quiz_questions(count)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { setDecksFailed(true); return; }
        setDecks((data || []).filter((d) => (d.quiz_questions?.[0]?.count ?? 0) > 0));
      })
      .catch(() => setDecksFailed(true));
  }, [user, decksReload]);

  const finish = useCallback(() => {
    setPhase('results');
    const score = questions.reduce((n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0), 0);
    if (user) {
      supabase.from('study_sessions').insert({
        user_id: user.id, kind: 'exam', reviewed: questions.length, correct: score,
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      }).then(({ error }) => { if (error) console.error('study_sessions save failed:', error); });
      const rows = questions.filter((q) => answers[q.id] !== undefined).map((q) => ({
        user_id: user.id, question_id: q.id, deck_id: q.deck_id,
        chosen_index: answers[q.id], correct: answers[q.id] === q.correct_index,
      }));
      if (rows.length) {
        supabase.from('quiz_responses').insert(rows)
          .then(({ error }) => { if (error) console.error('quiz_responses save failed:', error); });
      }
    }
  }, [questions, answers, user]);

  // Countdown
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { clearInterval(t); finish(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, finish]);

  async function start() {
    setLoadErr('');
    const ids = [...chosen];
    if (!ids.length) { setLoadErr('Pick at least one deck.'); return; }
    const { data } = await supabase.from('quiz_questions').select('*').in('deck_id', ids);
    if (!data?.length) { setLoadErr('Those decks have no quiz questions.'); return; }
    setQuestions(shuffle(data).slice(0, length));
    setAnswers({}); setI(0); setLeft(minutes * 60);
    startedAt.current = Date.now();
    setPhase('running');
  }

  const score = useMemo(
    () => questions.reduce((n, q) => n + (answers[q.id] === q.correct_index ? 1 : 0), 0),
    [questions, answers]
  );

  const examScore = questions.length ? Math.round((score / questions.length) * 100) : 0;
  useEffect(() => {
    if (phase === 'results' && examScore >= 70) { play('complete'); const t = setTimeout(() => cannon(), 250); return () => clearTimeout(t); } // exam-celebrate
  }, [phase, examScore, cannon]);

  if (authLoading) return <main className="page"><div className="skeleton" style={{ height: 300 }} /></main>;

  // ---------- Setup ----------
  if (phase === 'setup') {
    return (
      <main className="page">
        <PageHeader accent="orange" icon={ICONS.exam} title="Mock exam"
          subtitle="Timed, shuffled questions pulled from whichever decks you pick." />

        {decksFailed ? (
          <LoadError message="We couldn't load your decks." onRetry={() => setDecksReload((n) => n + 1)} />
        ) : decks.length === 0 ? (
          <div className="empty">
            <h3>No quiz questions yet</h3>
            <p>Create a study set first — it&apos;ll show up here as a deck. Most sets include quiz questions, but not all do.</p>
            <a href="/upload" className="btn btn--primary">Create a study set</a>
          </div>
        ) : (
          <div className="stack" style={{ gap: 'var(--s-5)' }}>
            <div className="card stack">
              <label className="label">Decks to draw from</label>
              <div className="pills">
                {decks.map((d) => (
                  <button key={d.id} className={`pill${chosen.has(d.id) ? ' pill--on' : ''}`}
                          onClick={() => setChosen((s) => {
                            const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n;
                          })}>
                    {d.title} ({d.quiz_questions[0].count})
                  </button>
                ))}
              </div>
              <button className="btn btn--quiet" style={{ alignSelf: 'flex-start' }}
                      onClick={() => setChosen(new Set(decks.map((d) => d.id)))}>Select all</button>
            </div>

            <div className="card stack">
              <label className="label">Questions</label>
              <div className="pills">
                {LENGTHS.map((n) => (
                  <button key={n} className={`pill${length === n ? ' pill--on' : ''}`}
                          onClick={() => setLength(n)}>{n}</button>
                ))}
              </div>
              <label className="label u-mt-3">Time limit</label>
              <div className="pills">
                {MINUTES.map((n) => (
                  <button key={n} className={`pill${minutes === n ? ' pill--on' : ''}`}
                          onClick={() => setMinutes(n)}>{n} min</button>
                ))}
              </div>
            </div>

            {loadErr && <div role="alert" className="alert alert--error">{loadErr}</div>}
            <button className="btn btn--primary btn--lg" onClick={start}>Start exam</button>
          </div>
        )}
      </main>
    );
  }

  // ---------- Results ----------
  if (phase === 'results') {
    const pct = questions.length ? Math.round((score / questions.length) * 100) : 0;
    const missed = questions.filter((q) => answers[q.id] !== q.correct_index);
    return (
      <main className="page page--narrow">
        <div className="card center animate-in u-p-7">
          <div className="mascot-wrap">
            <Mascot mood={pct >= 70 ? 'excited' : 'determined'} size={130} full bounce />
          </div>
          <p className="muted small">Exam score</p>
          <div className="score">{pct}%</div>
          <p className="muted u-mt-2">
            {score} of {questions.length} correct
            {left === 0 ? ' · time ran out' : ''}
          </p>
          <div className="row actions-sm-stack u-row-center u-mt-6">
            <button className="btn btn--primary" onClick={() => setPhase('setup')}>New exam</button>
            <a href="/stats" className="btn btn--ghost">See progress</a>
          </div>
        </div>

        {missed.length > 0 && (
          <div className="u-mt-6">
            <h3 className="u-mb-4">Review these ({missed.length})</h3>
            <div className="stack">
              {missed.map((q) => (
                <div key={q.id} className="card">
                  <div style={{ fontWeight: 650, marginBottom: 'var(--s-2)' }}>{q.question}</div>
                  <p className="small" style={{ color: 'var(--error)' }}>
                    {answers[q.id] === undefined ? 'Not answered' : `You chose: ${q.options[answers[q.id]]}`}
                  </p>
                  <p className="small" style={{ color: 'var(--success)' }}>Correct: {q.options[q.correct_index]}</p>
                  {q.explanation && <p className="small muted u-mt-2">{q.explanation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    );
  }

  // ---------- Running ----------
  const q = questions[i];
  const opts = Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]');
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <main className="page page--narrow">
      <div className="study__bar">
        <span className={`timer${left < 60 ? ' timer--low' : ''}`}>{mm}:{ss}</span>
        <div className="progress"><div className="progress__bar" style={{ width: `${(i / questions.length) * 100}%` }} /></div>
        <span className="small muted u-flex-none">{i + 1}/{questions.length}</span>
      </div>

      <div className="card animate-in" key={i}>
        <p className="q__text">{q.question}</p>
        <div className="options">
          {opts.map((opt, idx) => (
            <button key={idx}
                    className={`option${answers[q.id] === idx ? ' option--selected' : ''}`}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}>
              <span className="option__key">{KEYS[idx]}</span><span>{opt}</span>
            </button>
          ))}
        </div>
        <div className="row u-mt-5">
          <button className="btn btn--ghost" disabled={i === 0} onClick={() => setI((n) => n - 1)}>Back</button>
          {i + 1 < questions.length
            ? <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => setI((n) => n + 1)}>Next</button>
            : <button className="btn btn--got" style={{ flex: 1 }} onClick={finish}>Submit exam</button>}
        </div>
        <p className="small muted center u-mt-3">
          {Object.keys(answers).length} of {questions.length} answered. You can go back and change answers.
        </p>
      </div>
    </main>
  );
}
