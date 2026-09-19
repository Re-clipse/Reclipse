'use client';

import { useEffect, useRef, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import Mascot from '@/components/Mascot';

const MAX_CHARS = 24000;
function UploadInner() {
  const router = useRouter();
  const params = useSearchParams();
  const preCourse = params.get('course') || '';
  const onboarding = params.get('onboarding') === '1';
  const { user, loading: authLoading } = useAuth();
  const inputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(preCourse);

  useEffect(() => {
    if (!user) return;
    supabase.from('courses').select('*').order('name').then(({ data }) => setCourses(data || []));
  }, [user]);

  async function readFile(file) {
    if (!file) return;
    setFileName(file.name); setError(''); setNotice(''); setExtracting(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/extract-pdf', { method: 'POST', body });
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

  async function handleGenerate(e) {
    e.preventDefault();
    setError('');
    if (text.trim().length < 50) { setError('Add a bit more text first — we need a few sentences.'); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login?next=/upload'); return; }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }

      const { data: deck, error: deckError } = await supabase.from('decks').insert({
        user_id: session.user.id,
        title: title.trim() || 'Untitled deck',
        source_text: text,
        summary: data.summary || null,
        course_id: courseId || null,
      }).select().single();
      if (deckError) throw deckError;

      await supabase.from('flashcards').insert(data.flashcards.map((f, i) => ({
        deck_id: deck.id, question: f.question, answer: f.answer,
        card_type: f.type === 'cloze' ? 'cloze' : 'basic', position: i,
      })));
      if (data.quiz?.length) {
        await supabase.from('quiz_questions').insert(data.quiz.map((q) => ({
          deck_id: deck.id, question: q.question, options: q.options,
          correct_index: q.correctIndex, explanation: q.explanation,
        })));
      }
      if (onboarding) {
        if (data.quiz?.length) router.push(`/quiz?deck=${deck.id}&onboarding=1`);
        else router.push('/decks'); // no quiz came back — skip step 3 rather than dead-end
      } else {
        router.push(`/deck/${deck.id}`);
      }
    } catch {
      setError('We generated your set but could not save it. Please try again.');
    } finally { setLoading(false); }
  }

  if (authLoading) return <main className="page"><div className="skeleton" style={{ height: 420 }} /></main>;

  if (loading) {
    return (
      <main className="page">
        <div className="card working animate-in">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-4)' }}>
            <Mascot mood="thinking" size={100} float />
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Building your study set</h2>
          <p className="working__step" style={{ marginTop: 'var(--s-3)' }}>
            Reading your notes, writing recall questions and a quiz — usually 10–20 seconds.
          </p>
        </div>
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
          <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)}
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
        <p className="small muted">Up to 5 study sets per day.</p>
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
