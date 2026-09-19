'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

/**
 * Lightweight, dependency-free celebration engine. Canvas confetti bursts +
 * a global "pop" helper. Tied to real accomplishments (finishing a session,
 * correct answers, streaks) so it reinforces studying, not idle clicking.
 * Fully disabled under prefers-reduced-motion.
 */
const CelebrateCtx = createContext({ burst: () => {}, cannon: () => {} });
export const useCelebrate = () => useContext(CelebrateCtx);

const COLORS = ['#7C3AED', '#A78BFA', '#FACC15', '#FB923C', '#34D399', '#F472B6'];

// Confetti is intentionally always-on per product decision — a brief, one-shot
// celebration on real accomplishment, not continuous motion.

export function CelebrateProvider({ children }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const raf = useRef(null);

  const ensureLoop = useCallback(() => {
    if (raf.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.vy += 0.16;              // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        const alpha = Math.min(1, p.life / 30);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      if (particles.current.length) {
        raf.current = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf.current);
        raf.current = null;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  const spawn = useCallback((x, y, count, power) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * power + power * 0.3;
      particles.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - power * 0.5,
        size: Math.random() * 8 + 5,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: Math.random() * 40 + 60,
      });
    }
    ensureLoop();
  }, [ensureLoop]);

  // Burst from a point (e.g. a correct answer, centred on an element).
  const burst = useCallback((el, opts = {}) => {
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    if (el?.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    spawn(x, y, opts.count || 28, opts.power || 9);
  }, [spawn]);

  // Big two-sided cannon for major wins (session complete, high score).
  const cannon = useCallback(() => {
    const h = window.innerHeight * 0.55;
    spawn(0, h, 60, 14);
    spawn(window.innerWidth, h, 60, 14);
    setTimeout(() => { spawn(window.innerWidth / 2, window.innerHeight * 0.3, 50, 12); }, 180);
  }, [spawn]);

  return (
    <CelebrateCtx.Provider value={{ burst, cannon }}>
      {children}
      <canvas ref={canvasRef} className="celebrate-canvas" aria-hidden="true" />
    </CelebrateCtx.Provider>
  );
}
