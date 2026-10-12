'use client';

import { useRef, useState } from 'react';

// Feature list as sticky notes you can push around the desk. Drag moves a
// note; a plain click on a link still works. Positions reset on reload.
export default function StickyNotes({ notes }) {
  const [offsets, setOffsets] = useState({});
  const [top, setTop] = useState(null);
  const [dragging, setDragging] = useState(null);
  const drag = useRef(null);

  function down(e, key) {
    if (e.target.closest('a')) return;
    const cur = offsets[key] || { x: 0, y: 0 };
    drag.current = { key, sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} // not supported everywhere; dragging still works without it
    setTop(key);
    setDragging(key);
  }
  function move(e) {
    const g = drag.current;
    if (!g) return;
    setOffsets((o) => ({ ...o, [g.key]: { x: g.ox + e.clientX - g.sx, y: g.oy + e.clientY - g.sy } }));
  }
  function up() { drag.current = null; setDragging(null); }

  return (
    <div className="notes3">
      {notes.map((n, i) => {
        const o = offsets[n.t] || { x: 0, y: 0 };
        return (
          <div key={n.t}
               className={`notes3__note notes3__note--${n.color}${dragging === n.t ? ' is-dragging' : ''}`}
               style={{ '--tilt': `${[-2.5, 1.5, -1, 2.2, -1.6, 1, -0.6][i % 7]}deg`, translate: `${o.x}px ${o.y}px`, zIndex: top === n.t ? 5 : 1 }}
               onPointerDown={(e) => down(e, n.t)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <h3>{n.t}{n.tag && <span className="notes3__tag">{n.tag}</span>}</h3>
            <p>{n.d}</p>
          </div>
        );
      })}
    </div>
  );
}
