'use client';

import { useState } from 'react';

// A compact "share your code" card, dropped in at high-intent moments
// (just finished onboarding, just subscribed) rather than only living on
// the Settings page where nothing prompts a visit.
export default function ReferralPrompt({ code, link, title, note }) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;
  return (
    <div className="card u-mt-5">
      <div className="u-fw-650">{title}</div>
      {note && <p className="small muted u-mt-1">{note}</p>}
      <div className="row u-mt-3">
        <input className="input" readOnly value={link || code} onFocus={(e) => e.target.select()}
               aria-label="Your referral link" />
        <button className="btn btn--ghost" onClick={() => {
          navigator.clipboard?.writeText(link || code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>
    </div>
  );
}
