'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader, { ICONS, ACCENTS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { withTimeout } from '@/lib/net';
import Mascot from '@/components/Mascot';
import LoadError from '@/components/LoadError';
import { hasArchiveAccess, startArchiveCheckout, openBillingPortal, getArchivePrice, formatArchivePrice } from '@/lib/archive';

// "BI110 — Cell Biology" -> { code: 'BI110', name: 'Cell Biology' }
function splitCourse(label) {
  const m = (label || '').split(/\s+[—–-]\s+/);
  return m.length > 1 ? { code: m[0], name: m.slice(1).join(' - ') } : { code: label || 'Other', name: '' };
}

export default function ArchivePage() {
  const [decks, setDecks] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [member, setMember] = useState(null);
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState(null);
  const router = useRouter();

  async function load(query) {
    setError('');
    try {
      const { data, error } = await withTimeout(supabase.rpc('archive_listings', {
        p_course: query?.trim() || null, p_limit: 40,
      }), 12000, 'archive');
      if (error) { setError("Couldn't load the archive right now."); setDecks([]); return; }
      setDecks(data || []);
    } catch {
      setError("Couldn't load the archive. This is usually a connection hiccup.");
      setDecks([]);
    }
  }

  useEffect(() => { load(''); }, []);
  useEffect(() => { hasArchiveAccess().then(setMember).catch(() => setMember(false)); }, []);
  useEffect(() => { getArchivePrice().then(setPrice); }, []);

  async function membershipAction(fn) {
    setError(''); setBusy(true);
    try {
      const r = await fn();
      if (r.needsLogin) { router.push('/login?next=%2Farchive'); return; }
      if (r.alreadySubscribed) { setMember(true); return; }
      if (!r.ok) { setError(r.error || 'Something went wrong. Please try again.'); return; }
      window.location.href = r.url;
    } catch { setError('Could not reach the server.'); } finally { setBusy(false); }
  }

  // One shelf per course, most-studied sets first (the RPC already orders by activity).
  const shelves = useMemo(() => {
    const m = new Map();
    for (const d of decks || []) {
      const key = d.course_label || '';
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(d);
    }
    return [...m.entries()]
      .map(([label, items]) => ({ label, ...splitCourse(label), items, best: items[0]?.activity || 0 }))
      .sort((x, y) => y.best - x.best);
  }, [decks]);

  return (
    <main className="page page--wide">
      <PageHeader accent="amber" icon={ICONS.archive} title="Campus Archive"
        subtitle="Complete study sets for specific courses, shared by other students taking (or who've taken) them." />

      {member === false && (
        <div className="card member-card">
          <Mascot mood="happy" size={64} />
          <div className="member-card__text">
            <strong>Study every set in the archive</strong>
            <p className="small muted">
              {price ? `${formatArchivePrice(price)} unlocks` : 'One monthly membership unlocks'} all the
              flashcards and quizzes below. Cancel any time — you keep access through the end of the
              period you&apos;ve already paid for.
            </p>
          </div>
          <button className="btn btn--page" disabled={busy}
                  style={{ '--pa': ACCENTS.amber.solid }} onClick={() => membershipAction(() => startArchiveCheckout())}>
            {busy ? 'Opening…' : price ? `Get access — ${formatArchivePrice(price)}` : 'Get access'}
          </button>
        </div>
      )}
      {member === true && (
        <p className="small muted member-note">
          You have full Archive access.{' '}
          <button className="linklike" disabled={busy} onClick={() => membershipAction(openBillingPortal)}>Manage membership</button>
        </p>
      )}

      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input className="input" aria-label="Search by course" placeholder="Search by course, e.g. BI110" value={q}
                 onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn--ghost">Search</button>
      </form>

      {error && decks && decks.length > 0 && <div role="alert" className="alert alert--error">{error}</div>}

      {decks === null ? (
        <div className="stack">
          {[0, 1].map((i) => (
            <div key={i}>
              <div className="skeleton" style={{ height: 28, width: 220, marginBottom: 'var(--s-4)' }} />
              <div className="shelf__scroll">{[0, 1, 2].map((j) => <div key={j} className="skeleton" style={{ height: 168, flex: '0 0 260px' }} />)}</div>
            </div>
          ))}
        </div>
      ) : error && decks.length === 0 ? (
        <LoadError message={error} onRetry={() => { setDecks(null); load(q); }} />
      ) : decks.length === 0 ? (
        <div className="empty">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
            <Mascot mood="thinking" size={92} float />
          </div>
          <h3>Nothing in the archive yet</h3>
          <p>
            No one has listed a deck for this course. If you&apos;ve built a good one, you can list it
            from your deck&apos;s Settings tab.
          </p>
          <a href="/decks" className="btn btn--primary">My decks</a>
        </div>
      ) : (
        <div>
          {shelves.map((sh, si) => (
            <section key={sh.label || 'other'} className="shelf">
              <div className="shelf__head">
                <span className="badge badge--accent">{sh.code}</span>
                {sh.name && <h2 className="shelf__title">{sh.name}</h2>}
                <span className="shelf__count">· {sh.items.length} set{sh.items.length === 1 ? '' : 's'}</span>
              </div>
              <div className="shelf__scroll">
                {sh.items.map((d, i) => {
                  const popular = sh.best > 0 && d.activity === sh.best;
                  return (
                    <a key={d.id} href={`/archive/${d.id}`} className="card card--link shelf-tile rise"
                       style={{ animationDelay: `${Math.min(si * 3 + i, 10) * 40}ms` }}>
                      {popular && <span className="badge badge--accent shelf-tile__flag">Most studied</span>}
                      <div className="shelf-tile__title">{d.title}</div>
                      <div className="shelf-tile__foot">
                        <span className="shelf-tile__sessions">
                          {d.activity} study session{d.activity === 1 ? '' : 's'}
                        </span>
                        <span className="arch-tile__cta">
                          View
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
