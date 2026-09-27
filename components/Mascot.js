'use client';

import { useId } from 'react';

/**
 * Luna — Reclipse's mascot. A friendly moon: light gray face with a soft
 * eclipse-shadow crescent, dark features for expression. Inline SVG so it's
 * crisp, themeable. Monochrome — no brand color.
 *
 * A dark face with light features reads as a void with glowing eyes, not a
 * character — so the face itself stays light, and only her features (eyes,
 * brows, mouth) are dark. That's the one rule this file exists to protect.
 *
 * moods: happy | excited | celebrate | thinking | sleepy
 */
export default function Mascot({ mood = 'happy', size = 120, float = false, bounce = false, className = '' }) {
  const parts = FACES[mood] || FACES.happy;
  // Unique ids so several Lunas on one page never share (or lose) gradients/clip paths.
  const uid = useId().replace(/:/g, '');
  const id = (n) => `${n}-${uid}`;
  const cls = [
    'mascot',
    float && 'mascot--float',
    bounce && 'mascot--bounce',
    (mood === 'excited' || mood === 'celebrate' || mood === 'wow') && 'mascot--wiggle',
    className,
  ].filter(Boolean).join(' ');

  return (
    <svg width={size} height={size} viewBox="0 0 108 108" fill="none" className={cls}
         role="img" aria-label="Reclipse mascot">
      <defs>
        <radialGradient id={id('corona')} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#9B9B9B" stopOpacity="0" />
          <stop offset="86%" stopColor="#9B9B9B" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#9B9B9B" stopOpacity="0" />
        </radialGradient>
        {/* Face volume: a soft light-to-lighter falloff, not a hard value split. */}
        <radialGradient id={id('face')} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#F5F5F5" />
          <stop offset="100%" stopColor="#E2E2E2" />
        </radialGradient>
        <radialGradient id={id('blush')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C7C7C7" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#C7C7C7" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('clip')}><circle cx="54" cy="54" r="38" /></clipPath>
      </defs>

      <circle cx="54" cy="54" r="52" fill={`url(#${id('corona')})`} className="mascot__corona" />
      <circle cx="54" cy="54" r="38" fill={`url(#${id('face')})`} />

      {/* Eclipse shadow: a soft gray crescent, clipped so it stays inside her face —
          reads as the "eclipse" concept without going dark enough to look like a hole. */}
      <g clipPath={`url(#${id('clip')})`}>
        <circle cx="78" cy="38" r="30" fill="#B0B0B0" opacity="0.4" />
      </g>
      <circle cx="54" cy="54" r="37.5" stroke="#C7C7C7" strokeWidth="1.4" />

      {/* cheeks — soft, barely-there warmth, brighter when excited */}
      <circle cx="33" cy="64" r={parts.bigCheeks ? 8.5 : 7} fill={`url(#${id('blush')})`} opacity={parts.bigCheeks ? 1 : 0.7} />
      <circle cx="75" cy="64" r={parts.bigCheeks ? 8.5 : 7} fill={`url(#${id('blush')})`} opacity={parts.bigCheeks ? 1 : 0.7} />

      {parts.brows}
      <g className={parts.noBlink ? undefined : 'mascot__eyes mascot__gaze'}>{parts.eyes}</g>
      {parts.mouth}
      {parts.extra}
    </svg>
  );
}

const INK = '#1A1A1A';

const eyeOpen = (
  <>
    <circle cx="42" cy="52" r="5.5" fill={INK} />
    <circle cx="66" cy="52" r="5.5" fill={INK} />
    <circle cx="43.8" cy="50" r="1.9" fill="#fff" />
    <circle cx="67.8" cy="50" r="1.9" fill="#fff" />
  </>
);
const eyeBig = (
  <>
    <circle cx="42" cy="52" r="7" fill={INK} />
    <circle cx="66" cy="52" r="7" fill={INK} />
    <circle cx="44.2" cy="49.4" r="2.4" fill="#fff" />
    <circle cx="68.2" cy="49.4" r="2.4" fill="#fff" />
  </>
);
const eyeHappyArc = (
  <>
    <path d="M36 54c2-6 9-6 11 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M61 54c2-6 9-6 11 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
  </>
);
const smileSmall = <path d="M45 66c3 5 15 5 18 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />;
const smileBig = <path d="M41 65c4 9 22 9 26 0" stroke={INK} strokeWidth="3.4" strokeLinecap="round" fill={INK} fillOpacity="0.08" />;
const openGrin = <path d="M42 64c3 10 21 10 24 0z" fill={INK} fillOpacity="0.14" stroke={INK} strokeWidth="3" strokeLinejoin="round" />;

// Soft raised brows add expression; `lift` moves them up for surprise/excitement.
const brows = (lift) => (
  <>
    <path d={`M35 ${42 + lift}c3-3 8-3 11-1`} stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.5" />
    <path d={`M62 ${41 + lift}c3-2 8-2 11 1`} stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.5" />
  </>
);

const FACES = {
  happy: { eyes: eyeOpen, mouth: smileSmall, brows: brows(0) },
  excited: { eyes: eyeBig, mouth: smileBig, bigCheeks: true, brows: brows(-3) },
  celebrate: { eyes: eyeHappyArc, mouth: openGrin, bigCheeks: true, noBlink: true },
  thinking: {
    eyes: (
      <>
        <circle cx="44" cy="52" r="5.5" fill={INK} />
        <circle cx="68" cy="52" r="5.5" fill={INK} />
        <path d="M36 45c3-3 8-3 11 0" stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </>
    ),
    mouth: <path d="M46 68c4 2 9 2 13-1" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />,
  },
  determined: {
    eyes: (
      <>
        <path d="M37 47l10 1.5" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M71 47l-10 1.5" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="43" cy="54" r="4.5" fill={INK} />
        <circle cx="65" cy="54" r="4.5" fill={INK} />
      </>
    ),
    mouth: <path d="M46 67c3 3 13 3 16 0" stroke={INK} strokeWidth="3.2" strokeLinecap="round" fill="none" />,
  },
  sleepy: {
    eyes: (
      <>
        <path d="M37 52h11" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M60 52h11" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    noBlink: true,
    mouth: <circle cx="54" cy="70" r="4" fill={INK} fillOpacity="0.4" />,
    extra: <text x="78" y="34" fontSize="14" fill="#9B9B9B" className="mascot__zzz">z</text>,
  },
};
