'use client';

import { useId } from 'react';

/**
 * Luna — Reclipse's mascot. A comet: a rounded four-point sparkle body in
 * violet, with a gold mini-sparkle companion and a fading dust trail behind
 * her. Inline SVG so it's crisp, themeable, animatable.
 *
 * moods: happy | excited | celebrate | thinking | determined | sleepy
 *
 * `full`: renders posed arms/legs (a different pose per mood) on a widened
 * canvas, for the handful of big, high-impact moments (hero art, onboarding,
 * session-complete screens) — everywhere else stays the compact bust used in
 * buttons, nav, empty states, and toasts.
 */
export default function Mascot({ mood = 'happy', size = 120, full = false, float = false, bounce = false, className = '' }) {
  const parts = FACES[mood] || FACES.happy;
  // Unique ids so several Lunas on one page never share (or lose) gradients.
  const uid = useId().replace(/:/g, '');
  const id = (n) => `${n}-${uid}`;
  const cls = [
    'mascot',
    full && 'mascot--full',
    float && 'mascot--float',
    bounce && 'mascot--bounce',
    (mood === 'excited' || mood === 'celebrate' || mood === 'wow') && 'mascot--wiggle',
    className,
  ].filter(Boolean).join(' ');

  // Bust: the comet's own tight 108×108 box. Full body: widened to fit posed
  // stub arms/legs without moving the comet's own coordinates (still centered
  // on 54,54) — size keeps controlling width, height follows the box ratio.
  const viewBox = full ? '-14 -18 134 154' : '0 0 108 108';
  const height = full ? Math.round(size * (154 / 134)) : size;

  return (
    <svg width={size} height={height} viewBox={viewBox} fill="none" className={cls}
         role="img" aria-label="Reclipse mascot">
      <defs>
        <radialGradient id={id('corona')} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#FACC15" stopOpacity="0" />
          <stop offset="80%" stopColor="#FACC15" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#FB923C" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('body')} x1="18" y1="18" x2="92" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="45%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
        <linearGradient id={id('shine')} x1="46" y1="14" x2="66" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('blush')} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FBCFE8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F472B6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('gold')} x1="67" y1="9" x2="95" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#FACC15" />
        </linearGradient>
      </defs>

      {/* corona glow */}
      <circle cx="54" cy="54" r="48" fill={`url(#${id('corona')})`} className="mascot__corona" />

      {/* fading dust trail */}
      <circle cx="3" cy="82" r="1.8" fill="#FACC15" opacity="0.18" />
      <circle cx="8" cy="72" r="3.2" fill="#FACC15" opacity="0.35" />
      <circle cx="14" cy="62" r="5" fill="#FACC15" opacity="0.55" />

      {/* full-body limbs render behind the comet body so shoulders/hips tuck under it */}
      {full && BODY_POSES[mood]}

      {/* comet body */}
      <path
        d="M54 16C57.8 33.1 74.9 50.2 92 54C74.9 57.8 57.8 74.9 54 92C50.2 74.9 33.1 57.8 16 54C33.1 50.2 50.2 33.1 54 16Z"
        fill={`url(#${id('body')})`}
      />
      <ellipse cx="56" cy="30" rx="10" ry="16" fill={`url(#${id('shine')})`} opacity="0.7" transform="rotate(15 56 30)" />

      {/* gold mini-sparkle companion */}
      <path
        d="M86 13C86.9 17.05 90.95 21.1 95 22C90.95 22.9 86.9 26.95 86 31C85.1 26.95 81.05 22.9 77 22C81.05 21.1 85.1 17.05 86 13Z"
        fill={`url(#${id('gold')})`}
      />
      <circle cx="88.2" cy="16.2" r="1.1" fill="#fff" opacity="0.8" />

      {/* sparkles for celebratory moods */}
      {parts.sparkles && (
        <g className="mascot__sparkles">
          <path className="mascot__twinkle" d="M92 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FACC15" />
          <path className="mascot__twinkle mascot__twinkle--b" d="M14 30l1.5 3.5L19 35l-3.5 1.5L14 40l-1.5-3.5L9 35l3.5-1.5z" fill="#A78BFA" />
          <path className="mascot__twinkle mascot__twinkle--c" d="M96 62l1.5 3.5L101 67l-3.5 1.5L96 72l-1.5-3.5L91 67l3.5-1.5z" fill="#FB923C" />
        </g>
      )}

      {/* blush cheeks */}
      <circle cx="40" cy="58" r={parts.bigCheeks ? 8 : 6} fill={`url(#${id('blush')})`} opacity={parts.bigCheeks ? 1 : 0.8} />
      <circle cx="68" cy="58" r={parts.bigCheeks ? 8 : 6} fill={`url(#${id('blush')})`} opacity={parts.bigCheeks ? 1 : 0.8} />

      {parts.brows}
      <g className={parts.noBlink ? undefined : 'mascot__eyes mascot__gaze'}>{parts.eyes}</g>
      {parts.mouth}
      {parts.extra}
    </svg>
  );
}

