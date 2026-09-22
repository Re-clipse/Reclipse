'use client';

import { useEffect, useState } from 'react';
import PageHeader, { ICONS } from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/useAuth';
import { useToast } from '@/components/Toast';
import LoadError from '@/components/LoadError';
import { withTimeout } from '@/lib/net';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [courses, setCourses] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!user) return;
    setFailed(false);
    (async () => {
      try {
        const [{ data: profile }, { data: cs }] = await withTimeout(Promise.all([
          supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
          supabase.from('courses').select('*').order('name'),
        ]), 12000, 'settings');
        setName(profile?.display_name || '');
        setCourses(cs || []);
        setLoaded(true);
      } catch {
        setFailed(true);
      }
    })();
  }, [user, reload]);

  async function saveName() {
    setSaving(true);
    await supabase.from('profiles').upsert(
      { user_id: user.id, display_name: name.trim() || null }, { onConflict: 'user_id' });
    setSaving(false);
    toast('Saved', 'success');
  }

  async function toggleReminder(courseId, current) {
    await supabase.from('courses').update({ remind_enabled: !current }).eq('id', courseId);
    setCourses((cs) => cs.map((c) => (c.id === courseId ? { ...c, remind_enabled: !current } : c)));
    toast(!current ? 'Reminders on for this course' : 'Reminders off');
  }

  if (failed) return <main className="page"><LoadError onRetry={() => setReload((n) => n + 1)} /></main>;
  if (authLoading || !loaded) return <main className="page"><div className="skeleton" style={{ height: 360 }} /></main>;

  return (
    <main className="page page--narrow">
      <PageHeader accent="indigo" icon={ICONS.settings} title="Settings" subtitle={user?.email} />

      <div className="card stack u-mb-5">
        <div className="field">
          <label className="label" htmlFor="dn">Display name</label>
          <input id="dn" className="input" value={name} placeholder="Your name"
                 onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn--primary" style={{ alignSelf: 'flex-start' }} onClick={saveName} disabled={saving}>
          {saving && <span className="spinner" />}Save
        </button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 650, marginBottom: 'var(--s-1)' }}>Exam reminders by course</div>
        <p className="small muted u-mb-4">
          When on, we email you a couple of days before each saved exam, quiz or lab date.
          Add dates from the <a href="/syllabus">syllabus page</a>.
        </p>
        {courses.length === 0 ? (
          <p className="small muted">No courses yet.</p>
        ) : (
          <div className="stack">
            {courses.map((c) => (
              <div key={c.id} className="switch" style={{ paddingBlock: 'var(--s-2)' }}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                <button className={c.remind_enabled ? 'btn btn--primary' : 'btn btn--ghost'}
                        onClick={() => toggleReminder(c.id, c.remind_enabled)}>
                  {c.remind_enabled ? 'On' : 'Off'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card switch u-mt-5">
        <div>
          <div className="u-fw-650">Sign out</div>
          <p className="small muted">Sign out of Reclipse on this device.</p>
        </div>
        <button className="btn btn--ghost" onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}>
          Sign out
        </button>
      </div>
    </main>
  );
}
