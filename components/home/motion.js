'use client';

import { useEffect, useState } from 'react';

// The homepage's whole motion toolkit. No animation library: CSS does the
// animating, these hooks only decide *when*. Every listener is removed on unmount.

/** Tracks a media query (false during server render). */
export function useMedia(query) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');

/** True once `ref` has entered view; stays true. */
export function useEnteredView(ref, threshold = 0.3) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return seen;
}

/**
 * Calls onProgress(0..1) at most once per frame while scrolling through `ref`,
 * only while it is near the viewport. Positions are read fresh each frame, so
 * resizing never leaves stale offsets. `onProgress` and `measure` must be stable.
 */
export function useScrollProgress(ref, onProgress, measure, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let frame = 0;
    let near = false;
    const run = () => {
      frame = 0;
      onProgress(Math.min(1, Math.max(0, measure(el.getBoundingClientRect(), window.innerHeight))));
    };
    const schedule = () => { if (near && !frame) frame = requestAnimationFrame(run); };
    const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; schedule(); }, { rootMargin: '25% 0px' });
    io.observe(el);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, onProgress, measure, enabled]);
}
