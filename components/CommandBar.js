'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const dialogRef = useRef(null);
  const restoreTo = useRef(null);

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

  // Focus trap + restore, same pattern as components/Modal.js — this
  // overlay had neither, so Tab could reach the covered page behind it and
  // focus never returned to whatever opened it.
  useEffect(() => {
    if (!open && !help) return;
    restoreTo.current = document.activeElement;
    const focusables = () =>
      dialogRef.current?.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ) || [];
    setTimeout(() => { (focusables()[0] || dialogRef.current)?.focus(); }, 0);

    function onKey(e) {
      if (e.key !== 'Tab') return;
      const f = Array.from(focusables());
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreTo.current?.focus?.();
    };
  }, [open, help]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return NAV.filter(([label]) => !needle || label.toLowerCase().includes(needle));
  }, [q]);

  function go(href) { setOpen(false); setQ(''); router.push(href); }

  if (!open && !help) return null;

  return (
    <div className="cmd-bg" onClick={() => { setOpen(false); setHelp(false); }}>
      <div className="cmd" ref={dialogRef} role="dialog" aria-modal="true"
           aria-label={open ? 'Quick navigation' : 'Keyboard shortcuts'} tabIndex={-1}
           onClick={(e) => e.stopPropagation()}>
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
