'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import Mascot from '@/components/Mascot';

// Step 1 of 3. Steps 2 and 3 happen on the real /upload and /quiz pages
// (via the ?onboarding=1 flag) rather than being simulated here \u2014 so
// "upload your first set of notes" and "take the tutorial quiz" are the
// actual product, not a mocked walkthrough.
export default function WelcomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function next(e) {
    e.preventDefault();
    setError('');
    const name = course.trim();
    if (!name) { setError('Name a course to continue. You can rename it later.'); return; }

    setSaving(true);
    const { data, error } = await supabase.from('courses').insert({ user_id: user.id, name }).select().single();
    if (error) { setError('Could not create that course.'); setSaving(false); return; }
    router.push(`/upload?course=${data.id}&onboarding=1`);
  }

  if (loading) return <main className="page page--narrow"><div className="skeleton" style={{ height: 320 }} /></main>;

  return (
    <main className="page page--narrow">
      <div className="progress u-mb-6"><div className="progress__bar" style={{ width: '33%' }} /></div>
      <div className="card animate-in u-p-6">
        <div className="mascot-wrap">
          <Mascot mood="excited" size={108} float />
        </div>
        <span className="badge">Step 1 of 3</span>
        <h1 style={{ fontSize: 'var(--text-2xl)', marginTop: 'var(--s-3)', marginBottom: 'var(--s-2)' }}>Name your first course</h1>
        <p className="muted small u-mb-5">
          Next, you&apos;ll upload a set of notes and try the tutorial quiz. About a minute, start to finish.
        </p>
        <form onSubmit={next} className="stack">
          <div className="field">
            <label className="label" htmlFor="course">Course name</label>
            <input id="course" className="input" autoFocus placeholder="e.g. BI110 - Cell Biology"
                   value={course} onChange={(e) => setCourse(e.target.value)} />
          </div>
          {error && <div className="alert alert--error">{error}</div>}
          <button className="btn btn--primary btn--block btn--lg" disabled={saving}>
            {saving && <span className="spinner" />}{saving ? 'Setting up\u2026' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
