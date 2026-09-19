'use client';

import { useEffect, useRef, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import Mascot from '@/components/Mascot';
import { generateStudyDraft, persistStudyDraft } from '@/lib/studySetFlow.mjs';

const MAX_CHARS = 24000;
function UploadInner() {
  const router = useRouter();
  const params = useSearchParams();
  const preCourse = params.get('course') || '';
  const onboarding = params.get('onboarding') === '1';
  const { user, loading: authLoading } = useAuth();
  const inputRef = useRef(null);
  const workingRef = useRef(false);

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('Building your study set');
  const [pendingDraft, setPendingDraft] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(preCourse);

  useEffect(() => {
    if (!pendingDraft) return;
    const warnBeforeLeaving = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [pendingDraft]);

  useEffect(() => {
    if (!user) return;
    supabase.from('courses').select('*').order('name').then(({ data }) => setCourses(data || []));
  }, [user]);

  async function readFile(file) {
    if (!file) return;
    setFileName(file.name); setError(''); setNotice(''); setExtracting(true);
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
      if (!res.ok) { setError(data.error || 'Could not read that file.'); setFileName(''); return; }
      setText(data.text);
      if (data.source === 'image') setNotice('Read from your photo — check the text below for anything mis-transcribed before generating.');
      else if (data.truncated) setNotice('That file was long, so we used the first part. Trim the text below to focus on a section.');
      if (!title) setTitle(file.name.replace(/\.(pdf|txt|jpe?g|png|webp|gif)$/i, ''));
    } catch {
      setError('Could not read that file. Try pasting the text instead.'); setFileName('');
    } finally { setExtracting(false); }
  }

  async function finishSave(draft) {
    const { data: { session } } = await supabase.auth.getSession();
    const id = await persistStudyDraft(supabase, draft, session);
    if (onboarding) {
      router.push(draft.material.quiz.length ? `/quiz?deck=${id}&onboarding=1` : '/decks');
    } else {
      router.push(`/deck/${id}`);
    }
  }

  async function retrySave() {
    if (workingRef.current || !pendingDraft) return;
    workingRef.current = true;
    setLoading(true); setError(''); setPhase('Saving your study set');
    try { await finishSave(pendingDraft); }
    catch (err) { setError(err.message || 'Saving failed. Please retry.'); }
    finally { workingRef.current = false; setLoading(false); }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (workingRef.current || pendingDraft) return;
    setError('');
    if (text.trim().length < 50) { setError('Add a bit more text first — we need a few sentences.'); return; }
    workingRef.current = true;
    setLoading(true);
    setPhase('Building your study set');
    let draft;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login?next=/upload'); return; }

      draft = await generateStudyDraft({ session, title, text, courseId });
      setPendingDraft(draft);
      setPhase('Saving your study set');
      await finishSave(draft);
    } catch (err) {
      setError(draft ? 'Your study set is ready, but saving failed. Keep this page open and retry saving.'
        : err.message || 'Could not generate your study set. Please try again later.');
    } finally { workingRef.current = false; setLoading(false); }
  }

  if (authLoading) return <main className="page"><div className="skeleton" style={{ height: 420 }} /></main>;

  if (loading) {
    return (
      <main className="page">
        <div className="card working animate-in">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-4)' }}>
            <Mascot mood="thinking" size={100} float />
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>{phase}</h2>
          <p className="working__step" style={{ marginTop: 'var(--s-3)' }}>
            {pendingDraft ? 'Keeping your cards and quiz together.' : 'Reading your notes, writing recall questions and a quiz — usually 10–20 seconds.'}
          </p>
        </div>
      </main>
    );
  }

  if (pendingDraft) {
    return (
      <main className="page">
        <PageHeader accent="blue" icon={ICONS.upload} title="Your study set is ready"
          subtitle="One more step: save it to your decks." />
        <section className="card stack" style={{ gap: 'var(--s-4)' }} aria-label="Save study set">
          <h2>{pendingDraft.title}</h2>
          <p>{pendingDraft.material.flashcards.length} flashcards and {pendingDraft.material.quiz.length} quiz questions.</p>
          {error && <div className="alert alert--error" role="alert">{error}</div>}
          <p>Keep this page open. Retrying saves this study set without using another AI attempt.</p>
          <div className="row actions-sm-stack">
            <button className="btn btn--primary btn--lg" onClick={retrySave}>Retry saving</button>
            <a className="btn btn--ghost" href="/login" target="_blank" rel="noopener noreferrer">Sign in in another tab</a>
          </div>
          <button className="btn btn--ghost" onClick={() => { setPendingDraft(null); setError(''); }}>
            Discard draft and start over
          </button>
        </section>
      </main>
    );
  }

  const over = text.length > MAX_CHARS;

  return (
    <main className="page">
      {onboarding && (
        <>
          <div className="progress" style={{ marginBottom: 'var(--s-4)' }}><div className="progress__bar" style={{ width: '66%' }} /></div>
          <span className="badge" style={{ marginBottom: 'var(--s-3)', display: 'inline-block' }}>Step 2 of 3</span>
        </>
      )}
      <PageHeader accent="blue" icon={ICONS.upload}
        title={onboarding ? 'Upload your first set of notes' : 'New study set'}
        subtitle="Upload a PDF, a photo of your notes, or paste text. We'll build the cards." />

      <form onSubmit={handleGenerate} className="stack" style={{ gap: 'var(--s-5)' }}>
        <div
          className={`drop${dragging ? ' drop--active' : ''}${fileName && !extracting ? ' drop--done' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files?.[0]); }}
          role="button" tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf,.txt,image/*" hidden
                 onChange={(e) => readFile(e.target.files?.[0])} />
          <div>
            <div className="drop__icon">
              {extracting ? <span className="spinner spinner--ink" style={{ width: 26, height: 26 }} /> : (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5-5 5 5" /><path d="M12 5v12" />
                </svg>
              )}
            </div>
            <div className="drop__title">
              {extracting ? 'Reading your file…' : fileName ? `Loaded: ${fileName}` : 'Drop a file here, or click to browse'}
            </div>
            <div className="drop__hint">
              {fileName && !extracting ? 'Click to replace it.'
                : 'PDF, text file, or a photo of handwritten notes or a whiteboard.'}
            </div>
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="title">Deck name</label>
          <input id="title" className="input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="e.g. BI110 — Cell Respiration" />
        </div>

        {courses.length > 0 && (
          <div className="field">
            <label className="label" htmlFor="course">Course (optional)</label>
            <select id="course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Uncategorised</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="notes">Your notes</label>
          <textarea id="notes" className="textarea" value={text} onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your notes here, or upload a file above." />
          <div className={`counter${over ? ' counter--warn' : ''}`}>
            <span>{over ? 'Over the limit — we\u2019ll use the first 24,000 characters.' : 'Roughly one lecture works best.'}</span>
            <span>{text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
          </div>
        </div>

        {notice && <div className="alert alert--note">{notice}</div>}
        {error && <div className="alert alert--error">{error}</div>}

        <div className="row actions-sm-stack">
          <button type="submit" className="btn btn--primary btn--lg" disabled={extracting}>
            Generate flashcards &amp; quiz
          </button>
          <a href="/decks" className="btn btn--ghost btn--lg">Cancel</a>
        </div>
        <p className="small muted">Daily AI limits reset at midnight UTC. Failed AI requests may count; retrying a save does not.</p>
      </form>
    </main>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={<main className="page"><div className="skeleton" style={{ height: 420 }} /></main>}>
      <UploadInner />
    </Suspense>
  );
}
