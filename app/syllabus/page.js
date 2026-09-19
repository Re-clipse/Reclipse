'use client';

import { useEffect, useRef, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';

const TYPE_LABEL = { exam: 'Exam', quiz: 'Quiz', lab: 'Lab', assignment: 'Assignment', other: 'Date' };

export default function SyllabusPage() {
  const { user, loading: authLoading } = useAuth();
  const inputRef = useRef(null);

  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [newCourse, setNewCourse] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [events, setEvents] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [optIn, setOptIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('courses').select('*').order('name').then(({ data }) => setCourses(data || []));
  }, [user]);

  async function readFile(file) {
    if (!file) return;
    setFileName(file.name); setError(''); setExtracting(true); setEvents(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        setError('Please log in again to upload a file.'); setFileName(''); return;
      }
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/extract-pdf', {
        method: 'POST', body,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not read that file.'); return; }
      setText(data.text);
    } catch {
      setError('Could not read that file.');
    } finally { setExtracting(false); }
  }

  async function ensureCourse() {
    if (courseId) return courseId;
    const name = newCourse.trim();
    if (!name) { setError('Name a course, or pick an existing one, first.'); return null; }
    const { data, error } = await supabase.from('courses').insert({ user_id: user.id, name }).select().single();
    if (error) { setError('Could not create that course.'); return null; }
    setCourses((c) => [...c, data]);
    setCourseId(data.id);
    return data.id;
  }

  async function extractDates(e) {
    e.preventDefault();
    setError(''); setSaved(false);
    if (text.trim().length < 30) { setError('Paste in or upload the syllabus text first.'); return; }
    const cid = await ensureCourse();
    if (!cid) return;

    setParsing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/parse-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      if (!data.events.length) {
        setError("We couldn't find any dates we were confident about in that text. You can still add sessions to this course manually later.");
        setEvents([]);
        return;
      }
      setEvents(data.events.map((ev) => ({ ...ev, keep: true })));
    } catch {
      setError('Could not reach the server.');
    } finally { setParsing(false); }
  }

  function toggleKeep(i) {
    setEvents((evs) => evs.map((ev, idx) => (idx === i ? { ...ev, keep: !ev.keep } : ev)));
  }

  async function saveEvents() {
    setSaving(true); setError('');
    try {
      const toSave = events.filter((e) => e.keep);
      if (toSave.length) {
        await supabase.from('course_events').insert(
          toSave.map((e) => ({ course_id: courseId, user_id: user.id, title: e.title, event_date: e.date, event_type: e.type }))
        );
      }
      await supabase.from('courses').update({ remind_enabled: optIn }).eq('id', courseId);
      setSaved(true);
    } catch {
      setError('Could not save these dates. Please try again.');
    } finally { setSaving(false); }
  }

  if (authLoading) return <main className="page"><div className="skeleton" style={{ height: 400 }} /></main>;

  if (saved) {
    return (
      <main className="page page--narrow">
        <div className="card center animate-in" style={{ padding: 'var(--s-7)' }}>
          <div className="done__ring">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                 strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>Dates saved</h1>
          <p className="muted" style={{ marginTop: 'var(--s-3)' }}>
            {optIn
              ? "We'll email you a couple of days before each one to review your decks."
              : 'Reminders are off for this course \u2014 you can turn them on anytime from the course settings.'}
          </p>
          {optIn && (
            <div className="alert alert--note" style={{ marginTop: 'var(--s-4)', textAlign: 'left' }}>
              First time getting mail from us? Check your spam/junk folder once \u2014
              reminder emails occasionally land there.
            </div>
          )}
          <div className="row actions-sm-stack" style={{ justifyContent: 'center', marginTop: 'var(--s-6)' }}>
            <a href="/decks" className="btn btn--primary">My decks</a>
            <button className="btn btn--ghost" onClick={() => { setSaved(false); setEvents(null); setText(''); setFileName(''); }}>
              Add another syllabus
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1>Syllabus &amp; reminders</h1>
          <p>Upload a syllabus and we&apos;ll pull out the exam, quiz and lab dates \u2014 opt in and we&apos;ll email you before each one.</p>
        </div>
      </div>

      <form onSubmit={extractDates} className="stack" style={{ gap: 'var(--s-5)' }}>
        <div className="field">
          <label className="label">Course</label>
          {courses.length > 0 && (
            <select className="input" value={courseId} onChange={(e) => { setCourseId(e.target.value); setNewCourse(''); }}>
              <option value="">\u2014 New course \u2014</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {!courseId && (
            <input className="input" style={{ marginTop: courses.length ? 8 : 0 }} placeholder="e.g. BI110 \u2014 Cell Biology"
                   value={newCourse} onChange={(e) => setNewCourse(e.target.value)} />
          )}
        </div>

        <div
          className={`drop${fileName && !extracting ? ' drop--done' : ''}`}
          onClick={() => inputRef.current?.click()} role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf,.txt,image/*" hidden onChange={(e) => readFile(e.target.files?.[0])} />
          <div>
            <div className="drop__icon">
              {extracting ? <span className="spinner spinner--ink" style={{ width: 26, height: 26 }} /> : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                     strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5-5 5 5" /><path d="M12 5v12" />
                </svg>
              )}
            </div>
            <div className="drop__title">{extracting ? 'Reading\u2026' : fileName ? `Loaded: ${fileName}` : 'Drop your syllabus here, or click to browse'}</div>
            <div className="drop__hint">PDF, text file, or a photo of a printed schedule.</div>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="syl-text">Or paste the schedule text</label>
          <textarea id="syl-text" className="textarea" value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your course schedule / syllabus text here\u2026" />
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <button type="submit" className="btn btn--primary btn--lg" disabled={parsing || extracting}>
          {parsing && <span className="spinner" />}{parsing ? 'Reading dates\u2026' : 'Find dates'}
        </button>
      </form>

      {events !== null && (
        <div style={{ marginTop: 'var(--s-6)' }}>
          <h3 style={{ marginBottom: 'var(--s-2)' }}>
            {events.length === 0 ? 'No dates found' : `Found ${events.length} date${events.length === 1 ? '' : 's'}`}
          </h3>
          {events.length > 0 && (
            <>
              <p className="small muted" style={{ marginBottom: 'var(--s-4)' }}>Uncheck anything that&apos;s wrong \u2014 syllabus dates can be ambiguous.</p>
              <div className="stack" style={{ marginBottom: 'var(--s-5)' }}>
                {events.map((ev, i) => (
                  <label key={i} className="card row" style={{ cursor: 'pointer', opacity: ev.keep ? 1 : .5 }}>
                    <input type="checkbox" checked={ev.keep} onChange={() => toggleKeep(i)} />
                    <span className="badge">{TYPE_LABEL[ev.type]}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{ev.title}</span>
                    <span className="small muted">{ev.date}</span>
                  </label>
                ))}
              </div>

              <div className="card switch" style={{ marginBottom: 'var(--s-5)' }}>
                <div>
                  <div style={{ fontWeight: 650 }}>Email me reminders (opt-in)</div>
                  <p className="small muted">
                    We&apos;ll email {user?.email} a couple of days before each date, suggesting you review your decks.
                    You can turn this off anytime.
                  </p>
                </div>
                <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)}
                       style={{ width: 20, height: 20 }} />
              </div>

              <button className="btn btn--primary btn--lg" onClick={saveEvents} disabled={saving}>
                {saving && <span className="spinner" />}{saving ? 'Saving\u2026' : 'Save these dates'}
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
