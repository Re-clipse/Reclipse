'use client';

import { useEffect, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import Mascot from '@/components/Mascot';

export default function DiscoverPage() {
  const [decks, setDecks] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  async function load(course) {
    setError('');
    const { data, error } = await supabase.rpc('popular_decks', {
      p_course: course?.trim() || null,
      p_limit: 30,
    });
    if (error) { setError("Couldn't load popular decks right now."); setDecks([]); return; }
    setDecks(data || []);
  }

  useEffect(() => { load(''); }, []);

  return (
    <main className="page page--wide">
      <div className="page__head">
        <div>
          <h1>Campus popular</h1>
          <p>The most-studied shared decks across every Reclipse user \u2014 anonymous, no login needed to browse.</p>
        </div>
      </div>

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input className="input" placeholder="Filter by course, e.g. BI110" value={q}
                 onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn--ghost">Search</button>
      </form>

      {error && <div className="alert alert--error">{error}</div>}

      {decks === null ? (
        <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 76 }} />)}</div>
      ) : decks.length === 0 ? (
        <div className="empty">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
            <Mascot mood="thinking" size={92} />
          </div>
          <h3>Nothing shared yet</h3>
          <p>
            Nobody&apos;s turned on sharing for a deck in this course yet. Be the first \u2014
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
