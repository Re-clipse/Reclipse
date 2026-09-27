'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabaseClient';
import {
  isLaunchTrialActive, startPremiumCheckout, openPremiumBillingPortal, getPremiumPrice, formatPremiumPrice,
} from '@/lib/premium';

const BENEFITS = [
  'No daily limit on generating study sets — the free plan allows 1 per day',
  'Up to 2,700 flashcards a month (free: 900) — about 90 generations’ worth',
  'Lab Prep AI chat: turn a deck or your notes into lab-style practice problems, with hints and worked solutions',
];

export default function PremiumClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [billingInterval, setBillingInterval] = useState('month');
  const [monthPrice, setMonthPrice] = useState(null);
  const [yearPrice, setYearPrice] = useState(null);
  const [priceLoaded, setPriceLoaded] = useState(false);
  // Whether the signed-in user has a real paid subscription — separate from
  // the launch trial, which covers everyone regardless of this.
  const [realSub, setRealSub] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getPremiumPrice('month'), getPremiumPrice('year')]).then(([m, y]) => {
      setMonthPrice(m); setYearPrice(y); setPriceLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!user) { setRealSub(false); return; }
    supabase.rpc('has_premium_access').then(({ data, error: rpcError }) => setRealSub(rpcError ? false : Boolean(data)));
  }, [user]);

  const trialActive = isLaunchTrialActive();
  const price = billingInterval === 'year' ? yearPrice : monthPrice;
  const configured = Boolean(monthPrice || yearPrice);

  async function subscribe() {
    setError(''); setBusy(true);
    try {
      const res = await startPremiumCheckout(billingInterval);
      if (res.needsLogin) { router.push('/login?next=%2Fpremium'); return; }
      if (!res.ok) { setError(res.error || 'Something went wrong. Please try again.'); return; }
      window.location.href = res.url;
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function manage() {
    setError(''); setBusy(true);
    try {
      const res = await openPremiumBillingPortal();
      if (res.needsLogin) { router.push('/login?next=%2Fpremium'); return; }
      if (!res.ok) { setError(res.error || 'Something went wrong. Please try again.'); return; }
      window.location.href = res.url;
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return <main className="page"><div className="skeleton" style={{ height: 420 }} /></main>;

  return (
    <main className="page page--narrow">
      <PageHeader accent="violet" icon={ICONS.plus} title="Reclipse Plus"
        subtitle="Unlimited-pace studying and Lab Prep, for students who want more than the free plan." />

      {trialActive && (
        <div className="alert alert--note u-mb-5">
          Everyone gets full Reclipse Plus access free right now, during our launch period — no
          subscription needed yet.{configured && ' You can still subscribe below to lock in support early.'}
        </div>
      )}

      {realSub === true ? (
        <div className="card center u-p-6">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>You&apos;re subscribed</h2>
          <p className="muted u-mt-3">You have full Reclipse Plus access.</p>
          <button className="btn btn--ghost u-mt-5" disabled={busy} onClick={manage}>
            {busy && <span className="spinner" />}Manage billing
          </button>
        </div>
      ) : !priceLoaded ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : !configured ? (
        <div className="card center u-p-6">
          <h2 style={{ fontSize: 'var(--text-xl)' }}>Coming soon</h2>
          <p className="muted u-mt-3">
            Paid subscriptions aren&apos;t open yet — we&apos;re still setting up billing.
            {trialActive && ' Everyone has full access in the meantime.'}
          </p>
        </div>
      ) : (
        <div className="card u-p-6">
          {monthPrice && yearPrice && (
            <div className="tabs" role="tablist" aria-label="Billing interval" style={{ marginBottom: 'var(--s-5)' }}
                 onKeyDown={(e) => {
                   if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                   e.preventDefault();
                   setBillingInterval((v) => (v === 'month' ? 'year' : 'month'));
                 }}>
              <button type="button" role="tab" aria-selected={billingInterval === 'month'}
                      tabIndex={billingInterval === 'month' ? 0 : -1}
                      className={`tab${billingInterval === 'month' ? ' tab--on' : ''}`}
                      onClick={() => setBillingInterval('month')}>Monthly</button>
              <button type="button" role="tab" aria-selected={billingInterval === 'year'}
                      tabIndex={billingInterval === 'year' ? 0 : -1}
                      className={`tab${billingInterval === 'year' ? ' tab--on' : ''}`}
                      onClick={() => setBillingInterval('year')}>Yearly</button>
            </div>
          )}

          <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--violet-700)' }}>
            {formatPremiumPrice(price)}
          </div>

          <ul className="stack u-mt-5" style={{ gap: 'var(--s-3)', listStyle: 'none' }}>
            {BENEFITS.map((b) => (
              <li key={b} style={{ display: 'flex', gap: 'var(--s-2)', alignItems: 'flex-start' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 2, color: 'var(--violet-600)' }}>
                  <circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" />
                </svg>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {error && <div role="alert" className="alert alert--error u-mt-5">{error}</div>}

          <button className="btn btn--primary btn--lg btn--block u-mt-6" disabled={busy} onClick={subscribe}>
            {busy && <span className="spinner" />}{busy ? 'Redirecting…' : `Subscribe — ${formatPremiumPrice(price)}`}
          </button>
          <p className="small muted u-mt-3" style={{ textAlign: 'center' }}>
            Cancel any time — you keep access through the end of the period you&apos;ve already paid for.
          </p>
        </div>
      )}
    </main>
  );
}