// ---------- faces (deliberately exaggerated — cartoony, not minimal-cute) ----------

// Independent left/right brow lift (negative = raised) + stroke weight.
const browPair = (leftLift = 0, rightLift = 0, weight = 3.2) => (
  <>
    <path d={`M33 ${41 + leftLift}c4.5-4.5 10.5-4.5 15-1`}
          stroke="#2E1065" strokeWidth={weight} strokeLinecap="round" fill="none" opacity="0.85" />
    <path d={`M60 ${40 + rightLift}c4.5-3 10.5-3 15 1`}
          stroke="#2E1065" strokeWidth={weight} strokeLinecap="round" fill="none" opacity="0.85" />
  </>
);

const eyesHappy = (
  <>
    <circle cx="44" cy="51" r="6.4" fill="#1A1523" />
    <circle cx="64" cy="51" r="6.4" fill="#1A1523" />
    <circle cx="46.3" cy="48.4" r="2.3" fill="#fff" />
    <circle cx="66.3" cy="48.4" r="2.3" fill="#fff" />
    <circle cx="41.5" cy="53.5" r="0.9" fill="#fff" opacity="0.55" />
    <circle cx="61.5" cy="53.5" r="0.9" fill="#fff" opacity="0.55" />
  </>
);
const mouthHappy = (
  <path d="M42 63c4.5 7.5 19.5 7.5 24 0" stroke="#1A1523" strokeWidth="3.4"
        strokeLinecap="round" fill="#1A1523" fillOpacity="0.1" />
);

const eyesExcited = (
  <>
    <circle cx="43" cy="50" r="8.4" fill="#1A1523" />
    <circle cx="65" cy="50" r="8.4" fill="#1A1523" />
    <circle cx="45.8" cy="46.6" r="3" fill="#fff" />
    <circle cx="67.8" cy="46.6" r="3" fill="#fff" />
    <circle cx="40" cy="53" r="1.2" fill="#fff" opacity="0.65" />
    <circle cx="62" cy="53" r="1.2" fill="#fff" opacity="0.65" />
  </>
);
const mouthExcited = <path d="M39 62c3 11 27 11 30 0c-4 5-26 5-30 0z" fill="#1A1523" fillOpacity="0.92" />;

const eyesCelebrate = (
  <>
    <path d="M34 52c2.5-9 13-9 15.5 0" stroke="#1A1523" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M58.5 52c2.5-9 13-9 15.5 0" stroke="#1A1523" strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M30 47l-3-2.5" stroke="#1A1523" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <path d="M78 47l3-2.5" stroke="#1A1523" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
  </>
);
const mouthCelebrate = (
  <>
    <path d="M37 61c3 14 31 14 34 0c-5 6-29 6-34 0z" fill="#1A1523" />
    <path d="M44 64c2 7 18 7 20 0c-3 3-17 3-20 0z" fill="#4C1D95" opacity="0.5" />
  </>
);

const eyesThinking = (
  <>
    <path d="M35 51c2.5-4 9-4 11.5 0" stroke="#1A1523" strokeWidth="3.2" strokeLinecap="round" fill="none" />
    <circle cx="66" cy="50" r="5.8" fill="#1A1523" />
    <circle cx="68.6" cy="47.4" r="1.9" fill="#fff" />
  </>
);
const browsThinking = (
  <>
    <path d="M33 43c4-1.5 9-1.5 13 0" stroke="#2E1065" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
    <path d="M60 39c4-6 11-7 16-3" stroke="#2E1065" strokeWidth="3.4" strokeLinecap="round" fill="none" opacity="0.9" />
  </>
);
const mouthThinking = <path d="M45 67c3 3 11 3.5 15 0.5" stroke="#1A1523" strokeWidth="3.2" strokeLinecap="round" fill="none" />;
const extraThinking = (
  <g opacity="0.85">
    <circle cx="78" cy="40" r="2.2" fill="#A78BFA" />
    <circle cx="84" cy="32" r="3" fill="#A78BFA" />
    <circle cx="91" cy="22" r="4" fill="#A78BFA" />
  </g>
);

