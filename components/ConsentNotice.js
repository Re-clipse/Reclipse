'use client';

import { useEffect, useState } from 'react';

const KEY = 'reclipse-consent-ack';

// Reclipse sets no cookies and runs no tracking (verified: no document.cookie
// writes, no analytics/ad scripts anywhere in this codebase) — so this is an
// honest one-line notice about local storage (session, theme, and a few other
// small preferences — see /cookies for the full list), not a fake
// "accept all / reject all" vendor-toggle wall that would imply tracking we
// don't actually do.
export default function ConsentNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {}
  }, []);

  function dismiss() {
    try { localStorage.setItem(KEY, '1'); } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="consent-banner" role="region" aria-label="Cookie and storage notice">
      <p>
        We don&apos;t use cookies or tracking. Your browser&apos;s local storage keeps you signed in
        and remembers a few preferences, like your theme. <a href="/cookies">Learn more</a>
      </p>
      <button type="button" className="btn btn--primary" onClick={dismiss}>Got it</button>
    </div>
  );
}
