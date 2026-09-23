'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Mascot from '@/components/Mascot';
import { storedReferralCode, clearStoredReferralCode } from '@/components/ReferralCapture';

function LoginInner() {
  const params = useSearchParams();
  const router = useRouter();

  // Where to send the user afterwards (e.g. /upload sends them here when logged out).
  const next = params.get('next') || '/decks';
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  // Pre-filled from a ?ref= link if one was clicked, but always editable —
  // someone who got a code verbally or by text can type it in directly.
  const [refCode, setRefCode] = useState(() => params.get('ref') || storedReferralCode() || '');

  // Already signed in? Don't make them log in again.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [next, router]);

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setNotice('');
  }

  function chooseMode(m) {
    if (m === mode) return;
    setMode(m);
    setError('');
    setNotice('');
  }

  async function sendReset() {
    setError(''); setNotice('');
    if (!email) { setError('Enter your email above first, then click this again.'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    if (error) setError(error.message);
    else setNotice(`If an account exists for ${email}, a reset link is on its way.`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (password.length < 6) {
      setError('Password needs to be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          const code = refCode.trim().toUpperCase();
          if (code) {
            // Best-effort: a failure here should never block a fresh account
            // from reaching the app. claim_referral is safe to skip/retry —
            // it only sets referred_by if it's still unset, and silently
            // no-ops on an unknown or self-referral code.
            supabase.rpc('claim_referral', { p_code: code })
              .then(() => clearStoredReferralCode())
              .catch(() => {});
          }
          router.push(params.get('next') ? next : '/welcome');
          return;
        }
        setNotice('Account created. Check your email to confirm it, then log in.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        return;
      }
    } catch (err) {
      setError(
        err.message === 'Invalid login credentials'
          ? "That email and password don't match an account. Try again, or sign up."
          : err.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === 'signup';

  return (
    <main className="page page--wide auth">
      <aside className="auth__brand" aria-hidden="false">
        <div className="auth__blob auth__blob--a" aria-hidden="true" />
        <div className="auth__blob auth__blob--b" aria-hidden="true" />

        <div className="auth__banner">
          <div className="auth__glow auth__glow--sm" aria-hidden="true" />
          <Mascot mood={isSignup ? 'excited' : 'happy'} size={56} />
          <strong>Study less. Remember more.</strong>
        </div>

        <div className="auth__body">
          <h1 className="auth__headline">Study less.<br />Remember more.</h1>
          <p className="auth__pitch">Turn your lecture notes into flashcards and quizzes built on active recall.</p>
          <div className="auth__luna">
            <div className="auth__glow" aria-hidden="true" />
            <Mascot mood={isSignup ? 'excited' : 'happy'} size={190} float />
          </div>
          <ul className="auth__points">
            {['Snap a photo of your notes', 'Cards in seconds', 'Spaced repetition built in'].map((t) => (
              <li key={t}>
                <span className="auth__check" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="card animate-in auth__card">
        <div className="seg" role="tablist" aria-label="Log in or sign up">
          <button type="button" role="tab" aria-selected={!isSignup}
                  className={`seg__btn${!isSignup ? ' seg__btn--on' : ''}`} onClick={() => chooseMode('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={isSignup}
                  className={`seg__btn${isSignup ? ' seg__btn--on' : ''}`} onClick={() => chooseMode('signup')}>Sign up</button>
        </div>

        <div className="u-mb-5">
          <h2 className="auth__title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="muted small u-mt-2">
            {isSignup
              ? 'Turn your next lecture into a study set in about a minute.'
              : 'Log in to pick up where you left off.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email" className="input" type="email" autoComplete="email"
              placeholder="you@mylaurier.ca" value={email}
              onChange={(e) => setEmail(e.target.value)} required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <div className="pw">
              <input
                id="password" className="input pw__input" type={showPw ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                value={password} onChange={(e) => setPassword(e.target.value)} required
              />
              <button type="button" className="pw__toggle" onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}>
                {showPw ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {isSignup && (
            <div className="field">
              <label className="label" htmlFor="refcode">Referral code (optional)</label>
              <input
                id="refcode" className="input" value={refCode} placeholder="e.g. AB12CD3"
                onChange={(e) => setRefCode(e.target.value)}
              />
            </div>
          )}

          {!isSignup && (
            <button type="button" onClick={sendReset} className="btn btn--quiet auth__forgot">
              Forgot your password?
            </button>
          )}

          {error && <div className="alert alert--error">{error}</div>}
          {notice && <div className="alert alert--note">{notice}</div>}

          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'One moment…' : isSignup ? 'Create account' : 'Log in'}
          </button>
        </form>

        <p className="center small muted u-mt-5">
          {isSignup ? 'Already have an account?' : "Don't have an account yet?"}{' '}
          <button type="button" onClick={switchMode} className="btn btn--quiet auth__switch">
            {isSignup ? 'Log in' : 'Sign up free'}
          </button>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page page--wide"><div className="skeleton" style={{ height: 480 }} /></main>}>
      <LoginInner />
    </Suspense>
  );
}
