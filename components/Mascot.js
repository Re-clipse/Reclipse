'use client';

import { useId } from 'react';

/**
 * Luna — Reclipse's mascot. A friendly eclipse: dark crescent + soft gray
 * corona. Inline SVG so it's crisp, themeable. Monochrome — no brand color.
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
          <stop offset="68%" stopColor="#8A8A93" stopOpacity="0" />
          <stop offset="84%" stopColor="#8A8A93" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8A8A93" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('blush')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C7C7CE" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#C7C7CE" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('glow')} cx="50%" cy="100%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('clip')}><circle cx="54" cy="54" r="38" /></clipPath>
      </defs>

      <circle cx="54" cy="54" r="52" fill={`url(#${id('corona')})`} className="mascot__corona" />
      <circle cx="54" cy="54" r="38" fill="#1A1A1E" />

      {/* Eclipse shadow: a darker crescent, clipped so it stays inside her body. */}
      <g clipPath={`url(#${id('clip')})`}>
        <circle cx="76" cy="40" r="32" fill="#000000" opacity="0.32" />
        <ellipse cx="38" cy="34" rx="15" ry="9" fill="#fff" opacity="0.2" transform="rotate(-28 38 34)" />
        {/* soft bounce light from below so she reads as glowing, not flat */}
        <rect x="16" y="54" width="76" height="40" fill={`url(#${id('glow')})`} />
      </g>
      <circle cx="54" cy="54" r="37.2" stroke="#C7C7CE" strokeOpacity="0.7" strokeWidth="1.6" />

      {/* cheeks — soft blush, brighter when excited */}
      <circle cx="33" cy="64" r={parts.bigCheeks ? 8.5 : 7} fill={`url(#${id('blush')})`} opacity={parts.bigCheeks ? 1 : 0.8} />
      <circle cx="75" cy="64" r={parts.bigCheeks ? 8.5 : 7} fill={`url(#${id('blush')})`} opacity={parts.bigCheeks ? 1 : 0.8} />

      {parts.brows}
      <g className={parts.noBlink ? undefined : 'mascot__eyes mascot__gaze'}>{parts.eyes}</g>
      {parts.mouth}
      {parts.extra}
    </svg>
  );
}

const eyeOpen = (
  <>
    <circle cx="42" cy="52" r="5.5" fill="#fff" />
    <circle cx="66" cy="52" r="5.5" fill="#fff" />
    <circle cx="43.6" cy="50.2" r="1.9" fill="#1A1A1E" />
    <circle cx="67.6" cy="50.2" r="1.9" fill="#1A1A1E" />
  </>
);
const eyeBig = (
  <>
    <circle cx="42" cy="52" r="7" fill="#fff" />
    <circle cx="66" cy="52" r="7" fill="#fff" />
    <circle cx="44" cy="49.6" r="2.4" fill="#1A1A1E" />
    <circle cx="68" cy="49.6" r="2.4" fill="#1A1A1E" />
  </>
);
const eyeHappyArc = (
  <>
    <path d="M36 54c2-6 9-6 11 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M61 54c2-6 9-6 11 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
  </>
);
const smileSmall = <path d="M45 66c3 5 15 5 18 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />;
const smileBig = <path d="M41 65c4 9 22 9 26 0" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" fill="#fff" fillOpacity="0.14" />;
const openGrin = <path d="M42 64c3 10 21 10 24 0z" fill="#fff" fillOpacity="0.2" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />;

// Soft raised brows add expression; `lift` moves them up for surprise/excitement.
const brows = (lift) => (
  <>
    <path d={`M35 ${42 + lift}c3-3 8-3 11-1`} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.55" />
    <path d={`M62 ${41 + lift}c3-2 8-2 11 1`} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.55" />
  </>
);

const FACES = {
  happy: { eyes: eyeOpen, mouth: smileSmall, brows: brows(0) },
  excited: { eyes: eyeBig, mouth: smileBig, bigCheeks: true, brows: brows(-3) },
  celebrate: { eyes: eyeHappyArc, mouth: openGrin, bigCheeks: true, noBlink: true },
  thinking: {
    eyes: (
      <>
        <circle cx="44" cy="52" r="5.5" fill="#fff" />
        <circle cx="68" cy="52" r="5.5" fill="#fff" />
        <path d="M36 45c3-3 8-3 11 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </>
    ),
    mouth: <path d="M46 68c4 2 9 2 13-1" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />,
  },
  determined: {
    eyes: (
      <>
        <path d="M37 47l10 1.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M71 47l-10 1.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="43" cy="54" r="4.5" fill="#fff" />
        <circle cx="65" cy="54" r="4.5" fill="#fff" />
      </>
    ),
    mouth: <path d="M46 67c3 3 13 3 16 0" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" fill="none" />,
  },
  sleepy: {
    eyes: (
      <>
        <path d="M37 52h11" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <path d="M60 52h11" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    noBlink: true,
    mouth: <circle cx="54" cy="70" r="4" fill="#fff" fillOpacity="0.5" />,
    extra: <text x="78" y="34" fontSize="14" fill="#8A8A93" className="mascot__zzz">z</text>,
  },
};
