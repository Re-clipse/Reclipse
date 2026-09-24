'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader, { ICONS, ACCENTS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import LoadError from '@/components/LoadError';
import { withTimeout } from '@/lib/net';
import { downloadIcs } from '@/lib/ics';
import { localIso } from '@/lib/dates';

const TYPE_LABEL = { exam: 'Exam', quiz: 'Quiz', lab: 'Lab', assignment: 'Assignment', other: 'Date' };
// Type dot is independent of the course's accent color, so an event reads as
// "colour-coded by course AND type" — course on the left border, type as the dot.
const TYPE_DOT = { exam: '#DC2626', quiz: '#D97706', lab: '#0D9488', assignment: '#2563EB', other: '#6B7280' };
const ACCENT_CYCLE = ['green', 'blue', 'amber', 'pink', 'teal', 'orange', 'indigo'];
// Only exams/quizzes get an auto-generated spaced study plan.
const PLANNABLE_TYPES = ['exam', 'quiz'];

const SESSION_SELECT = 'id, session_date, tip, status, deck_id, course_event_id, course_events(title, event_type, course_id), decks(title)';

const ymd = localIso;
const todayIso = () => localIso();

function monthGrid(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatAgendaDate(dateStr) {
  const today = todayIso();
  const tomorrow = ymd(new Date(Date.now() + 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function courseAccentHex(courseColor, courseId) {
  return ACCENTS[courseColor.get(courseId) || 'violet']?.solid || '#7C3AED';
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState('loading');
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(null);
  const requestedPlans = useRef(new Set());

  // Agenda is the default on mobile — decided once on mount, not on every resize.
  useEffect(() => { if (window.innerWidth <= 640) setView('agenda'); }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setStatus('loading');
    try {
      const [eventsRes, sessionsRes, coursesRes] = await withTimeout(Promise.all([
        supabase.from('course_events').select('id, title, event_date, event_type, course_id, courses(name)').order('event_date'),
        supabase.from('study_plan_sessions').select(SESSION_SELECT).order('session_date'),
        supabase.from('courses').select('id, name').order('name'),
      ]), 12000, 'calendar');
      if (eventsRes.error || sessionsRes.error || coursesRes.error) { setStatus('failed'); return; }
      setEvents(eventsRes.data || []);
      setSessions(sessionsRes.data || []);
      setCourses(coursesRes.data || []);
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const generatePlans = useCallback(async (needsPlan) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await Promise.all(needsPlan.map((e) =>
      fetch('/api/study-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ course_event_id: e.id }),
      }).catch(() => null)
    ));
    const { data } = await supabase.from('study_plan_sessions').select(SESSION_SELECT).order('session_date');
    setSessions(data || []);
  }, []);

  // Auto-generate a study plan for any upcoming exam/quiz that doesn't have
  // one yet. requestedPlans guards against asking twice while the first
  // request is still in flight (before the refetch above lands).
  useEffect(() => {
    if (status !== 'ready') return;
    const today = todayIso();
    const haveSessionFor = new Set(sessions.map((s) => s.course_event_id));
    const needsPlan = events.filter((e) =>
      PLANNABLE_TYPES.includes(e.event_type) && e.event_date >= today &&
      !haveSessionFor.has(e.id) && !requestedPlans.current.has(e.id)
    );
    if (!needsPlan.length) return;
    needsPlan.forEach((e) => requestedPlans.current.add(e.id));
    generatePlans(needsPlan);
  }, [status, events, sessions, generatePlans]);

  const courseColor = useMemo(() => {
    const map = new Map();
    courses.forEach((c, i) => map.set(c.id, ACCENT_CYCLE[i % ACCENT_CYCLE.length]));
    return map;
  }, [courses]);

  const itemsByDate = useMemo(() => {
    const map = new Map();
    const push = (date, item) => { if (!map.has(date)) map.set(date, []); map.get(date).push(item); };
    events.forEach((e) => push(e.event_date, { kind: 'event', data: e }));
    sessions.forEach((s) => push(s.session_date, { kind: 'session', data: s }));
    return map;
  }, [events, sessions]);

  async function saveEvent(id, patch) {
    const { error } = await supabase.from('course_events').update(patch).eq('id', id);
    if (error) { toast('Could not save changes', 'error'); return false; }
    setEvents((evs) => evs.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    toast('Saved', 'success');
    return true;
  }

  async function deleteEvent(id) {
    await supabase.from('course_events').delete().eq('id', id); // cascades its study_plan_sessions
    setEvents((evs) => evs.filter((e) => e.id !== id));
    setSessions((ss) => ss.filter((s) => s.course_event_id !== id));
    toast('Deleted');
  }

  async function deleteSession(id) {
    await supabase.from('study_plan_sessions').delete().eq('id', id);
    setSessions((ss) => ss.filter((s) => s.id !== id));
    toast('Deleted');
  }

  async function setSessionStatus(id, statusValue) {
    await supabase.from('study_plan_sessions').update({ status: statusValue }).eq('id', id);
    setSessions((ss) => ss.map((s) => (s.id === id ? { ...s, status: statusValue } : s)));
  }

  function exportCalendar() {
    const icsEvents = [
      ...events.map((e) => ({
        id: e.id, date: e.event_date,
        title: `${e.title}${e.courses?.name ? ` (${e.courses.name})` : ''}`,
        description: TYPE_LABEL[e.event_type],
      })),
      ...sessions.filter((s) => s.status === 'pending').map((s) => ({
        id: s.id, date: s.session_date,
        title: `Study: ${s.course_events?.title || 'session'}`,
        description: s.tip,
      })),
    ];
    downloadIcs(icsEvents, 'reclipse-calendar.ics');
  }

  if (authLoading) return <main className="page"><div className="skeleton" style={{ height: 420 }} /></main>;
  if (status === 'failed') return <main className="page"><LoadError onRetry={load} /></main>;

  const isEmpty = status === 'ready' && !events.length && !sessions.length;

  return (
    <main className="page">
      <PageHeader accent="indigo" icon={ICONS.calendar} title="Calendar"
        subtitle="Your exam, quiz and lab dates, plus a spaced study plan leading up to each one."
        action={
          <button className="btn btn--ghost" onClick={exportCalendar} disabled={isEmpty}>
            Export to calendar
          </button>
        } />

      <div className="tabs" role="tablist" aria-label="Calendar view" style={{ marginBottom: 'var(--s-4)' }}>
        <button type="button" role="tab" aria-selected={view === 'month'}
                className={`tab${view === 'month' ? ' tab--on' : ''}`} onClick={() => setView('month')}>Month</button>
        <button type="button" role="tab" aria-selected={view === 'agenda'}
                className={`tab${view === 'agenda' ? ' tab--on' : ''}`} onClick={() => setView('agenda')}>Agenda</button>
      </div>

      {status === 'loading' ? (
        <div className="skeleton" style={{ height: 420 }} />
      ) : view === 'month' ? (
        <MonthGrid
          cursor={cursor} itemsByDate={itemsByDate} courseColor={courseColor} onSelect={setSelected}
          onPrev={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          onNext={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          onToday={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} />
      ) : (
        <AgendaView itemsByDate={itemsByDate} courseColor={courseColor} onSelect={setSelected} />
      )}

      {isEmpty && (
        <div className="card center u-p-6 u-mt-5">
          <p className="muted">No dates yet. <a href="/syllabus">Upload a syllabus</a> to get started.</p>
        </div>
      )}

      {selected && (
        <EventModal item={selected} onClose={() => setSelected(null)}
                    onSaveEvent={saveEvent} onDeleteEvent={deleteEvent}
                    onSetSessionStatus={setSessionStatus} onDeleteSession={deleteSession} />
      )}
    </main>
  );
}

function MonthGrid({ cursor, itemsByDate, courseColor, onSelect, onPrev, onNext, onToday }) {
  const cells = monthGrid(cursor);
  const today = todayIso();
  return (
    <div className="cal-month">
      <div className="cal-month__head">
        <button type="button" className="icon-btn" onClick={onPrev} aria-label="Previous month">‹</button>
        <h2>{cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
        <button type="button" className="icon-btn" onClick={onNext} aria-label="Next month">›</button>
        <button type="button" className="btn btn--ghost" onClick={onToday}>Today</button>
      </div>
      <div className="cal-grid cal-grid--dow">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="cal-cell cal-cell--empty" />;
          const key = ymd(date);
          const items = itemsByDate.get(key) || [];
          return (
            <div key={i} className={`cal-cell${key === today ? ' cal-cell--today' : ''}`}>
              <div className="cal-cell__num">{date.getDate()}</div>
              <div className="cal-cell__items">
                {items.slice(0, 3).map((item) => (
                  <CalPill key={item.data.id} item={item} courseColor={courseColor} onSelect={onSelect} />
                ))}
                {items.length > 3 && <div className="cal-pill cal-pill--more">+{items.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalPill({ item, courseColor, onSelect }) {
  const isEvent = item.kind === 'event';
  const courseId = isEvent ? item.data.course_id : item.data.course_events?.course_id;
  const type = isEvent ? item.data.event_type : 'other';
  return (
    <button type="button" className={`cal-pill cal-pill--${item.kind}`}
            style={{ borderLeftColor: courseAccentHex(courseColor, courseId) }}
            onClick={() => onSelect(item)}>
      <span className="cal-pill__dot" style={{ background: TYPE_DOT[type] || TYPE_DOT.other }} />
      {isEvent ? item.data.title : `Study: ${item.data.course_events?.title || 'session'}`}
    </button>
  );
}

function AgendaView({ itemsByDate, courseColor, onSelect }) {
  const today = todayIso();
  const dates = [...itemsByDate.keys()].filter((d) => d >= today).sort();
  if (!dates.length) return <div className="card center u-p-6"><p className="muted">Nothing upcoming yet.</p></div>;
  return (
    <div className="cal-agenda">
      {dates.map((date) => (
        <div key={date} className="cal-agenda__day">
          <div className="cal-agenda__date">{formatAgendaDate(date)}</div>
          <div className="stack">
            {itemsByDate.get(date).map((item) => {
              const isEvent = item.kind === 'event';
              const courseId = isEvent ? item.data.course_id : item.data.course_events?.course_id;
              const type = isEvent ? item.data.event_type : 'other';
              return (
                <button key={item.data.id} type="button" className="card cal-agenda__item"
                        style={{ borderLeftColor: courseAccentHex(courseColor, courseId) }}
                        onClick={() => onSelect(item)}>
                  <span className="cal-pill__dot" style={{ background: TYPE_DOT[type] || TYPE_DOT.other }} />
                  <span className="cal-agenda__title">
                    {isEvent ? item.data.title : `Study: ${item.data.course_events?.title || 'session'}`}
                  </span>
                  {isEvent && <span className="badge">{TYPE_LABEL[item.data.event_type]}</span>}
                  {!isEvent && item.data.status !== 'pending' && <span className="badge">{item.data.status}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventModal({ item, onClose, onSaveEvent, onDeleteEvent, onSetSessionStatus, onDeleteSession }) {
  const isEvent = item.kind === 'event';
  const [title, setTitle] = useState(isEvent ? item.data.title : '');
  const [date, setDate] = useState(isEvent ? item.data.event_date : item.data.session_date);
  const [saving, setSaving] = useState(false);

  if (isEvent) {
    const ev = item.data;
    return (
      <Modal title="Event details" onClose={onClose}>
        <div className="stack">
          <div className="field">
            <label className="label" htmlFor="cal-ev-title">Title</label>
            <input id="cal-ev-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="cal-ev-date">Date</label>
            <input id="cal-ev-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <p className="small muted">{TYPE_LABEL[ev.event_type]}{ev.courses?.name ? ` · ${ev.courses.name}` : ''}</p>
          <div className="row">
            <button className="btn btn--primary" disabled={saving || !title.trim()} onClick={async () => {
              setSaving(true);
              const ok = await onSaveEvent(ev.id, { title: title.trim(), event_date: date });
              setSaving(false);
              if (ok) onClose();
            }}>Save</button>
            <button className="btn btn--ghost" onClick={async () => { await onDeleteEvent(ev.id); onClose(); }}>Delete</button>
            <button className="btn btn--quiet" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </Modal>
    );
  }

  const s = item.data;
  return (
    <Modal title="Study session" onClose={onClose}>
      <div className="stack">
        <p style={{ fontWeight: 650 }}>{s.course_events?.title || 'Study session'}</p>
        {s.decks?.title && <p className="small muted">Deck: {s.decks.title}</p>}
        {s.tip && <p>{s.tip}</p>}
        <p className="small muted">{s.session_date}</p>
        <div className="row">
          {s.status !== 'done' && (
            <button className="btn btn--primary" onClick={async () => { await onSetSessionStatus(s.id, 'done'); onClose(); }}>
              Mark done
            </button>
          )}
          <button className="btn btn--ghost" onClick={async () => { await onDeleteSession(s.id); onClose(); }}>Delete</button>
          <button className="btn btn--quiet" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
