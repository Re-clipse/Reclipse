'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/components/Toast';
import { hasPremiumAccess, startPremiumCheckout, getPremiumPrice, formatPremiumPrice } from '@/lib/premium';
import { MAX_TURNS } from '@/lib/labPrep';

async function callLabPrep(body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Please log in to use Lab Prep.' };
  const res = await fetch('/api/lab-prep', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, ...data };
}

function LabPrepInner() {
  const params = useSearchParams();
  const preDeckId = params.get('deck') || '';
  const preCourse = params.get('course') || '';
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const inputRef = useRef(null);
  const threadEnd = useRef(null);

  const [premiumLoading, setPremiumLoading] = useState(true);
  const [premium, setPremium] = useState(false);
  const [price, setPrice] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  const [decks, setDecks] = useState([]);
  const [deckId, setDeckId] = useState(preDeckId);
  const [mode, setMode] = useState(preDeckId ? 'deck' : 'text');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const [thread, setThread] = useState([]); // [{role, content}]
  const [started, setStarted] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const inputFileRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const premiumOk = await hasPremiumAccess();
      setPremium(premiumOk);
      setPremiumLoading(false);
      if (!premiumOk) setPrice(await getPremiumPrice('month'));
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !premium) return;
    supabase.from('decks').select('id, title').is('deleted_at', null).order('created_at', { ascending: false })
      .then(({ data }) => setDecks(data || []));
  }, [user, premium]);

  useEffect(() => { threadEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);

  async function upgrade() {
    setUpgrading(true);
    const res = await startPremiumCheckout('month');
    setUpgrading(false);
    if (res.needsLogin) { toast('Please log in first', 'error'); return; }
    if (res.url) window.location.href = res.url;
    else toast(res.error || 'Could not start checkout. Please try again.', 'error');
  }

  async function readFile(file) {
    if (!file) return;
    setFileName(file.name); setError(''); setExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/extract-pdf', {
        method: 'POST', body, headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not read that file.'); setFileName(''); return; }
      setPastedText(data.text);
    } catch {
      setError('Could not read that file. Try pasting the text instead.'); setFileName('');
    } finally { setExtracting(false); }
  }

  async function begin() {
    setError('');
    const usingDeck = mode === 'deck' && deckId;
    if (!usingDeck && pastedText.trim().length < 50) {
      setError('Select a deck, or add at least a few sentences of material.');
      return;
    }
    setStarting(true);
    const firstMessage = { role: 'user', content: 'Generate lab-style practice problems from this material.' };
    const res = await callLabPrep({
      deckId: usingDeck ? deckId : undefined,
      sourceText: usingDeck ? undefined : pastedText,
      messages: [firstMessage],
    });
    setStarting(false);
    if (!res.ok) {
      // TEMPORARY: appending res.detail while this route is being debugged — remove
      // alongside the matching TEMPORARY block in app/api/lab-prep/route.js.
      setError((res.error || 'Something went wrong. Please try again.') + (res.detail ? ` [${res.detail}]` : ''));
      return;
    }
    setThread([firstMessage, { role: 'assistant', content: res.reply }]);
    setStarted(true);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    const next = [...thread, { role: 'user', content: text }];
    setThread(next);
    const usingDeck = mode === 'deck' && deckId;
    const res = await callLabPrep({
      deckId: usingDeck ? deckId : undefined,
      sourceText: usingDeck ? undefined : pastedText,
      messages: next,
    });
    setSending(false);
    if (!res.ok) {
      toast(res.error || 'Something went wrong. Please try again.', 'error');
      setThread(thread); // roll back the optimistic user message
      setDraft(text);
      return;
    }
    setThread((t) => [...t, { role: 'assistant', content: res.reply }]);
  }

  function newSession() {
    setStarted(false); setThread([]); setDraft(''); setError('');
  }

  if (authLoading || premiumLoading) {
    return <main className="page"><div className="skeleton" style={{ height: 420 }} /></main>;
  }

  if (!premium) {
    return (
      <main className="page page--narrow">
        <PageHeader accent="pink" icon={ICONS.labPrep} title="Lab Prep"
          subtitle="An AI tutor that turns your decks or notes into lab-style practice problems, with hints and worked solutions on request." />
        <div className="card center animate-in" style={{ padding: 'var(--s-7)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Reclipse Plus feature</h2>
          <p className="muted" style={{ marginTop: 'var(--s-3)' }}>
            Lab Prep generates practice problems from a deck or your own notes, then walks through
            hints, worked solutions, and harder variants with you — available on Reclipse Plus.
          </p>
          <button className="btn btn--primary btn--lg" style={{ marginTop: 'var(--s-5)' }} disabled={upgrading} onClick={upgrade}>
            {upgrading && <span className="spinner" />}
            {upgrading ? 'Redirecting…' : `Upgrade to Reclipse Plus${price ? ` — ${formatPremiumPrice(price)}` : ''}`}
          </button>
        </div>
      </main>
    );
  }

  if (started) {
    const turnsUsed = thread.filter((m) => m.role === 'user').length;
    const atLimit = turnsUsed >= MAX_TURNS;
    return (
      <main className="page page--narrow">
        <PageHeader accent="pink" icon={ICONS.labPrep} title="Lab Prep"
          subtitle="Ask for a hint, a worked solution, or a harder variant of any problem above."
          action={<button className="btn btn--quiet" onClick={newSession}>New session</button>} />

        <div className="chat">
          {thread.map((m, i) => (
            <div key={i} className={`msg ${m.role === 'user' ? 'msg--me' : 'msg--ai'}`}>{m.content}</div>
          ))}
          {sending && <div className="msg msg--ai"><span className="spinner spinner--ink" /></div>}
          <div ref={threadEnd} />
        </div>

        <div className="chat__composer">
          <input ref={inputRef} className="input" placeholder={atLimit ? 'Session limit reached — start a new one to continue.' : 'Ask for a hint, a solution, or a harder version…'}
                 value={draft} disabled={sending || atLimit}
                 onChange={(e) => setDraft(e.target.value)}
                 onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn btn--primary" disabled={sending || atLimit || !draft.trim()} onClick={send}>Send</button>
        </div>
        {atLimit && <p className="small muted" style={{ marginTop: 'var(--s-2)' }}>Start a new session to keep going.</p>}
      </main>
    );
  }

  return (
    <main className="page page--narrow">
      <PageHeader accent="pink" icon={ICONS.labPrep} title="Lab Prep"
        subtitle="Pick a deck or add your notes, and get lab-style practice problems with hints and worked solutions on request." />

      {preCourse && !preDeckId && (
        <div className="alert alert--note" style={{ marginBottom: 'var(--s-4)' }}>
          Prepping for {preCourse}&apos;s lab — add that course&apos;s notes or pick a matching deck below.
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Source material"
           onKeyDown={(e) => {
             if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
             e.preventDefault();
             setMode((m) => (m === 'deck' ? 'text' : 'deck'));
           }}>
        <button type="button" role="tab" id="lp-tab-deck" aria-selected={mode === 'deck'}
                aria-controls="lp-panel" tabIndex={mode === 'deck' ? 0 : -1}
                className={`tab${mode === 'deck' ? ' tab--on' : ''}`} onClick={() => setMode('deck')}>Use a deck</button>
        <button type="button" role="tab" id="lp-tab-text" aria-selected={mode === 'text'}
                aria-controls="lp-panel" tabIndex={mode === 'text' ? 0 : -1}
                className={`tab${mode === 'text' ? ' tab--on' : ''}`} onClick={() => setMode('text')}>Upload or paste notes</button>
      </div>

      <div id="lp-panel" role="tabpanel" className="stack" style={{ gap: 'var(--s-4)', marginTop: 'var(--s-4)' }}>
        {mode === 'deck' ? (
          decks.length ? (
            <div className="field">
              <label className="label" htmlFor="lp-deck">Deck</label>
              <select id="lp-deck" className="input" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
                <option value="">Choose a deck…</option>
                {decks.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
          ) : (
            <p className="muted">You don&apos;t have any decks yet. <a href="/upload">Create one</a>, or switch to notes.</p>
          )
        ) : (
          <>
            <div
              className={`drop${fileName && !extracting ? ' drop--done' : ''}`}
              onClick={() => inputFileRef.current?.click()}
              role="button" tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputFileRef.current?.click()}
            >
              <input ref={inputFileRef} type="file" accept=".pdf,.txt,image/*" hidden
                     onChange={(e) => readFile(e.target.files?.[0])} />
              <div>
                <div className="drop__title">
                  {extracting ? 'Reading your file…' : fileName ? `Loaded: ${fileName}` : 'Drop a file here, or click to browse'}
                </div>
                <div className="drop__hint">PDF, text file, or a photo — or just paste below.</div>
              </div>
            </div>
            <div className="field">
              <label className="label" htmlFor="lp-notes">Notes</label>
              <textarea id="lp-notes" className="textarea textarea--tall" value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)} placeholder="Paste the material to build practice problems from." />
            </div>
          </>
        )}

        {error && <div role="alert" className="alert alert--error">{error}</div>}

        <button className="btn btn--primary btn--lg" disabled={starting || extracting} onClick={begin}>
          {starting && <span className="spinner" />}{starting ? 'Generating…' : 'Generate practice problems'}
        </button>
      </div>
    </main>
  );
}

export default function LabPrepPage() {
  return (
    <Suspense fallback={<main className="page"><div className="skeleton" style={{ height: 420 }} /></main>}>
      <LabPrepInner />
    </Suspense>
  );
}
