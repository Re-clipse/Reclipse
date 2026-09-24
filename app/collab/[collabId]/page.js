'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function JoinCollabPage() {
  const { collabId } = useParams();
  const router = useRouter();
  const [status, setStatus] = useState('checking'); // checking | redirecting | joining | error
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('redirecting');
        router.replace(`/login?next=${encodeURIComponent(`/collab/${collabId}`)}`);
        return;
      }
      setStatus('joining');
      try {
        const res = await fetch('/api/join-collab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ collabId }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Could not join this deck.'); setStatus('error'); return; }
        router.replace(`/deck/${data.deckId}`);
      } catch {
        setError('Could not reach the server. Check your connection and try again.'); setStatus('error');
      }
    })();
  }, [collabId, router]);

  if (status === 'error') {
    return (
      <main className="page page--narrow"><div className="empty">
        <h3>Couldn&apos;t join</h3><p>{error}</p>
        <a href="/decks" className="btn btn--primary">My decks</a>
      </div></main>
    );
  }

  const message = status === 'redirecting'
    ? 'You need a free Reclipse account to join this shared deck. Taking you to log in…'
    : 'Joining this shared deck — you’ll be able to view and edit its flashcards…';

  return (
    <main className="page page--narrow">
      <div className="card" style={{ textAlign: 'center', padding: 'var(--s-6)' }}>
        <div className="skeleton" style={{ height: 120, marginBottom: 'var(--s-4)' }} />
        <p className="muted">{message}</p>
      </div>
    </main>
  );
}
