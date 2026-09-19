'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Arriving from a recovery link gives us a temporary session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password needs to be at least 6 characters.'); return; }
    if (password !== confirm) { setError("Those two passwords don't match."); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/decks');
  }

  return (
    <main className="page page--narrow">
      <div className="card animate-in" style={{ padding: 'var(--s-6)' }}>
        <div className="center" style={{ marginBottom: 'var(--s-5)' }}>
          <h1 style={{ fontSize: 'var(--text-2xl)' }}>Set a new password</h1>
          <p className="muted small" style={{ marginTop: 'var(--s-2)' }}>
            Choose something you&apos;ll remember — you&apos;ll use it to log in from now on.
          </p>
        </div>

        {!ready ? (
          <div className="alert alert--note">
            Open this page from the reset link in your email, otherwise we can&apos;t tell
            which account to update.
          </div>
        ) : (
          <form onSubmit={submit} className="stack">
            <div className="field">
              <label className="label" htmlFor="pw">New password</label>
              <input id="pw" className="input" type="password" autoComplete="new-password"
                     value={password} onChange={(e) => setPassword(e.target.value)}
                     placeholder="At least 6 characters" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="pw2">Confirm password</label>
              <input id="pw2" className="input" type="password" autoComplete="new-password"
                     value={confirm} onChange={(e) => setConfirm(e.target.value)}
                     placeholder="Type it again" required />
            </div>
            {error && <div className="alert alert--error">{error}</div>}
            <button className="btn btn--primary btn--block btn--lg" disabled={loading}>
              {loading && <span className="spinner" />}
              {loading ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
