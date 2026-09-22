# Shared UI components (Next.js 14 App Router, plain JS, no Tailwind; all styling via app/globals.css classes + CSS vars)

### `components/PageHeader.js`

```js
'use client';

// Per-page identity: each page passes an icon + accent so it's instantly
// recognizable. Premium base, playful colored icon tile. Accent is a CSS var
// scope so page-specific elements can pick it up.
export default function PageHeader({ icon, title, subtitle, accent = 'violet', action, children }) {
  const c = ACCENTS[accent] || ACCENTS.violet;
  return (
    <div className="ph" style={{ '--pa': c.solid, '--pa-soft': c.soft, '--pa-ink': c.ink }}>
      <div className="ph__row">
        <div className="ph__lead">
          <div className="ph__icon">{icon}</div>
          <div>
            <h1 className="ph__title">{title}</h1>
            {subtitle && <p className="ph__sub">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="ph__action">{action}</div>}
      </div>
      {children}
    </div>
  );
}

export const ACCENTS = {
  violet: { solid: '#7C3AED', soft: '#EDE9FE', ink: '#5B21B6' },
  blue:   { solid: '#2563EB', soft: '#DBEAFE', ink: '#1E40AF' },
  teal:   { solid: '#0D9488', soft: '#CCFBF1', ink: '#0F766E' },
  green:  { solid: '#059669', soft: '#D1FAE5', ink: '#047857' },
  amber:  { solid: '#D97706', soft: '#FEF3C7', ink: '#B45309' },
  pink:   { solid: '#DB2777', soft: '#FCE7F3', ink: '#BE185D' },
  orange: { solid: '#EA580C', soft: '#FFEDD5', ink: '#C2410C' },
  indigo: { solid: '#4F46E5', soft: '#E0E7FF', ink: '#3730A3' },
};

// Shared icon set — stroke icons, consistent weight, distinct per page.
const P = (d) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
export const ICONS = {
  decks: P(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>),
  upload: P(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5-5 5 5"/><path d="M12 5v12"/></>),
  study: P(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>),
  quiz: P(<><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></>),
  exam: P(<><path d="M12 2v4M12 2 9 5M12 2l3 3"/><rect x="4" y="6" width="16" height="16" rx="2"/><path d="M9 12h6M9 16h6"/></>),
  discover: P(<><circle cx="12" cy="12" r="10"/><path d="m16 8-6 2-2 6 6-2 2-6z"/></>),
  archive: P(<><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></>),
  stats: P(<><path d="M3 3v18h18"/><path d="m7 15 3-4 3 2 4-6"/></>),
  syllabus: P(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/></>),
  settings: P(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
};

```

### `components/Modal.js`

```js
'use client';

import { useEffect, useRef } from 'react';

/**
 * Accessible modal: labelled dialog, closes on Escape or backdrop click,
 * traps Tab focus inside, restores focus to the trigger on close, and locks
 * body scroll while open.
 */
export default function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    restoreTo.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element inside.
    const focusables = () =>
      ref.current?.querySelectorAll(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ) || [];
    setTimeout(() => focusables()[0]?.focus(), 0);

    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab') {
        const f = Array.from(focusables());
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}
           ref={ref} onClick={(e) => e.stopPropagation()}>
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

```

### `components/LoadError.js`

```js
'use client';

// Shown when a page's data genuinely couldn't load, with a retry that doesn't
// require a full page reload.
export default function LoadError({ onRetry, message }) {
  return (
    <div className="empty">
      <div className="empty__icon" style={{ color: 'var(--error)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h3>Couldn&apos;t load this</h3>
      <p>{message || 'Something went wrong — this is usually a connection hiccup.'}</p>
      <button className="btn btn--primary" onClick={onRetry}>Try again</button>
    </div>
  );
}

```

### `components/Rewards.js`

