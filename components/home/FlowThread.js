'use client';

import { useEffect, useRef, useState } from 'react';

// One hand-drawn line that runs down the homepage, through every element with
// data-thread, and draws itself as you scroll, so the sections read as one
// journey (board -> notes -> cards -> remembering) instead of stacked blocks.
// Continuous and tied to scroll position; nothing appears or fades in.
export default function FlowThread() {
  const svgRef = useRef(null);
  const pathRef = useRef(null);
  const [d, setD] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Build a smooth curve through the anchors whenever layout changes.
  useEffect(() => {
    const host = svgRef.current?.parentElement;
    if (!host) return;
    function build() {
      const box = host.getBoundingClientRect();
      const pts = [...host.querySelectorAll('[data-thread]')].map((el) => {
        const r = el.getBoundingClientRect();
        const side = el.getAttribute('data-thread');
        const x = side === 'left' ? r.left - box.left - 28 : side === 'right' ? r.right - box.left + 28 : r.left - box.left + r.width / 2;
        return { x, y: r.top - box.top + r.height / 2 };
      });
      if (pts.length < 2) return;
      let p = `M${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const midY = (a.y + b.y) / 2;
        p += ` C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y}`;
      }
      setD(p);
      setSize({ w: box.width, h: host.scrollHeight });
    }
    build();
    const ro = new ResizeObserver(build);
    ro.observe(host);
    window.addEventListener('load', build);
    return () => { ro.disconnect(); window.removeEventListener('load', build); };
  }, []);

  // Draw it in proportion to how far down the page you are.
  useEffect(() => {
    const path = pathRef.current;
    if (!path || !d) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function onScroll() {
      if (reduce) { path.style.strokeDashoffset = '0'; return; }
      const host = svgRef.current.parentElement;
      const r = host.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.7 - r.top) / r.height));
      path.style.strokeDashoffset = `${len * (1 - progress)}`;
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [d]);

  return (
    <svg ref={svgRef} className="thread" width={size.w} height={size.h} aria-hidden="true">
      <path ref={pathRef} d={d} className="thread__path" />
    </svg>
  );
}
