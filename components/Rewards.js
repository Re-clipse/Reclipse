'use client';

import { rankTitle } from '@/lib/rewards';

export function LevelCard({ level, pct, into, span, xp }) {
  return (
    <div className="level-card">
      <div className="level-badge">
        <span className="level-badge__n">{level}</span>
        <span className="level-badge__l">{rankTitle(level)}</span>
      </div>
      <div className="level-body">
        <div className="level-title">
          <strong>Level {level}</strong>
          <span>{into} / {span} XP</span>
        </div>
        <div className="xp-track"><div className="xp-fill" style={{ width: `${pct}%` }} /></div>
        <p className="small muted" style={{ marginTop: 'var(--s-2)' }}>{xp.toLocaleString()} XP earned all-time</p>
      </div>
    </div>
  );
}

export function GoalRing({ done, goal, pct }) {
  const R = 34, C = 2 * Math.PI * R;
  const off = C - (Math.min(100, pct) / 100) * C;
  return (
    <div className="goal-ring">
      <svg width="84" height="84" viewBox="0 0 84 84">
        <defs>
          <linearGradient id="goalgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#FACC15" />
          </linearGradient>
        </defs>
        <circle className="goal-ring__track" cx="42" cy="42" r={R} strokeWidth="8" fill="none" />
        <circle className="goal-ring__fill" cx="42" cy="42" r={R} strokeWidth="8" fill="none"
                strokeDasharray={C} strokeDashoffset={off} />
        <text className="goal-ring__center" x="42" y="42" text-anchor="middle" dominant-baseline="central"
              transform="rotate(90 42 42)">{pct}%</text>
      </svg>
      <div className="goal-ring__label">
        <strong>{done} / {goal}</strong>
        <p>{done >= goal ? 'Daily goal hit — nice.' : 'cards reviewed today'}</p>
      </div>
    </div>
  );
}

function Medal() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="15" r="6" /><path d="M9 9 6 2m9 7 3-7M9.5 2h5" />
    </svg>
  );
}
function Lock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function Achievements({ items }) {
  const unlocked = items.filter((a) => a.unlocked).length;
  return (
    <div className="card">
      <div className="row row--between" style={{ marginBottom: 'var(--s-4)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)' }}>Achievements</h3>
        <span className="badge">{unlocked} / {items.length}</span>
      </div>
      <div className="ach-grid">
        {items.map((a) => (
          <div key={a.id} className={`ach ${a.unlocked ? 'ach--unlocked' : 'ach--locked'}`}>
            <div className="ach__medal">{a.unlocked ? <Medal /> : <Lock />}</div>
            <div>
              <div className="ach__t">{a.title}</div>
              <div className="ach__d">{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
