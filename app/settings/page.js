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
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Two-factor authentication (TOTP via Supabase Auth's built-in MFA).
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [pendingFactorId, setPendingFactorId] = useState(null);
  const [enrollCode, setEnrollCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaErr, setMfaErr] = useState('');

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.find((f) => f.status === 'verified');
      setMfaEnabled(Boolean(totp));
      setMfaFactorId(totp?.id || null);
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

  async function startMfaEnroll() {
    setMfaErr(''); setMfaBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setPendingFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setEnrolling(true);
    } catch (err) {
      setMfaErr(err.message || 'Could not start two-factor setup.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function cancelMfaEnroll() {
    if (pendingFactorId) {
      // Best-effort: an abandoned, never-verified factor left registered
      // wouldn't do anything (it's never challenged at login), but cleaning
      // it up keeps a stray attempt from cluttering listFactors() forever.
      supabase.auth.mfa.unenroll({ factorId: pendingFactorId }).catch(() => {});
    }
    setEnrolling(false); setPendingFactorId(null); setQrCode(''); setMfaSecret(''); setEnrollCode(''); setMfaErr('');
  }

  async function confirmMfaEnroll(e) {
    e.preventDefault();
    setMfaErr('');
    if (enrollCode.trim().length !== 6) { setMfaErr('Enter the 6-digit code from your authenticator app.'); return; }
    setMfaBusy(true);
    try {
      const { data: ch, error: chError } = await supabase.auth.mfa.challenge({ factorId: pendingFactorId });
      if (chError) throw chError;
      const { error: vError } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId, challengeId: ch.id, code: enrollCode.trim(),
      });
      if (vError) throw vError;
      setMfaEnabled(true);
      setMfaFactorId(pendingFactorId);
      setEnrolling(false); setPendingFactorId(null); setQrCode(''); setMfaSecret(''); setEnrollCode('');
      toast('Two-factor authentication enabled', 'success');
    } catch (err) {
      setMfaErr(/invalid|expired/i.test(err.message || '')
        ? 'That code is incorrect or expired. Try the current code from your app.'
        : err.message || 'Could not verify that code.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfa() {
    if (!confirm('Turn off two-factor authentication? Your account will only be protected by your password.')) return;
    setMfaBusy(true); setMfaErr('');
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      setMfaEnabled(false); setMfaFactorId(null);
      toast('Two-factor authentication turned off');
    } catch (err) {
      setMfaErr(err.message || 'Could not turn off two-factor authentication.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true); setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) { setDeleteError(data?.error || 'Something went wrong. Please try again.'); return; }
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch {
      setDeleteError('Could not reach the server. Please try again.');
    } finally {
      setDeleting(false);
    }
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
          When on, we email you before each saved exam, quiz or lab date — how many days ahead is set
          below, under &quot;Reminder emails&quot;. Add dates from the <a href="/syllabus">syllabus page</a>.
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
          Controls the reminder emails below (course dates, study sessions, weekly digest) — not
          account emails like password resets. Detected timezone: {timezone}.
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
        <div style={{ fontWeight: 650, marginBottom: 'var(--s-1)' }}>Two-factor authentication</div>
        <p className="small muted u-mb-4">
          Adds a code from an authenticator app (Google Authenticator, Authy, 1Password, etc.) to your
          password when you log in.
        </p>

        {!enrolling && (
          <div className="switch" style={{ paddingBlock: 'var(--s-2)' }}>
            <span className="u-fw-650">{mfaEnabled ? 'Enabled' : 'Not enabled'}</span>
            <button
              className={mfaEnabled ? 'btn btn--ghost' : 'btn btn--primary'}
              disabled={mfaBusy}
              onClick={mfaEnabled ? disableMfa : startMfaEnroll}
            >
              {mfaBusy && <span className="spinner" />}
              {mfaEnabled ? 'Turn off' : 'Set up'}
            </button>
          </div>
        )}

        {enrolling && (
          <form onSubmit={confirmMfaEnroll} className="stack">
            <p className="small">Scan this with your authenticator app:</p>
            {qrCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCode} alt="QR code to scan with your authenticator app" width={180} height={180} />
            )}
            <p className="small muted">
              Can&apos;t scan it? Enter this key manually: <code style={{ userSelect: 'all' }}>{mfaSecret}</code>
            </p>
            <div className="field">
              <label className="label" htmlFor="mfa-enroll-code">6-digit code from your app</label>
              <input id="mfa-enroll-code" className="input" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                     value={enrollCode} onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ''))}
                     placeholder="123456" autoFocus />
            </div>
            {mfaErr && <div role="alert" className="alert alert--error">{mfaErr}</div>}
            <div className="row">
              <button type="submit" className="btn btn--primary" disabled={mfaBusy}>
                {mfaBusy && <span className="spinner" />}Verify and enable
              </button>
              <button type="button" className="btn btn--ghost" onClick={cancelMfaEnroll} disabled={mfaBusy}>Cancel</button>
            </div>
          </form>
        )}
        {!enrolling && mfaErr && <div role="alert" className="alert alert--error u-mt-3">{mfaErr}</div>}
      </div>

      <div className="card u-mt-5">
        <div style={{ fontWeight: 650, marginBottom: 'var(--s-1)' }}>Refer a friend</div>
        <p className="small muted u-mb-4">
          Share your code with a friend. They enter it in the referral code field when they sign
          up — once they subscribe to the Campus Archive, you both get a discount on your next month.
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

      <div className="card u-mt-5" style={{ borderColor: '#FECACA' }}>
        <div className="u-fw-650" style={{ color: 'var(--error)' }}>Delete account</div>
        <p className="small muted u-mt-2 u-mb-4">
          Permanently deletes your account and everything tied to it — decks, flashcards, study
          history, course dates, and your <a href="/archive">Campus Archive</a> subscription
          (cancelled automatically). This can&apos;t be undone. See our{' '}
          <a href="/privacy">Privacy Policy</a> for details.
        </p>
        <div className="field u-mb-4">
          <label className="label" htmlFor="delete-confirm">Type DELETE to confirm</label>
          <input id="delete-confirm" className="input" value={deleteConfirmText}
                 onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="DELETE" />
        </div>
        {deleteError && <div role="alert" className="alert alert--error u-mb-4">{deleteError}</div>}
        <button
          className="btn"
          style={{ background: 'var(--error)', color: '#fff' }}
          disabled={deleteConfirmText !== 'DELETE' || deleting}
          onClick={deleteAccount}
        >
          {deleting && <span className="spinner" />}
          {deleting ? 'Deleting…' : 'Permanently delete my account'}
        </button>
      </div>
    </main>
  );
}
