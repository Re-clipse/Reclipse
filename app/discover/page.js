'use client';

import { useEffect, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import Mascot from '@/components/Mascot';
import LoadError from '@/components/LoadError';
import { withTimeout } from '@/lib/net';

export default function DiscoverPage() {
  const [decks, setDecks] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  async function load(course) {
    setError('');
    try {
      const { data, error } = await withTimeout(supabase.rpc('popular_decks', {
        p_course: course?.trim() || null,
        p_limit: 30,
      }), 12000, 'discover');
      if (error) { setError("Couldn't load popular decks. This is usually a connection hiccup."); setDecks([]); return; }
      setDecks(data || []);
    } catch {
      setError("Couldn't load popular decks. This is usually a connection hiccup.");
      setDecks([]);
    }
  }

  useEffect(() => { load(''); }, []);

  return (
    <main className="page page--wide">
      <div className="page__head">
        <div>
          <h1>Campus popular</h1>
          <p>The most-studied shared decks across every Reclipse user. Browsing is anonymous — no login needed, and we don&apos;t show who shared what.</p>
        </div>
      </div>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input className="input" aria-label="Filter by course" placeholder="Filter by course, e.g. BI110" value={q}
                 onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn--ghost">Search</button>
      </form>

      {error && decks && decks.length > 0 && <div role="alert" className="alert alert--error">{error}</div>}

      {decks === null ? (
        <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 76 }} />)}</div>
      ) : error && decks.length === 0 ? (
        <LoadError message={error} onRetry={() => { setDecks(null); load(q); }} />
      ) : decks.length === 0 ? (
        <div className="empty">
          <div className="mascot-wrap">
            <Mascot mood="thinking" size={92} />
          </div>
          <h3>Nothing shared yet</h3>
          <p>
            Nobody&apos;s turned on sharing for a deck in this course yet. Be the first:
            open one of your decks and turn on sharing in Settings.
          </p>
          <a href="/decks" className="btn btn--primary">My decks</a>
        </div>
      ) : (
        <div className="stack">
          {decks.map((d, i) => (
            <a key={d.id} href={`/shared/${d.share_id}`}
               className="card card--link deck rise" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <div style={{ minWidth: 0 }}>
                <div className="deck__title">{d.title}</div>
                <div className="deck__meta">
                  {d.course_label && <span className="badge">{d.course_label}</span>}
                  <span>{d.activity} study session{d.activity === 1 ? '' : 's'}</span>
                </div>
              </div>
              <span className="btn btn--ghost">View</span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
