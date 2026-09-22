# Layouts
Root layout wraps every page: AmbientBg, Nav, CommandBar, {children}, footer. Pages use <main className="page"> (max-width 760px; .page--wide 1060px).

### `app/layout.js`

```js
import './globals.css';
import Nav from '@/components/Nav';
import AmbientBg from '@/components/AmbientBg';
import { ToastProvider } from '@/components/Toast';
import { CelebrateProvider } from '@/components/Celebrate';
import CommandBar from '@/components/CommandBar';

export const metadata = {
  title: { default: 'Reclipse — Stop copying the board. Start remembering it.', template: '%s — Reclipse' },
  description:
    'Upload your lecture notes and slides. Reclipse turns them into flashcards and quizzes built on active recall, so class time is for listening — not transcribing.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'Reclipse', statusBarStyle: 'default' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6D28D9',
};

// Applied before paint so dark-mode users never see a white flash.
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('reclipse-theme');
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <CelebrateProvider>
        <ToastProvider>
          <AmbientBg />
          <Nav />
          <CommandBar />
          {children}
          <footer className="footer">
            Reclipse — built by students, for students at Wilfrid Laurier.
          </footer>
        </ToastProvider>
        </CelebrateProvider>
      </body>
    </html>
  );
}

```

### `components/Nav.js`

```js
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { soundEnabled, setSound } from '@/lib/sound';

const LINKS = [
  ['/decks', 'Decks'],
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

```

### `components/AmbientBg.js`

```js
'use client';

// Global, route-aware ambient motion. Mounted once in the layout; it reads the
// current path and renders soft, slow, blurred floating shapes themed to that
// page's accent. Behind everything, non-interactive, still under reduced-motion.
import { usePathname } from 'next/navigation';
import { ACCENTS } from '@/components/PageHeader';

// route prefix -> { variant, accent }
const ROUTES = [
  ['/decks',    { variant: 'decks', accent: 'violet' }],
  ['/deck',     { variant: 'decks', accent: 'violet' }],
  ['/upload',   { variant: 'upload', accent: 'blue' }],
  ['/study',    { variant: 'study', accent: 'violet' }],
  ['/quiz',     { variant: 'quiz', accent: 'violet' }],
  ['/exam',     { variant: 'exam', accent: 'orange' }],
  ['/discover', { variant: 'discover', accent: 'teal' }],
  ['/archive',  { variant: 'archive', accent: 'amber' }],
  ['/stats',    { variant: 'stats', accent: 'pink' }],
  ['/syllabus', { variant: 'syllabus', accent: 'green' }],
  ['/settings', { variant: 'settings', accent: 'indigo' }],
  ['/welcome',  { variant: 'study', accent: 'violet' }],
  ['/demo',     { variant: 'study', accent: 'violet' }],
];

const SHAPES = {
  decks:    [[8, 18, 220, 'circle', 'a', 0], [82, 12, 160, 'circle', 'b', 2], [70, 78, 260, 'circle', 'c', 1]],
  upload:   [[12, 22, 200, 'tri', 'b', 0], [80, 30, 150, 'circle', 'a', 1.5], [60, 82, 230, 'square', 'c', 0.6]],
  study:    [[15, 20, 240, 'circle', 'c', 0], [78, 60, 180, 'circle', 'a', 1], [50, 88, 160, 'ring', 'b', 2]],
  quiz:     [[10, 20, 200, 'ring', 'a', 0], [84, 30, 170, 'circle', 'b', 1], [64, 82, 220, 'circle', 'c', 0.7]],
  exam:     [[10, 25, 180, 'square', 'a', 0], [85, 18, 200, 'circle', 'b', 1.2], [72, 80, 160, 'tri', 'c', 2]],
  discover: [[14, 16, 210, 'circle', 'b', 0], [80, 40, 170, 'ring', 'a', 1], [55, 84, 240, 'circle', 'c', 0.5]],
  archive:  [[9, 20, 200, 'square', 'c', 0], [84, 26, 180, 'circle', 'a', 1.4], [66, 80, 220, 'circle', 'b', 0.8]],
  stats:    [[12, 18, 220, 'circle', 'a', 0], [82, 55, 190, 'ring', 'b', 1], [58, 85, 200, 'circle', 'c', 1.6]],
  syllabus: [[13, 22, 200, 'circle', 'b', 0], [81, 20, 170, 'square', 'c', 1], [63, 82, 240, 'circle', 'a', 0.7]],
  settings: [[11, 24, 190, 'ring', 'a', 0], [83, 40, 200, 'circle', 'b', 1.3]],
};

export default function AmbientBg() {
  const pathname = usePathname() || '/';
  const match = ROUTES.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
  if (!match) return null;                 // landing/login have their own art
  const { variant, accent } = match[1];
  const c = ACCENTS[accent] || ACCENTS.violet;
  const shapes = SHAPES[variant] || SHAPES.decks;
  return (
    <div className="ambient" aria-hidden="true" key={variant}>
      {shapes.map(([x, y, size, shape, drift, delay], i) => (
        <span key={i} className={`ambient__shape ambient__shape--${shape} drift-${drift}`}
          style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, color: c.solid, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}

```