```js
'use client';

import { rankTitle } from '@/lib/rewards';

export function LevelCard({ level, pct, into, span, xp }) {
  return (
    <div className="level-card">
      <div className="level-badge">
        <span className="level-badge__n">{level}</span>
        <span className="level-badge__l">{rankTitle(level)}</span>
      </div>
      <div className="level-body">
        <div className="level-title">
          <strong>Level {level}</strong>
          <span>{into} / {span} XP</span>
        </div>
        <div className="xp-track"><div className="xp-fill" style={{ width: `${pct}%` }} /></div>
        <p className="small muted" style={{ marginTop: 'var(--s-2)' }}>{xp.toLocaleString()} XP earned all-time</p>
      </div>
    </div>
  );
}

export function GoalRing({ done, goal, pct }) {
  const R = 34, C = 2 * Math.PI * R;
  const off = C - (Math.min(100, pct) / 100) * C;
  return (
    <div className="goal-ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <defs>
          <linearGradient id="goalgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#FACC15" />
          </linearGradient>
        </defs>
        <circle className="goal-ring__track" cx="42" cy="42" r={R} strokeWidth="8" fill="none" />
        <circle className="goal-ring__fill" cx="42" cy="42" r={R} strokeWidth="8" fill="none"
                strokeDasharray={C} strokeDashoffset={off} />
        <text className="goal-ring__center" x="42" y="42" text-anchor="middle" dominant-baseline="central"
              transform="rotate(90 42 42)">{pct}%</text>
      </svg>
      <div className="goal-ring__label">
        <strong>{done} / {goal}</strong>
        <p>{done >= goal ? 'Daily goal hit — nice.' : 'cards reviewed today'}</p>
      </div>
    </div>
  );
}

function Medal() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" /><path d="M9 9 6 2m9 7 3-7M9.5 2h5" />
    </svg>
  );
}
function Lock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function Achievements({ items }) {
  const unlocked = items.filter((a) => a.unlocked).length;
  return (
    <div className="card">
      <div className="row row--between" style={{ marginBottom: 'var(--s-4)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)' }}>Achievements</h3>
        <span className="badge">{unlocked} / {items.length}</span>
      </div>
      <div className="ach-grid">
        {items.map((a) => (
          <div key={a.id} className={`ach ${a.unlocked ? 'ach--unlocked' : 'ach--locked'}`}>
            <div className="ach__medal">{a.unlocked ? <Medal /> : <Lock />}</div>
            <div>
              <div className="ach__t">{a.title}</div>
              <div className="ach__d">{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

```

### `components/Mascot.js`

