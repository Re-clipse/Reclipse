'use client';

/**
 * Luna — Reclipse's mascot. A friendly eclipse: violet crescent + glowing gold
 * corona. Inline SVG so it's crisp, themeable, animatable. Now with a wider,
 * more enthusiastic range of expressions and livelier idle motion.
 *
 * moods: happy | excited | celebrate | thinking | wave | sleepy | proud |
 *        love | wow | determined
 */
export default function Mascot({ mood = 'happy', size = 120, float = false, bounce = false, className = '' }) {
  const parts = FACES[mood] || FACES.happy;
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
        <radialGradient id="corona" cx="50%" cy="50%" r="50%">
          <stop offset="52%" stopColor="#A78BFA" stopOpacity="0" />
          <stop offset="100%" stopColor="#FACC15" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>

      {/* sparkles for the celebratory moods */}
      {parts.sparkles && (
        <g className="mascot__sparkles">
          <path d="M92 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FACC15" />
          <path d="M14 30l1.5 3.5L19 35l-3.5 1.5L14 40l-1.5-3.5L9 35l3.5-1.5z" fill="#A78BFA" />
          <path d="M96 62l1.5 3.5L101 67l-3.5 1.5L96 72l-1.5-3.5L91 67l3.5-1.5z" fill="#FB923C" />
        </g>
      )}

      <circle cx="54" cy="54" r="52" fill="url(#corona)" className="mascot__corona" />
      <circle cx="54" cy="54" r="38" fill="url(#body)" />
      <circle cx="74" cy="42" r="30" fill="#5B21B6" opacity="0.35" />

      {/* cheeks — brighter when excited */}
      <circle cx="34" cy="64" r={parts.bigCheeks ? 6 : 5} fill="#FACC15" opacity={parts.bigCheeks ? 0.7 : 0.5} />
      <circle cx="74" cy="64" r={parts.bigCheeks ? 6 : 5} fill="#FACC15" opacity={parts.bigCheeks ? 0.7 : 0.5} />

      {parts.eyes}
      {parts.mouth}
      {parts.extra}
    </svg>
  );
}

const eyeOpen = (
  <>
    <circle cx="42" cy="52" r="5.5" fill="#1A1523" />
    <circle cx="66" cy="52" r="5.5" fill="#1A1523" />
    <circle cx="43.6" cy="50.2" r="1.9" fill="#fff" />
    <circle cx="67.6" cy="50.2" r="1.9" fill="#fff" />
  </>
);
const eyeBig = (
  <>
    <circle cx="42" cy="52" r="7" fill="#1A1523" />
    <circle cx="66" cy="52" r="7" fill="#1A1523" />
    <circle cx="44" cy="49.6" r="2.4" fill="#fff" />
    <circle cx="68" cy="49.6" r="2.4" fill="#fff" />
  </>
);
const eyeHappyArc = (
  <>
    <path d="M36 54c2-6 9-6 11 0" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" fill="none" />
    <path d="M61 54c2-6 9-6 11 0" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" fill="none" />
  </>
);
const smileSmall = <path d="M45 66c3 5 15 5 18 0" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" fill="none" />;
const smileBig = <path d="M41 65c4 9 22 9 26 0" stroke="#1A1523" strokeWidth="3.4" strokeLinecap="round" fill="#1A1523" fillOpacity="0.14" />;
const openGrin = <path d="M42 64c3 10 21 10 24 0z" fill="#1A1523" fillOpacity="0.2" stroke="#1A1523" strokeWidth="3" strokeLinejoin="round" />;

const FACES = {
  happy: { eyes: eyeOpen, mouth: smileSmall },
  excited: { eyes: eyeBig, mouth: smileBig, bigCheeks: true },
  celebrate: { eyes: eyeHappyArc, mouth: openGrin, sparkles: true, bigCheeks: true },
  wow: {
    eyes: eyeBig,
    mouth: <ellipse cx="54" cy="68" rx="6" ry="8" fill="#1A1523" fillOpacity="0.6" />,
    sparkles: true,
  },
  proud: {
    eyes: eyeHappyArc,
    mouth: smileBig,
    bigCheeks: true,
    extra: <path d="M54 30l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#FACC15" transform="translate(0,-16) scale(0.5)" transform-origin="54 30" opacity="0.9" />,
  },
  love: {
    eyes: (
      <>
        <path d="M42 48c-4-4-9 0-4 5l4 4 4-4c5-5 0-9-4-5z" fill="#F472B6" />
        <path d="M66 48c-4-4-9 0-4 5l4 4 4-4c5-5 0-9-4-5z" fill="#F472B6" />
      </>
    ),
    mouth: smileBig, bigCheeks: true,
  },
  thinking: {
    eyes: (
      <>
        <circle cx="44" cy="52" r="5.5" fill="#1A1523" />
        <circle cx="68" cy="52" r="5.5" fill="#1A1523" />
        <path d="M36 45c3-3 8-3 11 0" stroke="#1A1523" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </>
    ),
    mouth: <path d="M46 68c3-2 8-2 11 0" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" fill="none" />,
  },
  determined: {
    eyes: (
      <>
        <path d="M37 48l10 3" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />
        <path d="M71 48l-10 3" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />
        <circle cx="43" cy="54" r="4.5" fill="#1A1523" />
        <circle cx="65" cy="54" r="4.5" fill="#1A1523" />
      </>
    ),
    mouth: <path d="M46 68h16" stroke="#1A1523" strokeWidth="3.4" strokeLinecap="round" />,
  },
  wave: { eyes: eyeOpen, mouth: smileSmall, extra: <g className="mascot__wave"><circle cx="90" cy="46" r="8" fill="url(#body)" /></g> },
  sleepy: {
    eyes: (
      <>
        <path d="M37 52h11" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />
        <path d="M60 52h11" stroke="#1A1523" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    mouth: <circle cx="54" cy="70" r="4" fill="#1A1523" fillOpacity="0.5" />,
    extra: <text x="78" y="34" fontSize="14" fill="#A78BFA" className="mascot__zzz">z</text>,
  },
};
