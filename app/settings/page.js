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
  const [refCode, setRefCode] = useState(null);
  const [refCount, setRefCount] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [emailsEnabled, setEmailsEnabled] = useState(true);
  const [remindStudySessions, setRemindStudySessions] = useState(true);
  const [remindWeeklyDigest, setRemindWeeklyDigest] = useState(true);
  const [reminderDaysAhead, setReminderDaysAhead] = useState(3);
  const [timezone, setTimezone] = useState('UTC');

  useEffect(() => {
    if (!user) return;
    setFailed(false);
    (async () => {
      try {
        const [{ data: profile }, { data: cs }, { count }] = await withTimeout(Promise.all([
          supabase.from('profiles')
            .select('display_name, emails_enabled, remind_study_sessions, remind_weekly_digest, reminder_days_ahead, timezone')
            .eq('user_id', user.id).maybeSingle(),
          supabase.from('courses').select('*').order('name'),
          supabase.from('referral_reward_log').select('referred_user_id', { count: 'exact', head: true }),
        ]), 12000, 'settings');
        setName(profile?.display_name || '');
        setCourses(cs || []);
        setRefCount(count || 0);
        setEmailsEnabled(profile?.emails_enabled ?? true);
        setRemindStudySessions(profile?.remind_study_sessions ?? true);
        setRemindWeeklyDigest(profile?.remind_weekly_digest ?? true);
        setReminderDaysAhead(profile?.reminder_days_ahead ?? 3);
        setTimezone(profile?.timezone || 'UTC');

        // Keep the stored timezone in sync with the browser's own, silently.
        // Dates in course_events/study_plan_sessions have no timezone of
        // their own, so this is what "today" and "this Sunday" resolve
        // against for that student's reminder emails.
        try {
          const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (detected && detected !== (profile?.timezone || 'UTC')) {
            await supabase.from('profiles').upsert({ user_id: user.id, timezone: detected }, { onConflict: 'user_id' });
            setTimezone(detected);
          }
        } catch {}

        setLoaded(true);
      } catch {
        setFailed(true);
      }
    })();
  }, [user, reload]);

  // Fetched separately (it's a write-on-first-read API call, not a plain
  // select) so a slow/failed referral-code fetch never blocks the rest of
  // the page from loading.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch('/api/referral/code', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok) setRefCode(data.code);
      } catch {}
    })();
  }, [user]);

  const refLink = refCode && typeof window !== 'undefined'
    ? `${window.location.origin}/login?mode=signup&ref=${refCode}` : '';

  function copyRefCode() {
    navigator.clipboard?.writeText(refCode || '');
    setCopiedCode(true);
    toast('Referral code copied', 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function copyRefLink() {
    navigator.clipboard?.writeText(refLink);
    setCopiedLink(true);
    toast('Sign-up link copied', 'success');
    setTimeout(() => setCopiedLink(false), 2000);
  }

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

  async function saveEmailPref(patch) {
    await supabase.from('profiles').upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });
  }

  async function toggleEmailsEnabled() {
    const next = !emailsEnabled;
    setEmailsEnabled(next);
    await saveEmailPref({ emails_enabled: next });
    toast(next ? 'Reminder emails on' : 'Reminder emails off');
  }
  async function toggleStudySessions() {
    const next = !remindStudySessions;
    setRemindStudySessions(next);
    await saveEmailPref({ remind_study_sessions: next });
    toast(next ? 'Study-session reminders on' : 'Study-session reminders off');
  }
  async function toggleWeeklyDigest() {
    const next = !remindWeeklyDigest;
    setRemindWeeklyDigest(next);
    await saveEmailPref({ remind_weekly_digest: next });
    toast(next ? 'Weekly digest on' : 'Weekly digest off');
  }
  async function changeDaysAhead(days) {
    setReminderDaysAhead(days);
    await saveEmailPref({ reminder_days_ahead: days });
    toast('Saved');
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

      <div className="card u-mt-5">
        <div style={{ fontWeight: 650, marginBottom: 'var(--s-1)' }}>Reminder emails</div>
        <p className="small muted u-mb-4">
          Controls every email Reclipse sends you. Detected timezone: {timezone}.
        </p>
        <div className="stack">
          <div className="switch" style={{ paddingBlock: 'var(--s-2)' }}>
            <div>
              <div className="u-fw-650">All reminder emails</div>
              <p className="small muted">Same switch as the unsubscribe link in any reminder email.</p>
            </div>
            <button className={emailsEnabled ? 'btn btn--primary' : 'btn btn--ghost'} onClick={toggleEmailsEnabled}>
              {emailsEnabled ? 'On' : 'Off'}
            </button>
          </div>
          <div className="switch" style={{ paddingBlock: 'var(--s-2)' }}>
            <span className="u-fw-650">Days ahead of an exam to remind me</span>
            <select className="input" style={{ width: 100 }} value={reminderDaysAhead} disabled={!emailsEnabled}
                    onChange={(e) => changeDaysAhead(Number(e.target.value))}>
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>
          <div className="switch" style={{ paddingBlock: 'var(--s-2)' }}>
            <span className="u-fw-650">Study-session day reminders</span>
            <button className={remindStudySessions ? 'btn btn--primary' : 'btn btn--ghost'} disabled={!emailsEnabled}
                    onClick={toggleStudySessions}>
              {remindStudySessions ? 'On' : 'Off'}
            </button>
          </div>
          <div className="switch" style={{ paddingBlock: 'var(--s-2)' }}>
            <span className="u-fw-650">Weekly digest (Sundays)</span>
            <button className={remindWeeklyDigest ? 'btn btn--primary' : 'btn btn--ghost'} disabled={!emailsEnabled}
                    onClick={toggleWeeklyDigest}>
              {remindWeeklyDigest ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </div>

      <div className="card u-mt-5">
        <div style={{ fontWeight: 650, marginBottom: 'var(--s-1)' }}>Refer a friend</div>
        <p className="small muted u-mb-4">
          Share your code with a friend. Once they sign up, enter it, and subscribe to the
          Campus Archive, you both get a discount on your next month.
        </p>
        {refCode ? (
          <>
            <div className="row">
              <input className="input" readOnly value={refCode} onFocus={(e) => e.target.select()}
                     style={{ fontWeight: 700, letterSpacing: '0.08em' }} />
              <button type="button" className="btn btn--primary" onClick={copyRefCode}>
                {copiedCode ? 'Copied' : 'Copy code'}
              </button>
            </div>
            <p className="small muted u-mt-3">
              Or send the{' '}
              <button type="button" className="btn btn--quiet" style={{ padding: 0, height: 'auto' }} onClick={copyRefLink}>
                {copiedLink ? 'link copied' : 'sign-up link'}
              </button>{' '}
              — it fills the code in for them automatically.
            </p>
          </>
        ) : (
          <div className="skeleton" style={{ height: 44 }} />
        )}
        {refCount > 0 && (
          <p className="small muted u-mt-3">
            {refCount} friend{refCount === 1 ? '' : 's'} rewarded so far.
          </p>
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
