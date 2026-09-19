'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Mascot from '@/components/Mascot';

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
    <main className="page page--narrow">
      <div className="card animate-in" style={{ padding: 'var(--s-6)' }}>
        <div className="center" style={{ marginBottom: 'var(--s-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--s-3)' }}>
            <Mascot mood={isSignup ? 'excited' : 'wave'} size={92} float />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="muted small" style={{ marginTop: 'var(--s-2)' }}>
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
            <input
              id="password" className="input" type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
          </div>

          {!isSignup && (
            <button type="button" onClick={sendReset} className="btn btn--quiet"
                    style={{ alignSelf: 'flex-start', padding: '2px 4px', fontSize: 'var(--text-sm)' }}>
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

        <p className="center small muted" style={{ marginTop: 'var(--s-5)' }}>
          {isSignup ? 'Already have an account?' : "Don't have an account yet?"}{' '}
          <button type="button" onClick={switchMode} className="btn btn--quiet"
                  style={{ color: 'var(--violet-700)', fontWeight: 700, padding: '2px 4px' }}>
            {isSignup ? 'Log in' : 'Sign up free'}
          </button>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page page--narrow"><div className="skeleton" style={{ height: 380 }} /></main>}>
      <LoginInner />
    </Suspense>
  );
}
