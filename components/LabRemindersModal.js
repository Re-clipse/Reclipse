'use client';

import { useState } from 'react';
import Modal from '@/components/Modal';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/Toast';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "BI110 — Cell Biology" -> "BI110" — same split used elsewhere (e.g. archive
// shelf grouping) for pulling a course code out of a free-text course name.
function guessCode(course) {
  if (course.code) return course.code;
  const m = (course.name || '').split(/\s+[—–-]\s+/);
  return m[0] || course.name || '';
}

function emptyRow() {
  return { course_code: '', course_name: '', weekday: 1, time: '', ends_on: '' };
}

/**
 * Handles both the first-visit walkthrough ("Would you like lab reminders?")
 * and the persistent "Lab reminders" management view reachable from the
 * calendar page any time after. `initialStep` picks which one opens.
 */
export default function LabRemindersModal({ initialStep, labs, courses, onClose, onDismissWalkthrough, onLabsChanged }) {
  const toast = useToast();
  const [step, setStep] = useState(initialStep); // 'ask' | 'manage'
  const [rows, setRows] = useState([emptyRow()]);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const codeSuggestions = [...new Set((courses || []).map(guessCode).filter(Boolean))];

  function updateRow(i, patch) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((rs) => [...rs, emptyRow()]); }
  function removeRow(i) { setRows((rs) => rs.filter((_, idx) => idx !== i)); }

  async function saveRows() {
    setError('');
    const toSave = rows
      .map((r) => ({ ...r, course_code: r.course_code.trim(), course_name: r.course_name.trim() }))
      .filter((r) => r.course_code);
    if (!toSave.length) { setError('Add at least one course code.'); return; }
    const missingEndDate = toSave.find((r) => !r.ends_on);
    if (missingEndDate) { setError('Set an end date for each lab — when does the term end?'); return; }

    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: insertError } = await supabase.from('lab_schedules').insert(
      toSave.map((r) => ({
        user_id: user.id,
        course_code: r.course_code,
        course_name: r.course_name || null,
        weekday: Number(r.weekday),
        time: r.time || null,
        ends_on: r.ends_on,
      }))
    ).select();
    setAdding(false);
    if (insertError) { setError('Could not save these labs. Please try again.'); return; }

    onLabsChanged([...(labs || []), ...(data || [])]);
    toast('Lab reminders added', 'success');
    setRows([emptyRow()]);
    setStep('manage');
  }

  async function deleteLab(id) {
    setBusyId(id);
    const { error: deleteError } = await supabase.from('lab_schedules').delete().eq('id', id);
    setBusyId(null);
    if (deleteError) { toast('Could not delete that', 'error'); return; }
    onLabsChanged((labs || []).filter((l) => l.id !== id));
    toast('Removed');
  }

  async function toggleActive(lab) {
    setBusyId(lab.id);
    const { error: updateError } = await supabase.from('lab_schedules')
      .update({ active: !lab.active }).eq('id', lab.id);
    setBusyId(null);
    if (updateError) { toast('Could not save that', 'error'); return; }
    onLabsChanged((labs || []).map((l) => (l.id === lab.id ? { ...l, active: !l.active } : l)));
  }

  if (step === 'ask') {
    return (
      <Modal title="Lab reminders" onClose={onClose}>
        <div className="stack">
          <p>Would you like study reminders when you have labs due?</p>
          <p className="small muted">
            Syllabus dates cover exams and assignments, but labs usually aren&apos;t listed with a
            specific date — this adds a weekly reminder instead, the day before each one.
          </p>
          <div className="row">
            <button className="btn btn--primary" onClick={() => setStep('manage')}>Yes, add my labs</button>
            <button className="btn btn--ghost" onClick={onDismissWalkthrough}>No thanks</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Lab reminders" onClose={onClose}>
      <div className="stack" style={{ gap: 'var(--s-5)' }}>
        {labs?.length > 0 && (
          <div className="stack">
            <label className="label">Your labs</label>
            {labs.map((lab) => (
              <div key={lab.id} className="card row" style={{ opacity: lab.active ? 1 : 0.5 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{lab.course_code}{lab.course_name ? ` — ${lab.course_name}` : ''}</div>
                  <div className="small muted">
                    Every {WEEKDAYS[lab.weekday]}{lab.time ? ` at ${lab.time}` : ''} · until {lab.ends_on}
                  </div>
                </div>
                <button className="btn btn--quiet" disabled={busyId === lab.id} onClick={() => toggleActive(lab)}>
                  {lab.active ? 'Pause' : 'Resume'}
                </button>
                <button className="btn btn--ghost" disabled={busyId === lab.id} onClick={() => deleteLab(lab.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="stack">
          <label className="label">Add a lab</label>
          {rows.map((row, i) => (
            <div key={i} className="card stack" style={{ gap: 'var(--s-3)' }}>
              <div className="row">
                <div className="field" style={{ flex: 1 }}>
                  <label className="label" htmlFor={`lab-code-${i}`}>Course code</label>
                  <input id={`lab-code-${i}`} className="input" list="lab-course-codes" placeholder="e.g. CP104"
                         value={row.course_code} onChange={(e) => updateRow(i, { course_code: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="label" htmlFor={`lab-name-${i}`}>Course name (optional)</label>
                  <input id={`lab-name-${i}`} className="input" placeholder="e.g. Intro to Programming"
                         value={row.course_name} onChange={(e) => updateRow(i, { course_name: e.target.value })} />
                </div>
              </div>
              <div className="row">
                <div className="field" style={{ flex: 1 }}>
                  <label className="label" htmlFor={`lab-day-${i}`}>Day of week</label>
                  <select id={`lab-day-${i}`} className="input" value={row.weekday}
                          onChange={(e) => updateRow(i, { weekday: e.target.value })}>
                    {WEEKDAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
                  </select>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="label" htmlFor={`lab-time-${i}`}>Time (optional)</label>
                  <input id={`lab-time-${i}`} type="time" className="input" value={row.time}
                         onChange={(e) => updateRow(i, { time: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="label" htmlFor={`lab-end-${i}`}>Last day of term</label>
                  <input id={`lab-end-${i}`} type="date" className="input" value={row.ends_on}
                         onChange={(e) => updateRow(i, { ends_on: e.target.value })} />
                </div>
              </div>
              {rows.length > 1 && (
                <button type="button" className="btn btn--quiet" style={{ alignSelf: 'flex-start' }} onClick={() => removeRow(i)}>
                  Remove this row
                </button>
              )}
            </div>
          ))}
          <datalist id="lab-course-codes">
            {codeSuggestions.map((c) => <option key={c} value={c} />)}
          </datalist>
          <button type="button" className="btn btn--quiet" style={{ alignSelf: 'flex-start' }} onClick={addRow}>
            + Add another row
          </button>
        </div>

        {error && <div role="alert" className="alert alert--error">{error}</div>}

        <div className="row">
          <button className="btn btn--primary" disabled={adding} onClick={saveRows}>
            {adding && <span className="spinner" />}{adding ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn--quiet" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
}
