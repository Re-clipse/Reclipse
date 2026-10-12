'use client';

import { useMemo, useState } from 'react';

// Interactive forgetting curve. Drag through 30 days and compare memory with
// no reviews against reviews on the SM-2 schedule Reclipse uses (day 1, 6, 15).
// It's an illustrative model, labelled as such; not measured data.
const W = 640, H = 260, PAD = { l: 44, r: 16, t: 16, b: 34 };
const DAYS = 30;
const REVIEWS = [1, 6, 15];
const STRENGTH = [1.2, 4, 11, 30]; // memory "half-life" grows after each review

function retainNoReview(t) { return 100 * Math.exp(-t / STRENGTH[0]); }
function retainWithReviews(t) {
  let last = 0, k = 0;
  for (const r of REVIEWS) { if (t >= r) { last = r; k += 1; } }
  return 100 * Math.exp(-(t - last) / STRENGTH[k]);
}
const x = (d) => PAD.l + (d / DAYS) * (W - PAD.l - PAD.r);
const y = (p) => PAD.t + (1 - p / 100) * (H - PAD.t - PAD.b);

function path(fn) {
  const pts = [];
  for (let i = 0; i <= DAYS * 8; i++) {
    const d = i / 8;
    // draw the jump at each review as a vertical line
    if (fn === retainWithReviews && REVIEWS.includes(d)) pts.push(`L${x(d)},${y(fn(d - 0.001))}`);
    pts.push(`${i ? 'L' : 'M'}${x(d)},${y(fn(d))}`);
  }
  return pts.join(' ');
}

export default function ForgettingCurve() {
  const [day, setDay] = useState(7);
  const paths = useMemo(() => ({ none: path(retainNoReview), withR: path(retainWithReviews) }), []);
  const a = Math.round(retainNoReview(day));
  const b = Math.round(retainWithReviews(day));

  return (
    <div className="curve2">
      <div className="curve2__readout">
        <div>
          <span className="curve2__num curve2__num--none">{a}%</span>
          <span className="curve2__lbl">remembered if you just reread once</span>
        </div>
        <div>
          <span className="curve2__num curve2__num--with">{b}%</span>
          <span className="curve2__lbl">with Reclipse reviews</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="curve2__svg" role="img"
           aria-label={`On day ${day}, about ${a}% remembered without reviews and ${b}% with reviews.`}>
        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} className="curve2__grid" />
            <text x={PAD.l - 8} y={y(p) + 4} className="curve2__axis" textAnchor="end">{p}%</text>
          </g>
        ))}
        {[0, 5, 10, 15, 20, 25, 30].map((d) => (
          <text key={d} x={x(d)} y={H - 10} className="curve2__axis" textAnchor="middle">day {d}</text>
        ))}
        <path d={paths.none} className="curve2__line curve2__line--none" />
        <path d={paths.withR} className="curve2__line curve2__line--with" />
        {REVIEWS.map((r) => (
          <g key={r}>
            <circle cx={x(r)} cy={y(100)} r="5" className="curve2__dot" />
            <text x={x(r)} y={y(100) - 9} className="curve2__axis curve2__axis--rev" textAnchor="middle">review</text>
          </g>
        ))}
        <line x1={x(day)} x2={x(day)} y1={PAD.t} y2={H - PAD.b} className="curve2__cursor" />
        <circle cx={x(day)} cy={y(retainNoReview(day))} r="6" className="curve2__pt curve2__pt--none" />
        <circle cx={x(day)} cy={y(retainWithReviews(day))} r="6" className="curve2__pt curve2__pt--with" />
      </svg>

      <label className="curve2__slider">
        <span>Day {day} after the lecture</span>
        <input type="range" min="0" max={DAYS} step="1" value={day} onChange={(e) => setDay(Number(e.target.value))} />
      </label>
      <p className="curve2__fine">Illustrative model of the forgetting curve, not measured data. Review days match Reclipse&apos;s schedule.</p>
    </div>
  );
}
