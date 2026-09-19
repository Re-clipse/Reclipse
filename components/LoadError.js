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
