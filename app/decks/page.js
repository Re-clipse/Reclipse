'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { streakFrom } from '@/lib/stats';
import { cardsToday } from '@/lib/rewards';
import { GoalRing } from '@/components/Rewards';
import Mascot from '@/components/Mascot';
import PageHeader, { ICONS } from '@/components/PageHeader';
import Modal from '@/components/Modal';
import LoadError from '@/components/LoadError';
import { withTimeout } from '@/lib/net';

export default function DecksPage() {
  const { user, loading: authLoading } = useAuth();
  const [decks, setDecks] = useState(null);
  const [courses, setCourses] = useState([]);
  const [due, setDue] = useState(0);
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState({ done: 0, goal: 20, pct: 0 });
  const [q, setQ] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [error, setError] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [showCourse, setShowCourse] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const [decksRes, coursesRes, dueRes, sessRes] = await withTimeout(Promise.all([
        supabase.from('decks')
          .select('id, title, created_at, course_id, is_public, flashcards(count), quiz_questions(count)')
          .order('created_at', { ascending: false }),
        supabase.from('courses').select('*').order('name'),
        supabase.from('card_progress').select('flashcard_id', { count: 'exact', head: true })
          .lte('due_at', new Date().toISOString()),
        supabase.from('study_sessions').select('created_at').order('created_at', { ascending: false }).limit(400),
      ]), 12000, 'decks');

      if (decksRes.error) { setError("We couldn't load your decks."); setDecks([]); return; }
      setDecks(decksRes.data || []);
      setCourses(coursesRes.data || []);
      setDue(dueRes.count || 0);
      const sess = sessRes.data || [];
      setStreak(streakFrom(sess.map((s) => s.created_at)));
      setGoal(cardsToday(sess, 20));
    } catch {
      // Timed out or network failure — show the retry UI rather than a stuck skeleton.
      setError("We couldn't load your decks — this is usually a connection hiccup.");
      setDecks([]);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function addCourse(e) {
    e.preventDefault();
    const name = newCourse.trim();
    if (!name) return;
    const { data, error } = await supabase.from('courses')
      .insert({ user_id: user.id, name }).select().single();
    if (!error && data) { setCourses((c) => [...c, data].sort((a, b) => a.name.localeCompare(b.name))); }
    setNewCourse(''); setShowCourse(false);
  }

  async function remove(id, title) {
    if (!confirm(`Delete "${title}"? This removes its flashcards and quiz too.`)) return;
    setDecks((d) => d.filter((x) => x.id !== id));
    const { error } = await supabase.from('decks').delete().eq('id', id);
    if (error) { setError("That deck couldn't be deleted."); load(); }
  }

  const visible = useMemo(() => {
    if (!decks) return null;
    const needle = q.trim().toLowerCase();
    return decks.filter((d) => {
      const okCourse = courseFilter === 'all'
        || (courseFilter === 'none' ? !d.course_id : d.course_id === courseFilter);
      const okText = !needle || d.title.toLowerCase().includes(needle);
      return okCourse && okText;
    });
  }, [decks, q, courseFilter]);

  if (authLoading) return <main className="page"><div className="skeleton" style={{ height: 300 }} /></main>;

  return (
    <main className="page">
      <PageHeader
        accent="violet" icon={ICONS.decks} title="My decks"
        subtitle="Turn your notes into cards, then let spaced repetition do the rest."
        action={<>
          {due > 0 && <a href="/study?mode=due" className="btn btn--accent">Review {due} due</a>}
          <a href="/upload" className="btn btn--page">+ New set</a>
        </>}
      />

      {decks && decks.length > 0 && goal.done > 0 && !goal.met && (
        <div className="card" style={{ marginBottom: 'var(--s-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--s-4)' }}>
          <GoalRing done={goal.done} goal={goal.goal} pct={goal.pct} />
          <a href="/study?mode=due" className="btn btn--accent">Keep going</a>
        </div>
      )}
      {decks && decks.length > 0 && goal.met && (
        <div className="card" style={{ marginBottom: 'var(--s-4)', display: 'flex', alignItems: 'center', gap: 'var(--s-4)' }}>
          <GoalRing done={goal.done} goal={goal.goal} pct={goal.pct} />
          <div><strong>Daily goal hit</strong><p className="small muted">Nice work today — anything extra is a bonus.</p></div>
        </div>
      )}

      {decks && decks.length > 0 && (
        <div className="chips">
          <div className={`chip-stat${streak > 0 ? ' chip-stat--hot' : ''}`}>
            <div className="chip-stat__ico" style={{ background: '#FEF3C7', color: '#CA8A04' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/></svg>
            </div>
            <div><div className="chip-stat__n">{streak}</div><div className="chip-stat__l">day streak</div></div>
          </div>
          <div className="chip-stat">
            <div className="chip-stat__ico" style={{ background: '#EDE9FE', color: '#6D28D9' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>
            </div>
            <div><div className="chip-stat__n">{decks.length}</div><div className="chip-stat__l">decks</div></div>
          </div>
          <div className="chip-stat">
            <div className="chip-stat__ico" style={{ background: '#DCFCE7', color: '#059669' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            </div>
            <div><div className="chip-stat__n">{due}</div><div className="chip-stat__l">cards due</div></div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input className="input" placeholder="Search decks…" value={q}
                 onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn--ghost" onClick={() => setShowCourse(true)}>+ Course</button>
      </div>

      {courses.length > 0 && (
        <div className="pills">
          <button className={`pill${courseFilter === 'all' ? ' pill--on' : ''}`}
                  onClick={() => setCourseFilter('all')}>All</button>
          {courses.map((c) => (
            <button key={c.id} className={`pill${courseFilter === c.id ? ' pill--on' : ''}`}
                    onClick={() => setCourseFilter(c.id)}>{c.name}</button>
          ))}
          <button className={`pill${courseFilter === 'none' ? ' pill--on' : ''}`}
                  onClick={() => setCourseFilter('none')}>Uncategorised</button>
        </div>
      )}

      {error && decks && decks.length === 0 ? (
        <LoadError message={error} onRetry={() => { setDecks(null); load(); }} />
      ) : visible === null ? (
        <div className="stack">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 88 }} />)}
        </div>
      ) : visible.length === 0 ? (
        decks.length === 0 ? (
          <div className="empty animate-in">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
              <Mascot mood="happy" size={96} float />
            </div>
            <h3>No study sets yet</h3>
            <p>Upload a PDF, a photo of your notes, or paste text — we&apos;ll build the cards.</p>
            <a href="/upload" className="btn btn--primary btn--lg">Create your first set</a>
          </div>
        ) : (
          <div className="empty"><h3>No decks match</h3><p>Try a different search or filter.</p></div>
        )
      ) : (
        <div className="stack">
          {visible.map((d, i) => {
            const cards = d.flashcards?.[0]?.count ?? 0;
            const quiz = d.quiz_questions?.[0]?.count ?? 0;
            const course = courses.find((c) => c.id === d.course_id);
            return (
              <div key={d.id} className="card deck rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div style={{ minWidth: 0 }}>
                  <div className="deck__title">
                    <a href={`/deck/${d.id}`} style={{ color: 'inherit' }}>{d.title}</a>
                  </div>
                  <div className="deck__meta">
                    {course && <span className="badge">{course.name}</span>}
                    <span>{cards} card{cards === 1 ? '' : 's'}</span>
                    <span>·</span>
                    <span>{quiz} quiz</span>
                    {d.is_public && <span className="badge badge--accent">Shared</span>}
                  </div>
                </div>
                <div className="deck__actions">
                  <a href={`/study?deck=${d.id}`} className="btn btn--primary">Study</a>
                  <a href={`/deck/${d.id}`} className="btn btn--ghost">Open</a>
                  <button onClick={() => remove(d.id, d.title)} className="btn btn--quiet">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCourse && (
        <Modal title="New course" onClose={() => setShowCourse(false)}>
          <form onSubmit={addCourse} className="stack">
            <input className="input" autoFocus placeholder="e.g. BI110 — Cell Biology"
                   value={newCourse} onChange={(e) => setNewCourse(e.target.value)} />
            <div className="row">
              <button className="btn btn--primary">Add course</button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowCourse(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
