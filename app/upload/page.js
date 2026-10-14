'use client';

import { useEffect, useRef, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import Mascot from '@/components/Mascot';
import { ACCEPT, checkFile, fileKind } from '@/lib/uploadFiles';

const MAX_CHARS = 24000;
const formatSize = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function UploadInner() {
  const router = useRouter();
  const params = useSearchParams();
  const preCourse = params.get('course') || '';
  const onboarding = params.get('onboarding') === '1';
  const { user, loading: authLoading } = useAuth();
  const inputRef = useRef(null);
  const cameraRef = useRef(null);
  const submitting = useRef(false); // blocks a double-click from starting two generations

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [readFailed, setReadFailed] = useState(false);
  const [textFromFile, setTextFromFile] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('creating'); // 'creating' | 'saving' while loading
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(preCourse);
  const [mode, setMode] = useState('file'); // 'file' | 'paste'

  useEffect(() => {
    if (!user) return;
    supabase.from('courses').select('*').order('name').then(({ data }) => setCourses(data || []));
  }, [user]);

  // Free the thumbnail's memory when it's replaced or the page closes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function readFile(picked) {
    if (!picked || extracting) return;
    setError(''); setNotice(''); setReadFailed(false);
    const problem = checkFile(picked);
    if (problem) { setError(problem); return; } // keeps whatever file was already selected
    setFile(picked);
    setPreview(fileKind(picked) === 'image' ? URL.createObjectURL(picked) : '');
    setExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login?next=/upload'); return; }
      const body = new FormData();
      body.append('file', picked);
      const res = await fetch('/api/extract-pdf', {
        method: 'POST', body, headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setError(data?.error || 'Could not read that file.'); setReadFailed(true); return; }
      setText(data.text); setTextFromFile(true);
      if (data.source === 'image') setNotice('Read from your photo. Check the text below for anything misread before you make cards.');
      else if (data.truncated) setNotice('That file was long, so we used the first part. Trim the text below to focus on a section.');
      if (!title) setTitle(picked.name.replace(/\.(pdf|txt|jpe?g|png|webp|gif)$/i, ''));
    } catch {
      setError('Could not reach the server to read that file. Check your connection and try again.'); setReadFailed(true);
    } finally { setExtracting(false); }
  }

  function removeFile() {
    setFile(null); setPreview(''); setReadFailed(false); setError(''); setNotice('');
    if (textFromFile) { setText(''); setTextFromFile(false); }
    if (inputRef.current) inputRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (submitting.current || extracting) return;
    setError('');
    if (text.trim().length < 50) { setError('Add a bit more text first. We need a few sentences.'); return; }
    submitting.current = true;
    setStage('creating');
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

      setStage('saving');
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
        router.push(`/deck/${deck.id}?new=1`);
      }
    } catch {
      setError('We generated your set but could not save it. Please try again.');
    } finally { setLoading(false); submitting.current = false; }
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
          <ol className="up-stages" aria-label="Progress">
            <li className="is-done">Notes ready</li>
            <li className={stage === 'creating' ? 'is-on' : 'is-done'} aria-current={stage === 'creating' ? 'step' : undefined}>Creating flashcards and a quiz</li>
            <li className={stage === 'saving' ? 'is-on' : ''} aria-current={stage === 'saving' ? 'step' : undefined}>Saving your deck</li>
          </ol>
          <p className="working__step" role="status" style={{ marginTop: 'var(--s-3)' }}>
            {stage === 'creating'
              ? 'This usually takes under a minute. Please keep this page open.'
              : 'Almost there.'}
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

          <div className="tabs" role="tablist" aria-label="How to add your notes"
               onKeyDown={(e) => {
                 if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                 e.preventDefault();
                 setMode((m) => (m === 'file' ? 'paste' : 'file'));
               }}>
            <button type="button" role="tab" id="up-tab-file" aria-selected={mode === 'file'}
                    aria-controls="up-drop" tabIndex={mode === 'file' ? 0 : -1}
                    className={`tab${mode === 'file' ? ' tab--on' : ''}`} onClick={() => setMode('file')}>Upload a file</button>
            <button type="button" role="tab" id="up-tab-paste" aria-selected={mode === 'paste'}
                    aria-controls="notes" tabIndex={mode === 'paste' ? 0 : -1}
                    className={`tab${mode === 'paste' ? ' tab--on' : ''}`} onClick={() => setMode('paste')}>Paste text</button>
          </div>

          {mode === 'file' && (
            <div id="up-drop" className="up-pick"
                 onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                 onDragLeave={() => setDragging(false)}
                 onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files?.[0]); }}>
              <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => readFile(e.target.files?.[0])} />
              {/* Opens the rear camera on phones; the picture comes back as a normal JPEG. */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => readFile(e.target.files?.[0])} />

              {!file ? (
                // role="button": a click/keyboard-activatable file picker.
                <div className={`drop${dragging ? ' drop--active' : ''}`} role="button" tabIndex={0}
                     aria-describedby="up-limits"
                     onClick={() => inputRef.current?.click()}
                     onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}>
                  <div>
                    <div className="drop__icon drop__icon--tile">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <path d="m7 10 5-5 5 5" /><path d="M12 5v12" />
                      </svg>
                    </div>
                    <div className="drop__title">Drop a PDF or photo here, or click to choose</div>
                    <div className="drop__chips" aria-hidden="true">
                      <span className="drop__chip">PDF</span>
                      <span className="drop__chip">Photo</span>
                      <span className="drop__chip">Text</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`up-file${dragging ? ' up-file--drag' : ''}`}>
                  {preview
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={preview} alt="" className="up-file__thumb" />
                    : <span className="up-file__badge" aria-hidden="true">{fileKind(file) === 'pdf' ? 'PDF' : 'TXT'}</span>}
                  <div className="up-file__meta">
                    <strong>{file.name}</strong>
                    <span role="status">
                      {formatSize(file.size)} · {extracting
                        ? (fileKind(file) === 'image' ? 'Uploading and reading your photo…' : 'Uploading and reading your file…')
                        : readFailed ? 'Couldn’t read this file' : 'Text ready below'}
                    </span>
                  </div>
                  <div className="up-file__tools">
                    {extracting
                      ? <span className="spinner spinner--ink" style={{ width: 22, height: 22 }} aria-hidden="true" />
                      : (
                        <>
                          {readFailed && <button type="button" className="btn btn--primary" onClick={() => readFile(file)}>Try again</button>}
                          <button type="button" className="btn btn--ghost" onClick={() => inputRef.current?.click()}>Replace</button>
                          <button type="button" className="btn btn--quiet" onClick={removeFile} aria-label={`Remove ${file.name}`}>Remove</button>
                        </>
                      )}
                  </div>
                </div>
              )}

              <div className="up-pick__row">
                <button type="button" className="btn btn--ghost up-camera" onClick={() => cameraRef.current?.click()} disabled={extracting}>Take a photo</button>
                <p id="up-limits" className="small muted">
                  One file at a time. PDF or .txt up to 15 MB; photos (JPG, PNG, WebP, GIF) up to 5 MB.
                  For photos, use a clear photo with the whole page in frame.
                </p>
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
            <button type="submit" className="btn btn--primary btn--lg" disabled={extracting || loading}>
              Generate flashcards &amp; quiz
            </button>
            <a href="/decks" className="btn btn--ghost btn--lg">Cancel</a>
          </div>
          <p className="small muted">Daily and monthly limits depend on your plan. If you reach one, you&apos;ll see a message here saying when it resets.</p>
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