```js
'use client';

/**
 * Luna — Reclipse's mascot. A friendly eclipse: violet crescent + glowing gold
 * corona. Inline SVG so it's crisp, themeable, animatable. Now with a wider,
 * more enthusiastic range of expressions and livelier idle motion.
 *
 * moods: happy | excited | celebrate | thinking | wave | sleepy | proud |
 *        love | wow | determined
 */
export default function Mascot({ mood = 'happy', size = 120, float = false, bounce = false, className = '' }) {
  const parts = FACES[mood] || FACES.happy;
  const cls = [
    'mascot',
    float && 'mascot--float',
    bounce && 'mascot--bounce',
    (mood === 'excited' || mood === 'celebrate' || mood === 'wow') && 'mascot--wiggle',
    className,
  ].filter(Boolean).join(' ');

  return (
    <svg width={size} height={size} viewBox="0 0 108 108" fill="none" className={cls}
         role="img" aria-label="Reclipse mascot">
      <defs>
        <radialGradient id="corona" cx="50%" cy="50%" r="50%">
          <stop offset="52%" stopColor="#A78BFA" stopOpacity="0" />
          <stop offset="100%" stopColor="#FACC15" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>

      {/* sparkles for the celebratory moods */}
      {parts.sparkles && (
        <g className="mascot__sparkles">
          <path d="M92 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FACC15" />
          <path d="M14 30l1.5 3.5L19 35l-3.5 1.5L14 40l-1.5-3.5L9 35l3.5-1.5z" fill="#A78BFA" />
          <path d="M96 62l1.5 3.5L101 67l-3.5 1.5L96 72l-1.5-3.5L91 67l3.5-1.5z" fill="#FB923C" />
        </g>
      )}

      <circle cx="54" cy="54" r="52" fill="url(#corona)" className="mascot__corona" />
      <circle cx="54" cy="54" r="38" fill="url(#body)" />
      <circle cx="74" cy="42" r="30" fill="#5B21B6" opacity="0.35" />

      {/* cheeks — brighter when excited */}
      <circle cx="34" cy="64" r={parts.bigCheeks ? 6 : 5} fill="#FACC15" opacity={parts.bigCheeks ? 0.7 : 0.5} />
      <circle cx="74" cy="64" r={parts.bigCheeks ? 6 : 5} fill="#FACC15" opacity={parts.bigCheeks ? 0.7 : 0.5} />

      {parts.eyes}
      {parts.mouth}
      {parts.extra}
    </svg>
  );
}

const eyeOpen = (
  <>
    <circle cx="42" cy="52" r="5.5" fill="#1A1523" />
    <circle cx="66" cy="52" r="5.5" fill="#1A1523" />
    <circle cx="43.6" cy="50.2" r="1.9" fill="#fff" />
    <circle cx="67.6" cy="50.2" r="1.9" fill="#fff" />
  </>
);
const eyeBig = (
  <>
    <circle cx="42" cy="52" r="7" fill="#1A1523" />
    <circle cx="66" cy="52" r="7" fill="#1A1523" />
    <circle cx="44" cy="49.6" r="2.4" fill="#fff" />
    <circle cx="68" cy="49.6" r="2.4" fill="#fff" />
  </>
);
const eyeHappyArc = (
  <>
    <path d="M36 54c2-6 9-6 11 0" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M61 54c2-6 9-6 11 0" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" fill="none" />
  </>
);
const smileSmall = <path d="M45 66c3 5 15 5 18 0" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" fill="none" />;
const smileBig = <path d="M41 65c4 9 22 9 26 0" stroke="#1A1523" strokeWidth="3.4" strokeLinecap="round" fill="#1A1523" fillOpacity="0.14" />;
const openGrin = <path d="M42 64c3 10 21 10 24 0z" fill="#1A1523" fillOpacity="0.2" stroke="#1A1523" strokeWidth="3" strokeLinejoin="round" />;

const FACES = {
  happy: { eyes: eyeOpen, mouth: smileSmall },
  excited: { eyes: eyeBig, mouth: smileBig, bigCheeks: true },
  celebrate: { eyes: eyeHappyArc, mouth: openGrin, sparkles: true, bigCheeks: true },
  wow: {
    eyes: eyeBig,
    mouth: <ellipse cx="54" cy="68" rx="6" ry="8" fill="#1A1523" fillOpacity="0.6" />,
    sparkles: true,
  },
  proud: {
    eyes: eyeHappyArc,
    mouth: smileBig,
    bigCheeks: true,
    extra: <path d="M54 30l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#FACC15" transform="translate(0,-16) scale(0.5)" transform-origin="54 30" opacity="0.9" />,
  },
  love: {
    eyes: (
      <>
        <path d="M42 48c-4-4-9 0-4 5l4 4 4-4c5-5 0-9-4-5z" fill="#F472B6" />
        <path d="M66 48c-4-4-9 0-4 5l4 4 4-4c5-5 0-9-4-5z" fill="#F472B6" />
      </>
    ),
    mouth: smileBig, bigCheeks: true,
  },
  thinking: {
    eyes: (
      <>
        <circle cx="44" cy="52" r="5.5" fill="#1A1523" />
        <circle cx="68" cy="52" r="5.5" fill="#1A1523" />
        <path d="M36 45c3-3 8-3 11 0" stroke="#1A1523" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </>
    ),
    mouth: <path d="M46 68c3-2 8-2 11 0" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" fill="none" />,
  },
  determined: {
    eyes: (
      <>
        <path d="M37 48l10 3" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />
        <path d="M71 48l-10 3" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />
        <circle cx="43" cy="54" r="4.5" fill="#1A1523" />
        <circle cx="65" cy="54" r="4.5" fill="#1A1523" />
      </>
    ),
    mouth: <path d="M46 68h16" stroke="#1A1523" strokeWidth="3.4" strokeLinecap="round" />,
  },
  wave: { eyes: eyeOpen, mouth: smileSmall, extra: <g className="mascot__wave"><circle cx="90" cy="46" r="8" fill="url(#body)" /></g> },
  sleepy: {
    eyes: (
      <>
        <path d="M37 52h11" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />
        <path d="M60 52h11" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    mouth: <circle cx="54" cy="70" r="4" fill="#1A1523" fillOpacity="0.5" />,
    extra: <text x="78" y="34" fontSize="14" fill="#A78BFA" className="mascot__zzz">z</text>,
  },
};

```

### `components/Toast.js`

```js
'use client';

import { createContext, useCallback, useContext, useState } from 'react';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, kind = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.kind === 'success' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                   strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>
            )}
            {t.kind === 'error' && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                   strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

```
