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
  calendar: P(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>),
  settings: P(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
};
