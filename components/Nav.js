'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { soundEnabled, setSound } from '@/lib/sound';

const LINKS = [
  ['/decks', 'Decks'],
  ['/calendar', 'Calendar'],
  ['/exam', 'Mock exam'],
  ['/discover', 'Discover'],
  ['/archive', 'Archive'],
  ['/stats', 'Progress'],
];

export default function Nav() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [sound, setSoundOn] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    setDark(document.documentElement.dataset.theme === 'dark');
    setSoundOn(soundEnabled());
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  function toggleTheme() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('reclipse-theme', next); } catch {}
    setDark(!dark);
  }

  function toggleSound() { const on = !sound; setSound(on); setSoundOn(on); }

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <nav className="nav">
      <a href={user ? '/decks' : '/'} className="nav__brand">
        <span className="nav__mark" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9" /><path d="M21 3v6h-6" />
          </svg>
        </span>
        Reclipse
      </a>

      <div className="nav__links">
        <button onClick={toggleSound} className="theme-toggle"
                aria-label={sound ? 'Mute sound effects' : 'Enable sound effects'} title={sound ? 'Sound on' : 'Sound off'}>
          {sound ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="m23 9-6 6M17 9l6 6"/></svg>
          )}
        </button>
        <button onClick={toggleTheme} className="theme-toggle"
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {dark ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
          )}
        </button>

        {!ready ? null : user ? (
          <>
            <span className="hide-sm" style={{ display: 'contents' }}>
              {LINKS.map(([href, label]) => (
                <a key={href} href={href}
                   className={`nav__link${pathname === href ? ' nav__link--active' : ''}`}>{label}</a>
              ))}
              <a href="/upload" className="btn btn--primary">+ New set</a>
              <a href="/settings" className="nav__link">Settings</a>
              <button onClick={signOut} className="btn btn--quiet">Sign out</button>
            </span>
            <button className="theme-toggle" onClick={() => setOpen(!open)}
                    aria-label="Menu" style={{ display: 'none' }} data-mobile-menu>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          </>
        ) : (
          <>
            <a href="/login" className="nav__link">Log in</a>
            <a href="/login?mode=signup" className="btn btn--primary">Get started</a>
          </>
        )}
      </div>

      {open && (
        <div className="nav__sheet">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="nav__link">{label}</a>
          ))}
          <a href="/upload" className="nav__link">New study set</a>
          <a href="/settings" className="nav__link">Settings</a>
          <button onClick={signOut} className="nav__link" style={{ textAlign: 'left', background: 'none', border: 0 }}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
