# The Meta Layer — Observer, Phases, Goals, Finale

AbyssForge begins as a readable mining/survival descent and slowly turns into a
story about **a mine that notices who is playing it**. This document records the
design the README/PRODUCT only gesture at, and what is implemented.

## What the Observer is, and why

The abyss forge is a **broken rescue engine**: it was built to make anchors,
lamps, and drills for a collapse that never stopped spreading, and it is *still
trying to finish that work* long after everyone it was built to save is gone. It
has begun to notice the only hand that still moves the dark — **the player** —
and it mistakes that hand for the rescue it was built to wait for.

That single "attention" expresses itself as three faces:

- **The Watcher** — the attention given a body. A silhouette at the edge of your
  light that never attacks, retreats from fire and camps, leaves cold traces, and
  watches the wayfire anchors "to count which ones still answer." Driven by
  `shadowPressure` (deep + dark + unlit raises it).
- **The Observer moments** — the same attention leaking *through the screen* to
  address the real player: hero thoughts, mobs that freeze and stare back when
  the camera centres them, "wrong-shadow" notes written to you and not the miner,
  and frame-tears (spatial rifts). Escalating lines: `NOT ALONE → I HEAR YOU →
  KEEP ME HERE → YOU ARE SEEN`.
- **The Warden** — separate: a deep in-world **boss** guarding the forge. The
  Watcher observes; the Warden blocks. Defeating the Warden is a *lock*, not the
  end of the Watcher arc.

Tone: not horror-first — "survival work that slowly becomes wrong in ways the
player can test." Intentionally not front-loaded.

## Story phases (`js/lore.js` STORY_PHASES) — monotonic, only deepen

`contract → signal → witness → conspiracy → abyss → frame → truth`

Phase is **latched** (`lore.phaseIndex`, never regresses) so the escalation
(observer lines, event variants, enemies "looking back") only moves forward.

## The 8 long-term hidden goals (`HIDDEN_GOALS`)

`signal` (reach the first suspicious depth) · `vaults` (open secret caches) ·
`watcher` (3 Watcher sightings) · `wayfires` (claim 3 campfire anchors) · `kit`
(deep-survival kit: tier-5 pick, beacon lamp, recall, ward) · `bosses` (defeat 2)
· `frame` (trigger the 4th-wall anomalies) · `truth` (open the forge).

## The 4th-wall, made felt

Every Observer moment now drives `observerPulseUntil` into a **screen vignette**
that closes in (the frame reacting), with a distinct float + toast. Reduced-motion
dampens it and skips the shake.

## The finale (soft reveal + choice)

Five **forge locks** gate the truth: `deepest ≥ 220 m · secrets ≥ 5 · Watcher
sightings ≥ 3 · bosses ≥ 2 · pick level ≥ 6`. They surface as "Forge locks N/5"
in the mystery panel from the abyss phase on. When all five click,
`triggerForgeFinale` fires **once** (latched via `lore.truthRevealed`): a strong
"IT KNOWS YOU" beat, then the forge addresses the **player** directly with the
rescue-engine truth, then a choice:

- **Complete the rescue** → soft victory (logs the run, sets `lore.completedTruth`
  + a New Game+ flag); the wayfires answer and the forge can rest.
- **Keep mining** → dismiss and continue.

No hard game-over — it matches the open-expedition tone.

## Implemented vs remaining

Implemented: the whole phase ladder, 19 notes, 8 goals, Observer moments, the
Watcher entity, the monotonic latch, the felt vignette, the finale + choice, the
surfaced forge-locks, a unified `observerAttention` scalar both systems feed and
read (rises in the deep dark, decays at camp), and Watcher agency — it leans
toward the nearest wayfire it is "counting" and can leave a watcher-token when
you meet its gaze up close.

Remaining (optional): a full New Game+ that re-themes contracts/world from the
`lore.newGamePlus` flag (the flag is already set when you complete the rescue).