const eyesDetermined = (
  <>
    <ellipse cx="43" cy="52" rx="6.6" ry="3" fill="#1A1523" transform="rotate(-6 43 52)" />
    <ellipse cx="65" cy="52" rx="6.6" ry="3" fill="#1A1523" transform="rotate(6 65 52)" />
    <circle cx="45" cy="51.2" r="1" fill="#fff" opacity="0.5" />
    <circle cx="63" cy="51.2" r="1" fill="#fff" opacity="0.5" />
  </>
);
const browsDetermined = (
  <>
    <path d="M32 40l16 6" stroke="#2E1065" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
    <path d="M76 40l-16 6" stroke="#2E1065" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
  </>
);
const mouthDetermined = <path d="M43 68c5 5 16 5 19-2" stroke="#1A1523" strokeWidth="3.6" strokeLinecap="round" fill="none" />;

const eyesSleepy = (
  <>
    <path d="M35 53c3.5 3 10.5 3 14 0" stroke="#1A1523" strokeWidth="3.6" strokeLinecap="round" fill="none" />
    <path d="M59 53c3.5 3 10.5 3 14 0" stroke="#1A1523" strokeWidth="3.6" strokeLinecap="round" fill="none" />
    <path d="M34 51.5c4-3 11-3 15 0" stroke="#1A1523" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.5" />
    <path d="M58 51.5c4-3 11-3 15 0" stroke="#1A1523" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.5" />
  </>
);
const browsSleepy = (
  <>
    <path d="M33 44c5 1.5 10 1.5 15 3.5" stroke="#2E1065" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.6" />
    <path d="M60 44c5 1.5 10 1.5 15 3.5" stroke="#2E1065" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.6" />
  </>
);
const mouthSleepy = <ellipse cx="54" cy="70" rx="5" ry="6.5" fill="#1A1523" fillOpacity="0.55" />;
const extraSleepy = (
  <g className="mascot__zzz" fill="#A78BFA">
    <text x="76" y="36" fontSize="15" fontWeight="700">Z</text>
    <text x="86" y="26" fontSize="11" fontWeight="700" opacity="0.75">z</text>
    <text x="93" y="18" fontSize="8" fontWeight="700" opacity="0.55">z</text>
  </g>
);

const FACES = {
  happy: { eyes: eyesHappy, mouth: mouthHappy, brows: browPair(-1, -1, 3.2) },
  excited: { eyes: eyesExcited, mouth: mouthExcited, brows: browPair(-6, -6, 4), bigCheeks: true },
  celebrate: {
    eyes: eyesCelebrate, mouth: mouthCelebrate, brows: browPair(-5, -5, 3.6),
    bigCheeks: true, sparkles: true, noBlink: true,
  },
  thinking: { eyes: eyesThinking, mouth: mouthThinking, brows: browsThinking, extra: extraThinking },
  determined: { eyes: eyesDetermined, mouth: mouthDetermined, brows: browsDetermined },
  sleepy: { eyes: eyesSleepy, mouth: mouthSleepy, brows: browsSleepy, noBlink: true, extra: extraSleepy },
};

// ---------- full-body poses (only rendered when `full` is set) ----------

const LIMB = '#7C3AED';
const LIMB_SHINE = '#C4B5FD';
const HAND = '#8B5CF6';
const HAND_EDGE = '#5B21B6';
const FOOT = '#6D28D9';

const legsStanding = (
  <>
    <path d="M45 82C42 92 41 104 43 116" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
    <path d="M63 82C66 92 67 104 65 116" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
    <path d="M45 82C42 92 41 104 43 116" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
    <path d="M63 82C66 92 67 104 65 116" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
    <ellipse cx="41" cy="120" rx="10" ry="6" fill={FOOT} />
    <ellipse cx="67" cy="120" rx="10" ry="6" fill={FOOT} />
  </>
);
const legsWide = (
  <>
    <path d="M42 82C36 93 33 106 35 118" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
    <path d="M66 82C72 93 75 106 73 118" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
    <path d="M42 82C36 93 33 106 35 118" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
    <path d="M66 82C72 93 75 106 73 118" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
    <ellipse cx="33" cy="122" rx="10" ry="6" fill={FOOT} />
    <ellipse cx="75" cy="122" rx="10" ry="6" fill={FOOT} />
  </>
);
const legsHop = (
  <>
    <path d="M48 82C46 90 45 98 47 104" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
    <path d="M60 82C62 90 63 98 61 104" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
    <path d="M48 82C46 90 45 98 47 104" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
    <path d="M60 82C62 90 63 98 61 104" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
    <ellipse cx="46" cy="108" rx="9" ry="5.5" fill={FOOT} />
    <ellipse cx="62" cy="108" rx="9" ry="5.5" fill={FOOT} />
  </>
);
const legsBuckled = (
  <>
    <path d="M48 82C47 92 49 104 51 114" stroke={LIMB} strokeWidth="14" strokeLinecap="round" fill="none" />
    <path d="M60 82C61 92 59 104 57 114" stroke={LIMB} strokeWidth="14" strokeLinecap="round" fill="none" />
    <path d="M48 82C47 92 49 104 51 114" stroke={LIMB_SHINE} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.3" />
    <path d="M60 82C61 92 59 104 57 114" stroke={LIMB_SHINE} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.3" />
    <ellipse cx="50" cy="118" rx="9" ry="5.5" fill={FOOT} />
    <ellipse cx="58" cy="118" rx="9" ry="5.5" fill={FOOT} />
  </>
);

