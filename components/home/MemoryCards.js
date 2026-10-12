'use client';

import { useState } from 'react';

// "Your exam is in N days. Of 20 facts from today's lecture, you'd still know..."
// Two rows of 20 mini cards: rereading once vs reviewing on Reclipse's schedule
// (day 1, 6, 15). Cards you'd have forgotten turn face-down. A rough model of
// the forgetting curve, labelled as such on the page.
const FACTS = 20;
const REVIEWS = [1, 6, 15];
const STRENGTH = [2, 5, 12, 30];

function keptReread(days) { return Math.round(FACTS * Math.exp(-days / STRENGTH[0])); }
function keptReclipse(days) {
  let last = 0, k = 0;
  for (const r of REVIEWS) { if (days >= r) { last = r; k += 1; } }
  return Math.round(FACTS * Math.exp(-(days - last) / STRENGTH[k]));
}

const LABELS = ['ATP', '1867', 'Opp. cost', 'Mitosis', 'GDP', 'Id / ego', 'Osmosis', 'Elasticity', 'Treaty', 'DNA',
  'Inflation', 'Synapse', 'Feudalism', 'Enzyme', 'Supply', 'Cortex', 'Photon', 'Tariff', 'Neuron', 'Ions'];

function Row({ title, kept, tone }) {
  return (
    <div className="mem__row">
      <div className="mem__rowhead">
        <span className="mem__title">{title}</span>
        <span className={`mem__count mem__count--${tone}`}>{kept}<small>/{FACTS}</small></span>
      </div>
      <div className="mem__cards" aria-hidden="true">
        {LABELS.map((l, i) => (
          <span key={l} className={`mem__card mem__card--${tone}${i < kept ? '' : ' is-gone'}`}
                style={{ transitionDelay: `${(i % 10) * 18}ms` }}>
            <span className="mem__face">{l}</span>
            <span className="mem__face mem__face--back" />
          </span>
        ))}
      </div>
    </div>
  );
}

export default function MemoryCards() {
  const [days, setDays] = useState(7);
  const a = keptReread(days);
  const b = keptReclipse(days);

  return (
    <div className="mem">
      <label className="mem__q" htmlFor="mem-days">
        Your exam is in <b>{days} {days === 1 ? 'day' : 'days'}</b>. Of 20 facts from today&apos;s lecture, you&apos;d still know:
      </label>
      <input id="mem-days" className="mem__slider" type="range" min="1" max="30" value={days}
             onChange={(e) => setDays(Number(e.target.value))}
             aria-valuetext={`${days} days: ${a} facts if you reread once, ${b} with Reclipse`} />
      <div className="mem__scale" aria-hidden="true"><span>tomorrow</span><span>2 weeks</span><span>a month</span></div>
      <Row title="If you reread your notes once" kept={a} tone="dim" />
      <Row title="If you review with Reclipse" kept={b} tone="lit" />
      <p className="mem__fine">A rough model of the forgetting curve, not a promise. Reviews follow Reclipse&apos;s real schedule: day 1, 6 and 15.</p>
    </div>
  );
}
