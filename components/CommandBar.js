'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Cmd/Ctrl+K quick nav + "?" shortcuts help. Global, mounted once in layout.
const NAV = [
  ['My decks', '/decks'],
  ['Calendar', '/calendar'],
  ['New study set', '/upload'],
  ['Mock exam', '/exam'],
  ['Discover', '/discover'],
  ['Campus Archive', '/archive'],
  ['Syllabus & reminders', '/syllabus'],
  ['Progress', '/stats'],
];

const SHORTCUTS = [
  ['Studying', [['Space', 'Flip card'], ['1 to 4', 'Grade (Again / Hard / Good / Easy)']]],
  ['Quiz', [['A to D', 'Pick an answer'], ['Enter', 'Next question']]],
  ['Anywhere', [['⌘ / Ctrl + K', 'Quick navigation'], ['?', 'Show this help']]],
];

export default function CommandBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState('');
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onKey(e) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen((o) => !o); setHelp(false); return;
      }
      if (e.key === '?' && !typing && authed) { e.preventDefault(); setHelp((h) => !h); setOpen(false); }
      if (e.key === 'Escape') { setOpen(false); setHelp(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authed]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return NAV.filter(([label]) => !needle || label.toLowerCase().includes(needle));
  }, [q]);

  function go(href) { setOpen(false); setQ(''); router.push(href); }

  if (!open && !help) return null;

  return (
    <div className="cmd-bg" onClick={() => { setOpen(false); setHelp(false); }}>
      <div className="cmd" onClick={(e) => e.stopPropagation()}>
        {open ? (
          <>
            <input className="cmd__input" autoFocus placeholder="Jump to…" value={q}
                   onChange={(e) => setQ(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && results[0] && go(results[0][1])} />
            <div className="cmd__list">
              {results.length === 0 && <div className="cmd__empty">No matches</div>}
              {results.map(([label, href]) => (
                <button key={href} className="cmd__item" onClick={() => go(href)}>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div className="cmd__foot"><span className="kbd">↵</span> to open · <span className="kbd">esc</span> to close · <span className="kbd">?</span> for shortcuts</div>
          </>
        ) : (
          <>
            <h3 style={{ marginBottom: 'var(--s-4)' }}>Keyboard shortcuts</h3>
            {SHORTCUTS.map(([group, rows]) => (
              <div key={group} style={{ marginBottom: 'var(--s-4)' }}>
                <div className="cmd__group">{group}</div>
                {rows.map(([keys, desc]) => (
                  <div key={desc} className="cmd__shortcut">
                    <span className="muted small">{desc}</span>
                    <span className="kbd">{keys}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="cmd__foot"><span className="kbd">esc</span> to close</div>
          </>
        )}
      </div>
    </div>
  );
}
