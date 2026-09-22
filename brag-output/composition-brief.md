# Hyperframes Composition Brief: Reclipse

## Objective
Create a short launch-style brag video for Reclipse, a study app that turns lecture notes into flashcards and quizzes built on active recall.

## Output
- Composition directory: `composition/`
- Rendered video: `brag.mp4`
- Format: landscape — 1920x1080
- Duration: 22s (range 20-24s)

## Source Material
- Project root: /Users/ethanmacleod/reclipse
- Primary files read: app/page.js (landing), app/upload/page.js, app/study/page.js, app/stats/page.js, components/Mascot.js, components/Rewards.js, app/globals.css, components/PageHeader.js, README.md
- Product name: Reclipse
- Tagline / strongest claim: "Study less. Remember more." and "Rereading feels productive. It mostly isn't."
- Key UI or visual moment to recreate: the /study flashcard flip + four rating buttons (Again/Hard/Good/Easy with 1m/10m/1d/4d), the /upload dropzone with PDF/Text/Photo chips, the goal ring + streak chip from /stats, and Luna the mascot (original character — see Visual Identity)
- Copy that must appear verbatim:
  - "Rereading feels productive."
  - "It mostly isn't."
  - "Study less. Remember more."
  - "built on active recall."
  - "Drop a file here, or click to browse."
  - "Building your study set"
  - "Free while in early access"

## Creative Direction
- Tone preset: default
- Creative direction: earnest but warm — "the study app that admits rereading doesn't work"
- Interpretation: comfortable pacing, 6 scenes at 3-5s each, confident simple motion. The hook's blunt claim is the one edgy moment; everything after is warm and clear, not jokey.
- Angle: open on the site's own science claim, then prove it by showing the real product loop (upload -> flip a real card and rate it -> streak/goal payoff) in under 20s.
- Hook: "Rereading feels productive." -> "It mostly isn't." on the violet gradient background.
- Outro / punchline: logo + wordmark, "Study less. Remember more." reprised, "Free while in early access", Luna peeking in happy.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Any resemblance to third-party/copyrighted characters in Luna's design — she is an original mascot: a simple violet eclipse-shaped circle with a soft gold corona glow, two round dot eyes, blush cheeks, a simple curved smile. Build her fresh from those primitives.

## Visual Identity
- Background: #FBFAFF (light scenes); linear gradient #4C1D95 -> #6D28D9 (violet gradient scenes)
- Text: #1A1523 on light scenes; #FFFFFF on violet gradient scenes
- Accent: #6D28D9 (violet-700) primary, #FACC15 (yellow-400) secondary - used together as the signature violet-to-gold gradient (on "more.", the goal ring, Luna's corona)
- Display font: Inter, weight 750-800
- Body font: Inter, weight 400-600
- Visual references from the project: pill-shaped buttons (fully rounded corners), 16px-radius cards with soft violet-tinted shadows, the violet/gold gradient goal ring, the app's own logo mark (violet rounded-square with a white circular-arrow icon: SVG paths "M21 12a9 9 0 1 1-9-9" and "M21 3v6h-6")

## Storyboard
Use the storyboard in `../brag-plan.md` as the creative contract.

Scene summary:
1. Hook - 3s - "Rereading feels productive." -> "It mostly isn't." on violet gradient bg
2. Reveal - 4s - Logo + "Reclipse" wordmark, headline "Study less. Remember more." (gradient "more."), then "built on active recall."
3. Upload (key action 1) - 4s - real dropzone, PDF/Text/Photo chips arrive one by one, a file "BI110_lecture6.pdf" drags in, done state, cut to Luna (thinking) + "Building your study set"
4. Study: flip + rate (centerpiece) - 5s - real flashcard flips Q->A, 4 rating buttons stagger in (Again 1m / Hard 10m / Good 1d / Easy 4d), cursor clicks Good
5. Progress payoff - 3s - goal ring animates to 78% ("15/20 cards"), streak chip "5 day streak", Luna (celebrate, sparkles) bounces in
6. Outro - 3s - violet gradient again, logo + wordmark, "Study less. Remember more." reprised, "Free while in early access", Luna peeks in happy, fade out

## Audio
- Audio role: warm upbeat bed with light rhythmic accents on interactions
- Audio arc: bed fades in under Scene 1, full through the middle, payoff chime timed near strong cues in Scene 5, fades out under the final hold of Scene 6
- Music: assets/music/happy-beats-business-moves-vol-1-by-ende-dot-app.mp3 (already copied into composition/assets/music/)
- Music treatment: start 0s, volume ~0.35, fade in ~0.4s, fade out over the last ~0.6s
- Music cue guidance: bundled preset at ~/.claude/skills/brag/assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json (120 BPM). Strong cues at 16.02s/17.02s/18.02s land in Scene 5 (ring completion + Luna's celebration entrance) - aim to lock one of these within +-0.15s. Strong cues at 20.02s/21.01s land in Scene 6 (logo landing) - aim to lock one within +-0.15s. Full beat grid (~0.5s spacing) is available for the Scene 4 button stagger as an accent-only reference, not for readable text.
- Audio-reactive treatment: subtle - let the ambient corona/glow behind Luna and the hero gradient breathe slightly with music RMS. No waveform/equalizer visuals.
- Audio-coupled moments:
  - Scene 1 line swap - soft accent on the cut
  - Scene 2 logo pop-in - soft reveal impact
  - Scene 3 file drop - soft drop sound as the file lands
  - Scene 4 card flip - flip/whoosh sound; "Good" click - distinct click sound
  - Scene 5 ring completion + Luna arrival - bright chime/bell, beat-locked near a strong cue
  - Scene 6 logo landing - soft bell/impact, beat-locked near a strong cue; music fades out under the hold
- SFX selection guidance: match the real gesture - drop sound for the file landing, a card/flip sound for the flashcard, a click for the button press, a bell/chime for the celebration payoff and the outro logo. Moderate density (3-5 cues total), not dense/chaotic.
- SFX analysis guidance: ~/.claude/skills/brag/assets/sfx/sfx-analysis.md - prefer low/medium high-frequency-risk files for the repeated/polished moments (flip, click); the celebration bell/chime can be a bit brighter.
- Exact SFX choice: choose filenames, timestamps, density and volume based on the implemented animation.
- Audio files: music already copied to composition/assets/music/; copy any selected SFX into composition/assets/sfx/ before referencing them.
