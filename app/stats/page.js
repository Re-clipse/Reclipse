'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { streakFrom, activityByDay, pct } from '@/lib/stats';
import { withTimeout } from '@/lib/net';
import LoadError from '@/components/LoadError';
import { useCelebrate } from '@/components/Celebrate';
import { play } from '@/lib/sound';
import Mascot from '@/components/Mascot';
import { LevelCard, GoalRing, Achievements } from '@/components/Rewards';
import { computeXp, levelFromXp, cardsToday, evaluateAchievements } from '@/lib/rewards';

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const { cannon } = useCelebrate();
  const [rewardPop, setRewardPop] = useState(null);
  const seenLevel = useRef(null);
  const [sessions, setSessions] = useState(null);
  const [responses, setResponses] = useState([]);
  const [decks, setDecks] = useState([]);
  const [due, setDue] = useState(0);
  const [known, setKnown] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    try {
      const [s, r, d, p] = await withTimeout(Promise.all([
        supabase.from('study_sessions').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('quiz_responses').select('deck_id, correct').limit(2000),
        supabase.from('decks').select('id, title'),
        supabase.from('card_progress').select('due_at, interval_days'),
      ]), 12000, 'stats');
      setSessions(s.data || []);
      setResponses(r.data || []);
      setDecks(d.data || []);
      const now = Date.now();
      setDue((p.data || []).filter((x) => new Date(x.due_at).getTime() <= now).length);
      setKnown((p.data || []).filter((x) => x.interval_days >= 7).length);
    } catch {
      setFailed(true);
      setSessions([]);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const streak = useMemo(() => streakFrom((sessions || []).map((s) => s.created_at)), [sessions]);
  const activity = useMemo(() => activityByDay((sessions || []).map((s) => s.created_at)), [sessions]);

  const totals = useMemo(() => {
    const list = sessions || [];
    const reviewed = list.reduce((n, s) => n + (s.reviewed || 0), 0);
    const minutes = Math.round(list.reduce((n, s) => n + (s.duration_seconds || 0), 0) / 60);
    const quizzes = list.filter((s) => s.kind !== 'flashcards');
    const qCorrect = quizzes.reduce((n, s) => n + (s.correct || 0), 0);
    const qTotal = quizzes.reduce((n, s) => n + (s.reviewed || 0), 0);
    return { reviewed, minutes, accuracy: pct(qCorrect, qTotal), sessions: list.length };
  }, [sessions]);

  const rewards = useMemo(() => {
    const list = sessions || [];
    const xp = computeXp({ sessions: list, responses });
    const lvl = levelFromXp(xp);
    const goal = cardsToday(list, 20);
    const quizzes = list.filter((s) => s.kind !== 'flashcards');
    const perfectQuiz = quizzes.some((s) => s.reviewed > 0 && s.correct === s.reviewed);
    const stats = {
      xp, level: lvl.level, decks: decks.length, sessions: list.length,
      reviewed: list.reduce((n, s) => n + (s.reviewed || 0), 0),
      streak, quizzes: quizzes.length, perfectQuiz,
    };
    return { xp, lvl, goal, achievements: evaluateAchievements(stats) };
  }, [sessions, responses, decks, streak]);

  // Celebrate reaching a new level — compares against the last level we saw
  // stored locally, so it fires once per genuine level-up, not on every visit.
  useEffect(() => {
    if (!rewards) return;
    const lvl = rewards.lvl.level;
    let prev = null;
    try { prev = Number(localStorage.getItem('reclipse-level')) || null; } catch {}
    if (prev !== null && lvl > prev && seenLevel.current !== lvl) {
      seenLevel.current = lvl;
      setRewardPop({ kind: 'Level up', msg: `You reached level ${lvl}` });
      play('levelup');
      setTimeout(() => cannon(), 200);
      setTimeout(() => setRewardPop(null), 4200);
    }
    try { localStorage.setItem('reclipse-level', String(lvl)); } catch {}
  }, [rewards, cannon]);

  // Celebrate a newly unlocked achievement (compares count to last seen).
  useEffect(() => {
    if (!rewards) return;
    const now = rewards.achievements.filter((a) => a.unlocked).length;
    let prev = null;
    try { prev = Number(localStorage.getItem('reclipse-ach')) || 0; } catch {}
    if (prev !== null && now > prev) {
      const latest = [...rewards.achievements].reverse().find((a) => a.unlocked);
      setRewardPop({ kind: 'Achievement unlocked', msg: latest ? latest.title : 'New badge' });
      play('achieve');
      setTimeout(() => setRewardPop(null), 4200); // ach-unlock
    }
    try { localStorage.setItem('reclipse-ach', String(now)); } catch {}
  }, [rewards]);

  // Weak spots: decks where quiz accuracy is lowest (min 3 answers to count).
  const weak = useMemo(() => {
    const by = new Map();
    for (const r of responses) {
      if (!r.deck_id) continue;
      const cur = by.get(r.deck_id) || { n: 0, ok: 0 };
      cur.n += 1; cur.ok += r.correct ? 1 : 0;
      by.set(r.deck_id, cur);
    }
    return [...by.entries()]
      .filter(([, v]) => v.n >= 3)
      .map(([id, v]) => ({
        id, n: v.n, accuracy: pct(v.ok, v.n),
        title: decks.find((d) => d.id === id)?.title || 'Deleted deck',
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }, [responses, decks]);

  if (authLoading || sessions === null) {
    return <main className="page"><div className="skeleton" style={{ height: 400 }} /></main>;
  }

  if (failed) {
    return <main className="page"><LoadError onRetry={() => { setSessions(null); load(); }} /></main>;
  }

  if (sessions.length === 0) {
    return (
      <main className="page">
        <h1 style={{ marginBottom: 'var(--s-5)' }}>Progress</h1>
        <div className="empty">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
            <Mascot mood="sleepy" size={92} />
          </div>
          <h3>No study history yet</h3>
          <p>Finish a study session or a quiz and your stats will show up here.</p>
          <a href="/decks" className="btn btn--primary">Go study</a>
        </div>
      </main>
    );
  }

  const max = Math.max(1, ...activity.map((a) => a.count));

  return (
    <main className="page">
      {rewardPop && (
        <div className="reward-pop">
          <Mascot mood="excited" size={56} bounce />
          <div>
            <div className="reward-pop__t">{rewardPop.kind}</div>
            <div className="reward-pop__m">{rewardPop.msg}</div>
          </div>
        </div>
      )}
      <PageHeader accent="pink" icon={ICONS.stats} title="Progress"
        subtitle={streak > 0 ? `${streak}-day streak — keep it alive` : 'Study today to start a streak'}
        action={due > 0 ? <a href="/study?mode=due" className="btn btn--accent">Review {due} due</a> : null} />

      <div className="grid grid--2" style={{ marginBottom: 'var(--s-5)' }}>
        <LevelCard level={rewards.lvl.level} pct={rewards.lvl.pct} into={rewards.lvl.into}
                   span={rewards.lvl.span} xp={rewards.xp} />
        <div className="card" style={{ display: 'flex', alignItems: 'center' }}>
          <GoalRing done={rewards.goal.done} goal={rewards.goal.goal} pct={rewards.goal.pct} />
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat"><div className="stat__n">{totals.reviewed}</div><div className="stat__l">Cards reviewed</div></div>
        <div className="card stat"><div className="stat__n">{totals.accuracy}%</div><div className="stat__l">Quiz accuracy</div></div>
        <div className="card stat"><div className="stat__n">{known}</div><div className="stat__l">Cards known</div></div>
        <div className="card stat"><div className="stat__n">{totals.minutes}m</div><div className="stat__l">Time studied</div></div>
      </div>

      <div style={{ marginBottom: 'var(--s-5)' }}>
        <Achievements items={rewards.achievements} />
      </div>

      <div className="card" style={{ marginBottom: 'var(--s-5)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--s-4)' }}>Last 4 weeks</h3>
        <div className="activity">
          {activity.map((a) => {
            const level = a.count === 0 ? 0 : a.count >= max * 0.66 ? 3 : a.count >= max * 0.33 ? 2 : 1;
            return <div key={a.date} className="activity__day" data-level={level}
                        title={`${a.date}: ${a.count} session${a.count === 1 ? '' : 's'}`} />;
          })}
        </div>
        <p className="small muted" style={{ marginTop: 'var(--s-3)' }}>
          {totals.sessions} session{totals.sessions === 1 ? '' : 's'} total.
        </p>
      </div>

      {weak.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--s-2)' }}>Where you&apos;re weakest</h3>
          <p className="small muted" style={{ marginBottom: 'var(--s-4)' }}>
            Quiz accuracy by deck, lowest first. Only decks you&apos;ve answered 3+ questions in.
          </p>
          {weak.map((w) => (
            <div key={w.id} className="bar-row">
              <a className="bar-row__label" href={`/study?deck=${w.id}`}>{w.title}</a>
              <div className="bar-row__track">
                <div className="bar-row__fill" style={{
                  width: `${w.accuracy}%`,
                  background: w.accuracy < 50 ? 'var(--error)' : w.accuracy < 75 ? 'var(--yellow-400)' : 'var(--violet-600)',
                }} />
              </div>
              <span className="bar-row__val">{w.accuracy}%</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
