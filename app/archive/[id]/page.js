'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';

const money = (c) => `$${(c / 100).toFixed(2)}`;

function ArchiveDeckInner() {
  const { id } = useParams();
  const router = useRouter();
  const justPurchased = useSearchParams().get('purchased') === '1';

  const [preview, setPreview] = useState(null);
  const [owned, setOwned] = useState(false);
  const [status, setStatus] = useState('loading');
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    // Preview is a capped RPC — never the full deck. Safe for logged-out users.
    const { data, error } = await supabase.rpc('archive_preview', { p_deck_id: id });
    if (error || !data?.length) { setStatus('missing'); return; }
    setPreview({
      title: data[0].title,
      course_label: data[0].course_label,
      price_cents: data[0].price_cents,
      samples: data.filter((r) => r.sample_question),
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: purchase } = await supabase.from('deck_purchases')
        .select('id').eq('deck_id', id).eq('buyer_user_id', session.user.id).maybeSingle();
      setOwned(!!purchase);
    }
    setStatus('ready');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Stripe's webhook may land a moment after the success redirect, so re-check
  // briefly rather than telling a paying user they don't own the deck.
  useEffect(() => {
    if (!justPurchased || owned) return;
    const t = setInterval(load, 1500);
    const stop = setTimeout(() => clearInterval(t), 15000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [justPurchased, owned, load]);

  async function buy() {
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push(`/login?next=${encodeURIComponent(`/archive/${id}`)}`); return; }

    setBuying(true);
    try {
      const res = await fetch('/api/archive/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ deckId: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyOwned) { setOwned(true); return; }
        setError(data.error || 'Could not start checkout.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Could not reach the server.');
    } finally { setBuying(false); }
  }

  if (status === 'loading') return <main className="page"><div className="skeleton" style={{ height: 340 }} /></main>;
  if (status === 'missing') {
    return <main className="page"><div className="empty">
      <h3>This deck isn&apos;t in the archive</h3>
      <p>It may have been unlisted by its owner.</p>
      <a href="/archive" className="btn btn--primary">Browse the archive</a>
    </div></main>;
  }

  return (
    <main className="page page--narrow">
      <div className="card animate-in" style={{ padding: 'var(--s-6)' }}>
        <span className="badge badge--accent">Campus Archive</span>
        <h1 style={{ marginTop: 'var(--s-3)', fontSize: 'var(--text-2xl)' }}>{preview.title}</h1>
        {preview.course_label && <p className="muted small" style={{ marginTop: 'var(--s-2)' }}>{preview.course_label}</p>}

        {owned ? (
          <>
            <div className="alert alert--note" style={{ marginTop: 'var(--s-5)' }}>
              You own this deck — it&apos;s saved to your account.
            </div>
            <a href={`/study?deck=${id}`} className="btn btn--primary btn--block btn--lg" style={{ marginTop: 'var(--s-4)' }}>
              Start studying
            </a>
          </>
        ) : (
          <>
            {justPurchased && (
              <div className="alert alert--note" style={{ marginTop: 'var(--s-5)' }}>
                <span className="spinner spinner--ink" style={{ marginRight: 8 }} />
                Confirming your payment — this usually takes a few seconds.
              </div>
            )}
            <p className="muted" style={{ marginTop: 'var(--s-4)' }}>
              Unlock the full deck — every flashcard and the practice quiz — permanently, for a one-time
              payment. Made by a student who already took this course.
            </p>
            {error && <div className="alert alert--error" style={{ marginTop: 'var(--s-4)' }}>{error}</div>}
            <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 'var(--s-5)' }}
                    onClick={buy} disabled={buying}>
              {buying && <span className="spinner" />}
              {buying ? 'Opening checkout…' : `Unlock for ${money(preview.price_cents)}`}
            </button>
          </>
        )}
      </div>

      {preview.samples.length > 0 && (
        <div style={{ marginTop: 'var(--s-6)' }}>
          <h3 style={{ marginBottom: 'var(--s-2)' }}>Sample cards</h3>
          <p className="small muted" style={{ marginBottom: 'var(--s-4)' }}>
            A few cards from this deck, so you know what you&apos;re getting.
          </p>
          <div className="stack">
            {preview.samples.map((s, i) => (
              <div key={i} className="card">
                <div style={{ fontWeight: 650, marginBottom: 4 }}>{s.sample_question}</div>
                <div className="small muted">{s.sample_answer}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

export default function ArchiveDeckPage() {
  return (
    <Suspense fallback={<main className="page"><div className="skeleton" style={{ height: 340 }} /></main>}>
      <ArchiveDeckInner />
    </Suspense>
  );
}