const BODY_POSES = {
  happy: (
    <>
      <path d="M63 60C74 54 88 42 92 24" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M63 60C74 54 88 42 92 24" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
      <ellipse cx="95" cy="19" rx="7.5" ry="6.5" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.3" transform="rotate(-20 95 19)" />
      <path d="M44 62C34 70 29 82 31 92" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M44 62C34 70 29 82 31 92" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
      <ellipse cx="30" cy="96" rx="7" ry="6" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.3" />
      {legsStanding}
    </>
  ),
  excited: (
    <>
      <path d="M64 58C72 42 78 22 82 6" stroke={LIMB} strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M64 58C72 42 78 22 82 6" stroke={LIMB_SHINE} strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.35" />
      <circle cx="84" cy="1" r="8" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.4" />
      <path d="M43 60C28 56 12 50 0 40" stroke={LIMB} strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M43 60C28 56 12 50 0 40" stroke={LIMB_SHINE} strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.35" />
      <ellipse cx="-4" cy="36" rx="7.5" ry="6.5" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.4" transform="rotate(25 -4 36)" />
      {legsHop}
    </>
  ),
  celebrate: (
    <>
      <path d="M65 58C80 38 92 14 99 -5" stroke={LIMB} strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M65 58C80 38 92 14 99 -5" stroke={LIMB_SHINE} strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.35" />
      <circle cx="100" cy="-9" r="8" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.4" />
      <path d="M42 58C27 38 15 14 8 -5" stroke={LIMB} strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M42 58C27 38 15 14 8 -5" stroke={LIMB_SHINE} strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.35" />
      <circle cx="7" cy="-9" r="8" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.4" />
      {legsHop}
    </>
  ),
  thinking: (
    <>
      <path d="M64 58C70 66 66 74 58 76" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M64 58C70 66 66 74 58 76" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
      <ellipse cx="56" cy="77" rx="6" ry="5" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.2" />
      <path d="M44 62C38 70 40 78 50 82" stroke={LIMB} strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M44 62C38 70 40 78 50 82" stroke={LIMB_SHINE} strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35" />
      <ellipse cx="52" cy="83" rx="6.5" ry="5.5" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.2" />
      {legsStanding}
    </>
  ),
  determined: (
    <>
      <path d="M66 60C78 62 84 72 78 82" stroke={LIMB} strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M66 60C78 62 84 72 78 82" stroke={LIMB_SHINE} strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.35" />
      <ellipse cx="73" cy="85" rx="7" ry="6" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.4" />
      <path d="M42 60C30 62 24 72 30 82" stroke={LIMB} strokeWidth="16" strokeLinecap="round" fill="none" />
      <path d="M42 60C30 62 24 72 30 82" stroke={LIMB_SHINE} strokeWidth="5.5" strokeLinecap="round" fill="none" opacity="0.35" />
      <ellipse cx="35" cy="85" rx="7" ry="6" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.4" />
      {legsWide}
    </>
  ),
  sleepy: (
    <>
      <path d="M64 60C70 72 72 86 68 98" stroke={LIMB} strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M64 60C70 72 72 86 68 98" stroke={LIMB_SHINE} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.3" />
      <ellipse cx="67" cy="101" rx="6.5" ry="5.5" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.2" />
      <path d="M44 60C38 72 36 86 40 98" stroke={LIMB} strokeWidth="14" strokeLinecap="round" fill="none" />
      <path d="M44 60C38 72 36 86 40 98" stroke={LIMB_SHINE} strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.3" />
      <ellipse cx="41" cy="101" rx="6.5" ry="5.5" fill={HAND} stroke={HAND_EDGE} strokeWidth="1.2" />
      {legsBuckled}
    </>
  ),
};
