'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const KEY = 'reclipse-ref';

/**
 * Remembers a ?ref=<code> the moment it's seen, anywhere in the app — not
 * just on the login page — so a visitor who lands on the homepage first and
 * signs up later still gets attributed correctly. Never overwrites a code
 * already stored: the first link someone clicked wins.
 */
export default function ReferralCapture() {
  const params = useSearchParams();
  const ref = params.get('ref');

  useEffect(() => {
    if (!ref) return;
    try {
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, ref);
    } catch {}
  }, [ref]);

  return null;
}

/** Reads (and does not clear) the stored code, if any. Used once at signup. */
export function storedReferralCode() {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}

export function clearStoredReferralCode() {
  try { localStorage.removeItem(KEY); } catch {}
}
