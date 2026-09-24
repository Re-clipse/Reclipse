'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { hasArchiveAccess, startArchiveCheckout, getArchivePrice, formatArchivePrice } from '@/lib/archive';

function ArchiveDeckInner() {
  const { id } = useParams();
  const router = useRouter();
  const justSubscribed = useSearchParams().get('subscribed') === '1';

  const [preview, setPreview] = useState(null);
  const [access, setAccess] = useState(false);
  const [mine, setMine] = useState(false);
  const [status, setStatus] = useState('loading');
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState('');
  const [price, setPrice] = useState(null);

  const load = useCallback(async () => {
    // Preview is a capped RPC — never the full deck. Safe for logged-out users.
    const { data, error } = await supabase.rpc('archive_preview', { p_deck_id: id });
    if (error || !data?.length) { setStatus('missing'); return; }
    setPreview({
      title: data[0].title,
      course_label: data[0].course_label,
      samples: data.filter((r) => r.sample_question),
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // Your own deck, a legacy purchase, or an active subscription all grant access.
      const [{ data: own }, { data: purchase }, sub] = await Promise.all([
        supabase.from('decks').select('id').eq('id', id).eq('user_id', session.user.id).maybeSingle(),
        supabase.from('deck_purchases').select('id').eq('deck_id', id).eq('buyer_user_id', session.user.id).maybeSingle(),
        hasArchiveAccess(),
      ]);
      setMine(!!own);
      setAccess(!!own || !!purchase || sub);
    }
    setStatus('ready');
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getArchivePrice().then(setPrice); }, []);

  // Stripe's webhook may land a moment after the success redirect, so re-check
  // briefly rather than telling a paying user they don't have access yet.
  useEffect(() => {
    if (!justSubscribed || access) return;
    const t = setInterval(load, 1500);
    const stop = setTimeout(() => clearInterval(t), 15000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [justSubscribed, access, load]);

  async function subscribe() {
    setError('');
    setSubscribing(true);
    try {
      const r = await startArchiveCheckout(id);
      if (r.needsLogin) { router.push(`/login?next=${encodeURIComponent(`/archive/${id}`)}`); return; }
      if (r.alreadySubscribed) { setAccess(true); return; }
      if (!r.ok) { setError(r.error || 'Could not start checkout.'); return; }
      window.location.href = r.url;
    } catch {
      setError('Could not reach the server.');
    } finally { setSubscribing(false); }
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
      <div className="card animate-in u-p-6">
        <span className="badge badge--accent">Campus Archive</span>
        <h1 style={{ marginTop: 'var(--s-3)', fontSize: 'var(--text-2xl)' }}>{preview.title}</h1>
        {preview.course_label && <p className="muted small u-mt-2">{preview.course_label}</p>}

        {access ? (
          <>
            <div className="alert alert--note u-mt-5">
              {mine ? 'This is your deck. It\u2019s listed in the Campus Archive.' : 'Included with your Campus Archive membership.'}
            </div>
            <a href={`/study?deck=${id}`} className="btn btn--primary btn--block btn--lg u-mt-4">
              Start studying
            </a>
          </>
        ) : (
          <>
            {justSubscribed && (
              <div className="alert alert--note u-mt-5">
                <span className="spinner spinner--ink" style={{ marginRight: 8 }} />
                Confirming your subscription. This usually takes a few seconds.
              </div>
            )}
            <p className="muted u-mt-4">
              Campus Archive members can study every archived deck: all the flashcards and practice
              quizzes, shared by other students taking (or who&apos;ve taken) the course.
            </p>
            {error && <div className="alert alert--error u-mt-4">{error}</div>}
            <button className="btn btn--primary btn--block btn--lg u-mt-5"
                    onClick={subscribe} disabled={subscribing}>
              {subscribing && <span className="spinner" />}
              {subscribing ? 'Opening checkout…' : price ? `Subscribe — ${formatArchivePrice(price)}` : 'Subscribe to unlock'}
            </button>
            <p className="small muted center u-mt-3">
              {price ? formatArchivePrice(price) : 'Monthly membership'} · cancel any time, access continues
              to the end of the period you&apos;ve paid for
            </p>
          </>
        )}
      </div>

      {preview.samples.length > 0 && (
        <div className="u-mt-6">
          <h3 className="u-mb-2">Sample cards</h3>
          <p className="small muted u-mb-4">
            A few cards from this deck, so you know what you get with membership.
          </p>
          <div className="stack">
            {preview.samples.map((s, i) => (
              <div key={i} className="card">
                <div className="u-fw-650 u-mb-1">{s.sample_question}</div>
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
