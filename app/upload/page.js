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
  const [mode, setMode] = useState('file'); // 'file' | 'paste'

  useEffect(() => {
    if (!user) return;
    supabase.from('courses').select('*').order('name').then(({ data }) => setCourses(data || []));
  }, [user]);

  async function readFile(file) {
    if (!file) return;
    setFileName(file.name); setError(''); setNotice(''); setExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login?next=/upload'); return; }
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/extract-pdf', {
        method: 'POST', body, headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not read that file.'); setFileName(''); return; }
      setText(data.text);
      if (data.source === 'image') setNotice('Read from your photo. Check the text below for anything mis-transcribed before generating.');
      else if (data.truncated) setNotice('That file was long, so we used the first part. Trim the text below to focus on a section.');
      if (!title) setTitle(file.name.replace(/\.(pdf|txt|jpe?g|png|webp|gif)$/i, ''));
    } catch {
      setError('Could not read that file. Try pasting the text instead.'); setFileName('');
    } finally { setExtracting(false); }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setError('');
    if (text.trim().length < 50) { setError('Add a bit more text first. We need a few sentences.'); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login?next=/upload'); return; }

      // Never spin forever: give up a little after the server's own 60s limit.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 70000);
      let res;
      try {
        res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ text }),
          signal: ctrl.signal,
        });
      } catch (netErr) {
        setError(netErr.name === 'AbortError'
          ? 'That took too long. Try a shorter section of notes.'
          : 'Could not reach the server. Check your connection and try again.');
        return;
      } finally { clearTimeout(timer); }
      // A timeout or gateway error comes back as HTML, not JSON.
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(
          data?.error
          || (res.status === 504 || res.status === 408
            ? 'That took too long. Try a shorter section of notes.'
            : 'Something went wrong generating your set. Please try again.')
        );
        return;
      }

      const { data: deck, error: deckError } = await supabase.from('decks').insert({
        user_id: session.user.id,
        title: title.trim() || 'Untitled deck',
        source_text: text,
        summary: data.summary || null,
        course_id: courseId || null,
      }).select().single();
      if (deckError) throw deckError;

      const { error: cardsError } = await supabase.from('flashcards').insert(data.flashcards.map((f, i) => ({
        deck_id: deck.id, question: f.question, answer: f.answer,
        card_type: f.type === 'cloze' ? 'cloze' : 'basic', position: i,
      })));
      if (cardsError) {
        // Don't leave an empty deck behind if the cards couldn't be saved.
        await supabase.from('decks').delete().eq('id', deck.id);
        throw cardsError;
      }

      let quizSaved = false;
      if (data.quiz?.length) {
        // The deck is already useful without its quiz, so a quiz save failure isn't fatal.
        const { error: quizError } = await supabase.from('quiz_questions').insert(data.quiz.map((q) => ({
          deck_id: deck.id, question: q.question, options: q.options,
          correct_index: q.correctIndex, explanation: q.explanation,
        })));
        if (quizError) console.error('quiz save failed:', quizError);
        else quizSaved = true;
      }
      if (onboarding) {
        if (quizSaved) router.push(`/quiz?deck=${deck.id}&onboarding=1`);
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
            Reading your notes and writing scenario-based cards and a quiz. Usually well under a
            minute, occasionally a bit longer if it needs a second pass.
          </p>
        </div>
      </main>
    );
  }

  const over = text.length > MAX_CHARS;

  return (
    <main className="page page--wide">
      {onboarding && (
        <>
          <div className="progress" style={{ marginBottom: 'var(--s-4)' }}><div className="progress__bar" style={{ width: '66%' }} /></div>
          <span className="badge" style={{ marginBottom: 'var(--s-3)', display: 'inline-block' }}>Step 2 of 3</span>
        </>
      )}
      <PageHeader accent="blue" icon={ICONS.upload}
        title={onboarding ? 'Upload your first set of notes' : 'New study set'}
        subtitle="Upload a PDF, a photo of your notes, or paste text. We'll build the cards." />

      <div className="up-layout">
        <form onSubmit={handleGenerate} className="stack up-form" style={{ gap: 'var(--s-5)' }}>
          <div className="up-row">
            <div className="field">
              <label className="label" htmlFor="title">Deck name</label>
              <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                     placeholder="e.g. BI110 - Cell Respiration" />
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
          </div>

          <div className="tabs" role="tablist" aria-label="How to add your notes">
            <button type="button" role="tab" aria-selected={mode === 'file'}
                    className={`tab${mode === 'file' ? ' tab--on' : ''}`} onClick={() => setMode('file')}>Upload a file</button>
            <button type="button" role="tab" aria-selected={mode === 'paste'}
                    className={`tab${mode === 'paste' ? ' tab--on' : ''}`} onClick={() => setMode('paste')}>Paste text</button>
          </div>

          {mode === 'file' && (
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
                <div className="drop__icon drop__icon--tile">
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
                <div className="drop__chips" aria-hidden="true">
                  <span className="drop__chip">PDF</span>
                  <span className="drop__chip">Text</span>
                  <span className="drop__chip">Photo</span>
                </div>
                <div className="drop__hint">
                  {fileName && !extracting ? 'Click to replace it.'
                    : 'PDF, text file, or a photo of handwritten notes or a whiteboard.'}
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <label className="label" htmlFor="notes">Your notes</label>
            <textarea id="notes" className={`textarea${mode === 'paste' ? ' textarea--tall' : ''}`} value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={mode === 'paste' ? 'Paste your notes here.' : 'Paste your notes here, or upload a file above.'} />
            <div className={`counter${over ? ' counter--warn' : ''}`}>
              <span>{over ? 'Over the limit. We\u2019ll use the first 24,000 characters.' : 'Roughly one lecture works best.'}</span>
              <span>{text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
            </div>
          </div>

          {notice && <div className="alert alert--note">{notice}</div>}
          {error && <div role="alert" className="alert alert--error">{error}</div>}

          <div className="up-actions">
            <button type="submit" className="btn btn--primary btn--lg" disabled={extracting}>
              Generate flashcards &amp; quiz
            </button>
            <a href="/decks" className="btn btn--ghost btn--lg">Cancel</a>
          </div>
          <p className="small muted">Up to 5 study sets per day — you&apos;ll get a clear message here if you hit the limit, and it resets the next day.</p>
        </form>

        <aside className="card up-side">
          <div className="up-side__luna"><Mascot mood="happy" size={100} float /></div>
          <h3>What you&apos;ll get</h3>
          <ul className="up-side__list">
            {['Smart flashcards', 'Fill-in-the-blank recall', 'A full practice quiz'].map((t) => (
              <li key={t}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
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
