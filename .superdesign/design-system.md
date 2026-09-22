# Reclipse design system (existing — preserve)

## Product
Reclipse turns lecture notes/PDFs into flashcards + quizzes with spaced repetition. Audience: university students (Wilfrid Laurier). Tone: friendly, encouraging, premium-but-playful.
Page in scope: **/decks — "My decks"**: list of the user's study sets with search, course filter, stats, daily goal, review-due CTA.

## Non-negotiables (keep in every redesign)
- **Luna the mascot** (component `Mascot`, moods e.g. "happy", floating) used in empty state.
- **Per-page accent system**: PageHeader renders a colored icon tile + title + subtitle + action slot; page accent scope vars --pa / --pa-soft / --pa-ink. Decks accent = violet (#7C3AED / soft #EDE9FE / ink #5B21B6). `.btn--page` uses --pa.
- **Celebration/reward system**: daily-goal ring (GoalRing, violet→yellow gradient), streak chip that glows when streak > 0, XP/levels elsewhere.
- **Ambient motion**: soft ambient background shapes, `.rise` staggered card entrance (40ms steps), page-in animation, lift-on-hover.
- **Dark mode** via [data-theme='dark'] must work.
- Preserve all functionality: search, course pills (All / each course / Uncategorised), "+ Course" modal, per-deck Study / Open / Delete, "Review N due" CTA, Shared badge, card/quiz counts, skeleton loading, error retry, empty states.

## Tokens
Font Inter (400-800). Violet 50 #F6F4FF, 100 #EDE9FE, 200 #DDD6FE, 300 #C4B5FD, 500 #8B5CF6, 600 #7C3AED, 700 #6D28D9, 900 #4C1D95. Yellow 200 #FEF3C7, 400 #FACC15, 600 #CA8A04. Ink #1A1523, ink-2 #3F3A4D, gray #6B7280, line #E9E4F5, surface #FBFAFF. Success #059669, error #DC2626.
Radii 8/12/16/24/999. Spacing 4px base (4,8,12,16,24,32,48,64,96). Shadows soft violet-tinted. Buttons pill-shaped (primary = violet gradient, accent = warm yellow, ghost = outlined, quiet = text). Cards white with 1px --line border, radius 16.
Layout: centered column max-width 760px (`.page`), wide 1060px.
Motion: short & functional; ease cubic-bezier(.16,1,.3,1); 120/200/380ms.
