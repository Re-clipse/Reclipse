# Brag Plan: Reclipse

## What is this app?
Reclipse turns a student's lecture notes, PDFs, or a photo of a whiteboard into flashcards and a quiz built on active recall (spaced repetition) — so studying is retrieval practice, not re-reading.

## The angle
The site's own science section says it best: "Rereading feels productive. It mostly isn't." Open on that line as a direct, slightly provocative claim, then prove it by showing the real product loop in under 20 seconds — notes in, a real flashcard flip with spaced-repetition rating buttons, a streak ticking up. Earnest, not jokey: this is a real study tool with a specific point of view about how memory works.

## Hook (first 2-3 seconds)
Two lines of large display type, on the app's own ambient violet/gold background:
"Rereading feels productive." → cuts to → "It mostly isn't."
(Both lines are the exact copy from the app's science section.)

## Key moments (the middle)
- The Upload screen: real dropzone copy and format chips (PDF / Text / Photo), a file dropping in.
- The Study screen: a real flashcard flipping from question to answer, then the four real rating buttons (Again / Hard / Good / Easy) with their actual interval labels (1m / 10m / 1d / 4d).
- The Progress payoff: the real goal ring animating up, the streak chip ticking, Luna (the app's mascot) celebrating.

## Outro / punchline
Logo mark + "Reclipse" wordmark, the real headline "Study less. Remember more." underneath, and the real line "Free while in early access." Luna peeks in, happy. Quiet fade.

## User flow worth showing
Entry → key action → result, pulled straight from the real app:
1. **Entry:** upload a page of lecture notes (`/upload` — real dropzone + format chips).
2. **Key action:** study a generated flashcard — flip it, then rate it (`/study` — real flip card + rating row).
3. **Result:** progress updates — goal ring fills, streak increments, Luna celebrates (`/stats`-style payoff).

## Tone
- Preset: `default`
- Creative direction: earnest but warm — "the study app that admits rereading doesn't work"
- Interpretation: playful clean pacing (4-6 scenes, each 3-5s), first-person-plural warmth where there's a voice, no corporate language. The one moment of "attitude" is the hook's blunt claim; everything after it is confident and simple, not silly.

## Format: landscape — 1920x1080
## Duration: 22s target (range 20–24s)

## Visual identity (from the project)
- Background: `#FBFAFF` (--surface) light scenes; `#4C1D95`→`#6D28D9` violet gradient for the hook/outro
- Accent: `#6D28D9` (violet-700) primary, `#FACC15` (yellow-400) secondary — the app's signature violet-to-gold pairing, used for the gradient on "more.", the goal ring, and Luna's corona
- Text: `#1A1523` (ink) on light scenes, `#FFFFFF` on the violet gradient scenes
- Display + body font: Inter (400–800 weights) — the only font in the app
- Strongest visual element: Luna — a violet eclipse-shaped mascot with a soft gold corona glow, blush cheeks and a simple smiling face; recreate her fresh as simple geometric shapes (circles, a corona gradient, two dot eyes, a curved mouth), matching that description — do not reference or copy any third-party character design
- Also strong: the goal ring (violet-to-gold gradient stroke on a circular progress track) and the pill-shaped buttons with the app's signature full-round corners

## Share copy (draft)
Stopped highlighting. Started remembering. Reclipse turns your notes into flashcards built on active recall — try it free.

## Audio direction
- Role: warm, upbeat bed with light rhythmic accents on interactions
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (120 BPM, most energetic of the bundled tracks — fits `default` tone)
- Music treatment: start at 0s, volume ~0.35, fade in over first 0.4s, fade out over the last 0.6s of the outro
- Music cue guidance: preset read (`happy-beats-business-moves-vol-1...music-cues.json`). Target strong cues at 16.02s/17.02s/18.02s for the progress/celebration scene, and 20.02s/21.01s for the outro logo landing. Beat grid (~0.5s spacing) is available for the rating-button stagger in Scene 4 if useful, but do not force sequential text onto every beat.
- Audio-reactive treatment: subtle — let the ambient corona/glow behind Luna and the hero gradient breathe slightly with music RMS. No waveform/equalizer visuals.
- SFX posture: moderate (3-5 cues), matched to real interactions: a soft drop for the file landing, a card-flip sound for the flashcard flip, a click for the "Good" button press, a bright bell/chime for the streak/goal payoff, and a soft logo hit on the outro.
- Audio-coupled moments: file drop-in (Scene 3), card flip (Scene 4), button click (Scene 4), goal ring completion + streak tick (Scene 5), logo landing (Scene 6).
- Restraint rule: never let SFX or beat-sync push a readable line off screen before its floor time; music stays a bed, never louder than 0.4.

## Storyboard

### Scene 1 — Hook — 3s
Full-bleed violet gradient background (matches the app's hero glow). Large white display type: "Rereading feels productive." holds ~1.3s, then swaps to "It mostly isn't." holds ~1.3s. No logo yet.
Sequential/interaction: yes — line 1 fades/slides out as line 2 slides in, fast cut (~0.2s).
Audio intent: quiet bed fades in under line 1; a soft, dry accent on the swap to line 2 to land the claim.
Audio-coupled idea: soft interface accent exactly on the line-swap cut.
Music: bed fading in, quiet.
Transition mood: hard cut → Scene 2

### Scene 2 — Reveal — 4s
Cuts to the app's real light background. The Reclipse logo mark (violet rounded square, white circular-arrow icon) and wordmark "Reclipse" pop in together. Headline "Study less. Remember more." settles (with "more." in the violet→gold gradient, exactly as on the real site), then the short real line "built on active recall." appears beneath it, smaller.
Sequential/interaction: none (single confident reveal, not a list).
Audio intent: warm, confident landing — brand identity established.
Audio-coupled idea: soft reveal impact under the logo pop-in.
Music: full bed, upbeat.
Transition mood: clean slide → Scene 3

### Scene 3 — Upload (key action 1) — 4s
Recreate the real `/upload` dropzone: dashed-border card, the three format chips "PDF" / "Text" / "Photo" arriving one by one, and the real label "Drop a file here, or click to browse." A cursor drags a file labeled "BI110_lecture6.pdf" into the zone; the dropzone flashes to its done state ("Loaded: BI110_lecture6.pdf"). Quick cut to Luna (thinking mood) with the real label "Building your study set."
Sequential/interaction: yes — 3 format chips arrive one by one (fast, ~0.15s apart, accenting only the first and last); then the simulated file-drag-and-drop.
Audio intent: tactile, satisfying — something real just happened.
Audio-coupled idea: soft drop sound exactly as the file lands in the dropzone.
Music: full bed, steady.
Transition mood: clean slide → Scene 4

### Scene 4 — Study: flip + rate (key action 2, centerpiece) — 5s
Recreate the real `/study` flashcard: a white card reading "What does the mitochondria produce?" flips (0.5–0.6s, matching the app's real 3D flip) to reveal the answer. The four real rating buttons rise in staggered underneath: Again (1m) / Hard (10m) / Good (1d) / Easy (4d). A cursor clicks "Good"; the button gives a small press response.
Sequential/interaction: yes — card flips, then all 4 rating buttons stagger in (~0.08s apart, this is fine as a fast accent-only beat, not readable text); then the simulated click.
Audio intent: this is the "aha, that's the product" beat — crisp and satisfying.
Audio-coupled idea: card-flip whoosh on the flip; a distinct click on the "Good" press.
Music: full bed, building.
Transition mood: soft → Scene 5

### Scene 5 — Progress payoff — 3s
The real goal ring (violet→gold gradient stroke) animates from empty to 78% as "15 / 20 cards" ticks up. Beside it the streak chip appears: "5 day streak" with a small flame icon. Luna (celebrate mood, sparkles) bounces in next to it, smiling.
Sequential/interaction: yes — ring fill animates continuously (not stepped text, so no reading-floor issue); streak chip and Luna arrive right after, held long enough to read the short label (~0.8s).
Audio intent: reward — this is the emotional peak.
Audio-coupled idea: bright chime/bell exactly as the ring completes its fill and Luna arrives; ring fill motion may breathe subtly with music RMS.
Music: strong cues in this window (16.02s/17.02s/18.02s) — align the ring-completion chime and Luna's arrival close to these.
Transition mood: soft → Scene 6

### Scene 6 — Outro / punchline — 3s
Cut back to the violet gradient background from Scene 1. Logo mark + "Reclipse" wordmark center, "Study less. Remember more." beneath it (brief reprise, short hold), then the real line "Free while in early access" settles smaller underneath. Luna peeks in from the corner, happy. Quiet fade to end.
Sequential/interaction: none.
Audio intent: warm landing, confident close.
Audio-coupled idea: one soft logo-hit sound on the wordmark's landing, aligned near a strong cue (~20.02s/21.01s); music fades out under the final hold.
Music: fades from full bed to silence over the scene.
Transition mood: soft fade → end

**Music mood for this video:** upbeat, clean, playful-but-earnest — matches `default` tone.
**Audio summary:** A warm upbeat bed carries the whole video at moderate volume, with tactile SFX tied to each real interaction (drop, flip, click) and a bright payoff chime at the progress/celebration beat timed near the track's strong cues, fading out under the final logo hold.
