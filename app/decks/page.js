'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/components/Toast';
import { streakFrom } from '@/lib/stats';
import { cardsToday } from '@/lib/rewards';
import { GoalRing } from '@/components/Rewards';
import Mascot from '@/components/Mascot';
import PageHeader, { ICONS, ACCENTS } from '@/components/PageHeader';
import Modal from '@/components/Modal';
import LoadError from '@/components/LoadError';
import { withTimeout } from '@/lib/net';
import { localIso } from '@/lib/dates';

// Course spine colors cycle through the shared per-page accent palette.
const ACCENT_CYCLE = ['green', 'blue', 'amber', 'pink', 'teal', 'orange', 'indigo'];

export default function DecksPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [decks, setDecks] = useState(null);
  const [courses, setCourses] = useState([]);
  const [due, setDue] = useState(0);
  const [progress, setProgress] = useState({});
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState({ done: 0, goal: 20, pct: 0 });
  const [q, setQ] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [error, setError] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [showCourse, setShowCourse] = useState(false);
  const [nextExam, setNextExam] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [contentMatches, setContentMatches] = useState(null); // deck ids matching card content, or null when not searching
  const [showTrash, setShowTrash] = useState(false);
  const [trashed, setTrashed] = useState(null); // null = not loaded yet

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const today = localIso();
      const [decksRes, coursesRes, dueRes, sessRes, progRes, examRes, planRes] = await withTimeout(Promise.all([
        supabase.from('decks')
          .select('id, title, created_at, course_id, is_public, flashcards(count), quiz_questions(count)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('courses').select('*').order('name'),
        supabase.from('card_progress').select('flashcard_id', { count: 'exact', head: true })
          .lte('due_at', new Date().toISOString()),
        supabase.from('study_sessions').select('created_at').order('created_at', { ascending: false }).limit(400),
        supabase.from('card_progress').select('due_at, flashcards(deck_id)').limit(5000),
        // Today card: soonest upcoming exam/quiz, plus any study sessions planned for today.
        // Best-effort like the rest of this block — a failure here just hides the card.
        supabase.from('course_events').select('id, title, event_date, event_type, courses(name)')
          .in('event_type', ['exam', 'quiz']).gte('event_date', today).order('event_date').limit(1),
        supabase.from('study_plan_sessions').select('id, tip, course_events(title), decks(title)')
          .eq('status', 'pending').eq('session_date', today),
      ]), 12000, 'decks');

      if (decksRes.error) { setError("We couldn't load your decks."); setDecks([]); return; }
      setDecks(decksRes.data || []);
      setCourses(coursesRes.data || []);
      setDue(dueRes.count || 0);
      setNextExam(examRes.data?.[0] || null);
      setTodaySessions(planRes.data || []);
      // Per-deck due / learned counts. Best-effort: a failure here only hides the mastery bars.
      const now = Date.now();
      const perDeck = {};
      for (const r of progRes.data || []) {
        const id = r.flashcards?.deck_id;
        if (!id) continue;
        const p = (perDeck[id] ||= { due: 0, learned: 0 });
        if (new Date(r.due_at).getTime() <= now) p.due += 1; else p.learned += 1;
      }
      setProgress(perDeck);
      const sess = sessRes.data || [];
      setStreak(streakFrom(sess.map((s) => s.created_at)));
      setGoal(cardsToday(sess, 20));
    } catch {
      // Timed out or network failure — show the retry UI rather than a stuck skeleton.
      setError("We couldn't load your decks. This is usually a connection hiccup.");
      setDecks([]);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Title search above is instant/client-side; this supplements it with a
  // debounced server search over card contents (question/answer), so
  // "mitochondria" finds a deck titled "BI110" if that's what's on a card.
  // RLS already scopes flashcards to the signed-in user's own decks.
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) { setContentMatches(null); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('flashcards')
        .select('deck_id')
        .or(`question.ilike.%${needle}%,answer.ilike.%${needle}%`)
        .limit(200);
      setContentMatches(new Set((data || []).map((r) => r.deck_id)));
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

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
    if (!confirm(`Delete "${title}"? You can undo this or restore it from Trash for 30 days.`)) return;
    setDecks((d) => d.filter((x) => x.id !== id));
    const { error } = await supabase.from('decks').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) { setError("That deck couldn't be deleted."); load(); return; }
    toast(`"${title}" deleted`, 'info', { duration: 6000, action: { label: 'Undo', onClick: () => restore(id) } });
  }

  async function restore(id) {
    const { error } = await supabase.from('decks').update({ deleted_at: null }).eq('id', id);
    if (error) { toast('Could not restore that deck', 'error'); return; }
    setTrashed((t) => (t ? t.filter((x) => x.id !== id) : t));
    load();
    toast('Deck restored', 'success');
  }

  async function destroyForever(id, title) {
    if (!confirm(`Permanently delete "${title}"? This can't be undone.`)) return;
    setTrashed((t) => t.filter((x) => x.id !== id));
    const { error } = await supabase.from('decks').delete().eq('id', id);
    if (error) toast('Could not delete that deck', 'error');
  }

  async function openTrash() {
    setShowTrash(true);
    const { data } = await supabase.from('decks')
      .select('id, title, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    setTrashed(data || []);
  }

  const visible = useMemo(() => {
    if (!decks) return null;
    const needle = q.trim().toLowerCase();
    return decks.filter((d) => {
      const okCourse = courseFilter === 'all'
        || (courseFilter === 'none' ? !d.course_id : d.course_id === courseFilter);
      const okText = !needle || d.title.toLowerCase().includes(needle) || contentMatches?.has(d.id);
      return okCourse && okText;
    });
  }, [decks, q, courseFilter, contentMatches]);

  if (authLoading) return <main className="page page--wide"><div className="skeleton" style={{ height: 300 }} /></main>;

  return (
    <main className="page page--wide">
      <PageHeader
        accent="violet" icon={ICONS.decks} title="My decks"
        subtitle="Turn your notes into cards, then let spaced repetition do the rest."
        action={<a href="/upload" className="btn btn--page">+ New set</a>}
      />

      {decks && decks.length > 0 && (
        <div className="card hero-strip">
          <div className="hero-strip__stats">
            <div className="hero-strip__goal">
              <GoalRing done={goal.done} goal={goal.goal} pct={goal.pct} />
            </div>
            <div className="hero-strip__divider" aria-hidden="true" />
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
          </div>
          {due > 0
            ? <a href="/study?mode=due" className="btn btn--accent hero-strip__cta">Review {due} due</a>
            : goal.met && <p className="small muted hero-strip__note">Daily goal hit. Nice work today.</p>}
        </div>
      )}

      {(nextExam || todaySessions.length > 0) && (
        <div className="card today-card u-mb-5">
          <div style={{ fontWeight: 650, marginBottom: 'var(--s-2)' }}>Today</div>
          {todaySessions.length > 0 && (
            <p className="small muted" style={{ marginBottom: 'var(--s-2)' }}>
              Study plan — sessions we auto-scheduled leading up to your upcoming exams.
            </p>
          )}
          {todaySessions.map((s) => (
            <div key={s.id} className="today-card__row">
              <span className="badge badge--accent" title="Auto-scheduled review based on your upcoming exams">Study plan</span>
              <div>
                <div style={{ fontWeight: 600 }}>{s.decks?.title || s.course_events?.title || 'Study session'}</div>
                {s.tip && <p className="small muted">{s.tip}</p>}
              </div>
            </div>
          ))}
          {nextExam && (
            <div className="today-card__row">
              <span className="badge">{nextExam.event_type === 'exam' ? 'Exam' : 'Quiz'}</span>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {nextExam.title}{nextExam.courses?.name ? ` · ${nextExam.courses.name}` : ''}
                </div>
                <p className="small muted">{nextExam.event_date}</p>
              </div>
            </div>
          )}
          <a href="/calendar" className="btn btn--ghost u-mt-3">Open calendar</a>
        </div>
      )}

      <div className="toolbar">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input className="input" aria-label="Search decks and card contents" placeholder="Search decks and cards…" value={q}
                 onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn--ghost" onClick={() => setShowCourse(true)}>+ Course</button>
        <button className="btn btn--ghost" onClick={openTrash}>Trash</button>
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
        <div className="deck-grid">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 196 }} />)}
        </div>
      ) : visible.length === 0 ? (
        decks.length === 0 ? (
          <div className="empty animate-in">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
              <Mascot mood="happy" size={96} float />
            </div>
            <h3>No study sets yet</h3>
            <p>Turn your first set of notes into flashcards and a quiz — it only takes a minute.</p>
            <a href="/upload" className="btn btn--primary btn--lg">Create your first set</a>
          </div>
        ) : (
          <div className="empty">
            <h3>No decks match</h3>
            <p>Try a different search or filter.</p>
            <button className="btn btn--ghost" onClick={() => { setQ(''); setCourseFilter('all'); }}>Clear filters</button>
          </div>
        )
      ) : (
        <div className="deck-grid">
          {visible.map((d, i) => {
            const cards = d.flashcards?.[0]?.count ?? 0;
            const quiz = d.quiz_questions?.[0]?.count ?? 0;
            const courseIdx = courses.findIndex((c) => c.id === d.course_id);
            const course = courseIdx >= 0 ? courses[courseIdx] : null;
            const accent = course ? ACCENTS[ACCENT_CYCLE[courseIdx % ACCENT_CYCLE.length]] : ACCENTS.violet;
            const prog = progress[d.id] || { due: 0, learned: 0 };
            const learned = Math.min(prog.learned, cards);
            const pct = cards ? Math.round((learned / cards) * 100) : 0;
            const caughtUp = cards > 0 && prog.due === 0 && learned >= cards;
            const status = cards === 0 ? 'No cards yet'
              : prog.due > 0 ? `${prog.due} due today`
              : caughtUp ? 'All caught up'
              : `${cards - learned} new`;
            return (
              <div key={d.id} className="card deck-tile rise"
                   style={{ '--spine': accent.solid, animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="deck-tile__menu">
                  <a href={`/deck/${d.id}`} className="deck-tile__icon" aria-label={`Open ${d.title}`} title="Open">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                  </a>
                  <button onClick={() => remove(d.id, d.title)} className="deck-tile__icon deck-tile__icon--danger"
                          aria-label={`Delete ${d.title}`} title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
                {course && <div><span className="badge">{course.name}</span></div>}
                <div className="deck-tile__title">
                  <a href={`/deck/${d.id}`}>{d.title}</a>
                </div>
                <div className={`deck-tile__status${prog.due > 0 ? ' deck-tile__status--due' : ''}`}>{status}</div>
                <div className="progress-mini" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                     aria-label="Cards learned">
                  <div className={`progress-mini__bar${caughtUp ? ' progress-mini__bar--done' : ''}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="deck__meta deck-tile__meta">
                  <span>{cards} card{cards === 1 ? '' : 's'}</span>
                  <span>·</span>
                  <span>{quiz} quiz</span>
                  {d.is_public && (
                    <span className="badge badge--accent" style={{ marginLeft: 'auto' }}
                          title="Anyone with the link can view this deck">Shared</span>
                  )}
                </div>
                <a href={`/study?deck=${d.id}`} className={`btn btn--block ${caughtUp ? 'btn--ghost' : 'btn--primary'}`}>
                  {caughtUp ? 'Practice' : 'Study'}
                </a>
              </div>
            );
          })}
        </div>
      )}

      {showCourse && (
        <Modal title="New course" onClose={() => setShowCourse(false)}>
          <form onSubmit={addCourse} className="stack">
            <input className="input" autoFocus placeholder="e.g. BI110 - Cell Biology"
                   value={newCourse} onChange={(e) => setNewCourse(e.target.value)} />
            <div className="row">
              <button className="btn btn--primary">Add course</button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowCourse(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {showTrash && (
        <Modal title="Trash" onClose={() => setShowTrash(false)}>
          <div className="stack">
            <p className="small muted">Deleted decks stay here for 30 days before they&apos;re permanently removed.</p>
            {trashed === null ? (
              <div className="skeleton" style={{ height: 80 }} />
            ) : trashed.length === 0 ? (
              <p className="small muted">Nothing in the trash.</p>
            ) : (
              trashed.map((d) => (
                <div key={d.id} className="row row--between" style={{ alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{d.title}</div>
                    <div className="small muted">
                      Deleted {new Date(d.deleted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="row" style={{ flex: 'none' }}>
                    <button className="btn btn--ghost" onClick={() => restore(d.id)}>Restore</button>
                    <button className="btn btn--ghost" style={{ color: 'var(--error)' }}
                            onClick={() => destroyForever(d.id, d.title)}>Delete forever</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}
