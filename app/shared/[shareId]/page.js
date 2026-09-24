'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SharedDeckPage() {
  const { shareId } = useParams();
  const router = useRouter();

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [quizCount, setQuizCount] = useState(0);
  const [status, setStatus] = useState('loading');
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(true); // assume signed in until checked, to avoid a flash of the note

  useEffect(() => {
    (async () => {
      // Readable without login: RLS allows select where is_public = true.
      const { data: d } = await supabase.from('decks')
        .select('id, title, summary, is_public').eq('share_id', shareId).maybeSingle();
      if (!d || !d.is_public) { setStatus('missing'); return; }
      const [{ data: c }, { count }] = await Promise.all([
        supabase.from('flashcards').select('id, question, answer, card_type').eq('deck_id', d.id),
        supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('deck_id', d.id),
      ]);
      setDeck(d); setCards(c || []); setQuizCount(count || 0); setStatus('ready');
    })();
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, [shareId]);

  async function copyToAccount() {
    setError('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(`/shared/${shareId}`)}`);
      return;
    }
    setCopying(true);
    try {
      const { data: newDeck, error: de } = await supabase.from('decks').insert({
        user_id: session.user.id, title: deck.title, summary: deck.summary, copied_from: deck.id,
      }).select().single();
      if (de) throw de;

      if (cards.length) {
        await supabase.from('flashcards').insert(cards.map((c) => ({
          deck_id: newDeck.id, question: c.question, answer: c.answer, card_type: c.card_type || 'basic',
        })));
      }
      const { data: qs } = await supabase.from('quiz_questions')
        .select('question, options, correct_index, explanation').eq('deck_id', deck.id);
      if (qs?.length) {
        await supabase.from('quiz_questions').insert(qs.map((q) => ({ ...q, deck_id: newDeck.id })));
      }
      router.push(`/deck/${newDeck.id}`);
    } catch {
      setError("We couldn't copy this deck. Please try again.");
      setCopying(false);
    }
  }

  if (status === 'loading') return <main className="page"><div className="skeleton" style={{ height: 320 }} /></main>;

  if (status === 'missing') {
    return (
      <main className="page"><div className="empty">
        <h3>This deck isn&apos;t available</h3>
        <p>The link may be wrong, or sharing was turned off.</p>
        <a href="/" className="btn btn--primary">Go to Reclipse</a>
      </div></main>
    );
  }

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <span className="badge">Shared deck</span>
          <h1 className="u-mt-3">{deck.title}</h1>
          <p>{cards.length} flashcards · {quizCount} quiz questions</p>
        </div>
        <div className="stack" style={{ alignItems: 'flex-end', gap: 'var(--s-1)' }}>
          <button className="btn btn--primary" onClick={copyToAccount} disabled={copying}>
            {copying && <span className="spinner" />}
            {copying ? 'Copying…' : 'Save to my decks'}
          </button>
          {!signedIn && <span className="small muted">You&apos;ll need a free account</span>}
        </div>
      </div>

      {error && <div className="alert alert--error u-mb-4">{error}</div>}

      {deck.summary && (
        <div className="summary-box u-mb-5">{deck.summary}</div>
      )}

      <h3 className="u-mb-4">Preview</h3>
      <div className="stack">
        {cards.slice(0, 5).map((c) => (
          <div key={c.id} className="card">
            <div className="u-fw-650 u-mb-1">{c.question}</div>
            <div className="small muted">{c.answer}</div>
          </div>
        ))}
      </div>

      {cards.length > 5 && (
        <div className="empty u-mt-5">
          <h3>+ {cards.length - 5} more cards</h3>
          <p>Save this deck to your account to study all of it with spaced repetition.</p>
          <button className="btn btn--primary btn--lg" onClick={copyToAccount} disabled={copying}>
            Save to my decks
          </button>
        </div>
      )}
    </main>
  );
}
