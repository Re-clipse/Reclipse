'use client';

import { useEffect, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { withTimeout } from '@/lib/net';
import Mascot from '@/components/Mascot';

const money = (c) => `$${(c / 100).toFixed(2)}`;

export default function ArchivePage() {
  const [decks, setDecks] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  async function load(course) {
    setError('');
    try {
      const { data, error } = await withTimeout(supabase.rpc('archive_listings', {
        p_course: course?.trim() || null, p_limit: 40,
      }), 12000, 'archive');
      if (error) { setError("Couldn't load the archive right now."); setDecks([]); return; }
      setDecks(data || []);
    } catch {
      setError("Couldn't load the archive — this is usually a connection hiccup.");
      setDecks([]);
    }
  }

  useEffect(() => { load(''); }, []);

  return (
    <main className="page page--wide">
      <PageHeader accent="amber" icon={ICONS.archive} title="Campus Archive"
        subtitle="Complete study sets for specific courses, made by students who already sat the exams. One-time unlock, yours permanently." />

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input className="input" placeholder="Search by course, e.g. BI110" value={q}
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
            <Mascot mood="happy" size={92} />
          </div>
          <h3>Nothing in the archive yet</h3>
          <p>
            No one has listed a deck for this course. If you&apos;ve built a good one, you can list it
            from your deck&apos;s Settings tab.
          </p>
          <a href="/decks" className="btn btn--primary">My decks</a>
        </div>
      ) : (
        <div className="stack">
          {decks.map((d, i) => (
            <a key={d.id} href={`/archive/${d.id}`}
               className="card card--link deck rise" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <div style={{ minWidth: 0 }}>
                <div className="deck__title">{d.title}</div>
                <div className="deck__meta">
                  {d.course_label && <span className="badge">{d.course_label}</span>}
                  <span>{d.activity} study session{d.activity === 1 ? '' : 's'}</span>
                </div>
              </div>
              <span className="btn btn--primary">{money(d.price_cents)}</span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
