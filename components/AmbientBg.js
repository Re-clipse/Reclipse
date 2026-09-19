'use client';

// Global, route-aware ambient motion. Mounted once in the layout; it reads the
// current path and renders soft, slow, blurred floating shapes themed to that
// page's accent. Behind everything, non-interactive, still under reduced-motion.
import { usePathname } from 'next/navigation';
import { ACCENTS } from '@/components/PageHeader';

// route prefix -> { variant, accent }
const ROUTES = [
  ['/decks',    { variant: 'decks', accent: 'violet' }],
  ['/deck',     { variant: 'decks', accent: 'violet' }],
  ['/upload',   { variant: 'upload', accent: 'blue' }],
  ['/study',    { variant: 'study', accent: 'violet' }],
  ['/quiz',     { variant: 'quiz', accent: 'violet' }],
  ['/exam',     { variant: 'exam', accent: 'orange' }],
  ['/discover', { variant: 'discover', accent: 'teal' }],
  ['/archive',  { variant: 'archive', accent: 'amber' }],
  ['/stats',    { variant: 'stats', accent: 'pink' }],
  ['/syllabus', { variant: 'syllabus', accent: 'green' }],
  ['/settings', { variant: 'settings', accent: 'indigo' }],
  ['/welcome',  { variant: 'study', accent: 'violet' }],
  ['/demo',     { variant: 'study', accent: 'violet' }],
];

const SHAPES = {
  decks:    [[8, 18, 220, 'circle', 'a', 0], [82, 12, 160, 'circle', 'b', 2], [70, 78, 260, 'circle', 'c', 1]],
  upload:   [[12, 22, 200, 'tri', 'b', 0], [80, 30, 150, 'circle', 'a', 1.5], [60, 82, 230, 'square', 'c', 0.6]],
  study:    [[15, 20, 240, 'circle', 'c', 0], [78, 60, 180, 'circle', 'a', 1], [50, 88, 160, 'ring', 'b', 2]],
  quiz:     [[10, 20, 200, 'ring', 'a', 0], [84, 30, 170, 'circle', 'b', 1], [64, 82, 220, 'circle', 'c', 0.7]],
  exam:     [[10, 25, 180, 'square', 'a', 0], [85, 18, 200, 'circle', 'b', 1.2], [72, 80, 160, 'tri', 'c', 2]],
  discover: [[14, 16, 210, 'circle', 'b', 0], [80, 40, 170, 'ring', 'a', 1], [55, 84, 240, 'circle', 'c', 0.5]],
  archive:  [[9, 20, 200, 'square', 'c', 0], [84, 26, 180, 'circle', 'a', 1.4], [66, 80, 220, 'circle', 'b', 0.8]],
  stats:    [[12, 18, 220, 'circle', 'a', 0], [82, 55, 190, 'ring', 'b', 1], [58, 85, 200, 'circle', 'c', 1.6]],
  syllabus: [[13, 22, 200, 'circle', 'b', 0], [81, 20, 170, 'square', 'c', 1], [63, 82, 240, 'circle', 'a', 0.7]],
  settings: [[11, 24, 190, 'ring', 'a', 0], [83, 40, 200, 'circle', 'b', 1.3]],
};

export default function AmbientBg() {
  const pathname = usePathname() || '/';
  const match = ROUTES.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
  if (!match) return null;                 // landing/login have their own art
  const { variant, accent } = match[1];
  const c = ACCENTS[accent] || ACCENTS.violet;
  const shapes = SHAPES[variant] || SHAPES.decks;
  return (
    <div className="ambient" aria-hidden="true" key={variant}>
      {shapes.map(([x, y, size, shape, drift, delay], i) => (
        <span key={i} className={`ambient__shape ambient__shape--${shape} drift-${drift}`}
          style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, color: c.solid, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}
