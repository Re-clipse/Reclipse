'use client';

// One plain header for every page: title, optional subtitle, optional action.
// Pages still pass `icon` and `accent` from the old per-page color scheme;
// they're accepted and ignored so the header stays consistent everywhere.
// eslint-disable-next-line no-unused-vars
export default function PageHeader({ icon, title, subtitle, accent, action, children }) {
  return (
    <div className="ph">
      <div className="ph__row">
        <div className="ph__lead">
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

// Course colors, like a set of colored pencils: muted enough to sit on paper,
// distinct enough to tell courses apart. Keys are kept from the old palette
// because decks/calendar/archive store and look them up by name.
export const ACCENTS = {
  violet: { solid: '#3D4A6B', soft: '#E3E6EE', ink: '#2A3550' }, // slate
  blue:   { solid: '#2F5F8A', soft: '#DFE9F2', ink: '#1F4567' },
  teal:   { solid: '#2E6E68', soft: '#DCEBE8', ink: '#1F504B' },
  green:  { solid: '#4A6B2E', soft: '#E4ECDA', ink: '#344D1F' },
  amber:  { solid: '#9A6A14', soft: '#F3E9D2', ink: '#6E4B0C' },
  pink:   { solid: '#9B3D5A', soft: '#F2E0E6', ink: '#722A41' },
  orange: { solid: '#B04A1F', soft: '#F4E2D8', ink: '#843513' },
  indigo: { solid: '#4B4C8F', soft: '#E4E4F1', ink: '#35366B' },
};

// Shared icon set — stroke icons, consistent weight, distinct per page.
const P = (d) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
export const ICONS = {
  decks: P(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>),
  upload: P(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5-5 5 5"/><path d="M12 5v12"/></>),
  exam: P(<><path d="M12 2v4M12 2 9 5M12 2l3 3"/><rect x="4" y="6" width="16" height="16" rx="2"/><path d="M9 12h6M9 16h6"/></>),
  archive: P(<><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></>),
  stats: P(<><path d="M3 3v18h18"/><path d="m7 15 3-4 3 2 4-6"/></>),
  calendar: P(<><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>),
  labPrep: P(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8M8 6.5h5"/></>),
  plus: P(<><path d="m12 2 2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2Z"/></>),
  settings: P(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
};
