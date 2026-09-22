# Pages (dependency trees)
## /decks (My decks)
Entry: app/decks/page.js
- app/layout.js
  - components/Nav.js, components/AmbientBg.js, components/CommandBar.js, components/Toast.js, components/Celebrate.js
- components/PageHeader.js (ICONS, ACCENTS)
- components/Rewards.js (GoalRing)
- components/Mascot.js
- components/Modal.js
- components/LoadError.js
- lib/useAuth.js, lib/supabaseClient.js, lib/stats.js (streakFrom), lib/rewards.js (cardsToday), lib/net.js (withTimeout)
- app/globals.css
Data: decks(id,title,created_at,course_id,is_public,flashcards(count),quiz_questions(count)), courses, cards due count, study streak, daily goal (20 cards).
