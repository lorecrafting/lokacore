# Effects and sound plan (2026-10-31)

**Superseded 2026-10-31:** [book-ui.md](../system/book-ui.md#effects-sound-and-haptics) rules over this plan on the page swell (cut), the reduced-motion chapter blur (none) and the theme cut (Music, not Sound). The pickup pop is in: book-ui.md's owner exception (2026-10-31) rules it.

Planning document, nothing implemented. The owner asked for a thorough review of where effects and sounds go,
what they look like and why, at the quality of a polished mobile game, expressed as a book: ink, paper, type,
light and sound. This is the keeper; batches build from it. Playable samples of the entries where seeing
beats reading: [effects-samples.html](ui-exploration/effects-samples.html) (open in a browser at phone width,
toggle reduced motion at the top).

Sources read for this pass: `AGENTS.md`, `docs/system/book-ui.md`, `docs/BOOK-UI-COMPONENTS.md`,
`docs/design/README.md`, `interaction-patterns.md`, `polish-tour.md`, `room-view/room-view.html`,
`ui-exploration/chapter-one-playable.html` (the effects lab), the design-foundation and owner-rules records,
`docs/MECHANICS-TOOLBOX.md`, `docs/SHOWCASE.md`, `docs/lessons/mobile.md`, every file under `mobile/app/book/`
and `mobile/app/stories/`, every folder under `kernel/ts/src/mechanics/`, `protocol/event.schema.json` and
`protocol/gameview.schema.json`.

**Seen running vs read only.** Everything below is from reading. The owner's web preview (port 19006) and
Storybook (port 6006) were up, but no page was driven or screenshotted in this pass to keep machine load low;
the lab's effects were judged from its source, not run. The samples page was run in a phone-width browser: every
replay button with reduced motion off and on, no script errors, no sideways scroll; its sounds were not listened
to. Where a fact depends on seeing it run (frame cost of the curl on a device, the real colour of a glow on an
OLED), the entry says so.

## 1. Verdict

The Book already has its spine: the Skia page curl with a reduced-motion cross-fade, the four palettes with a
1.5 s same-polarity cross-fade, the night sky with its meteor, the status icon countdown ring, and tokens for
every value. What it lacks is everything that makes a turn *felt*: there is no audio library, no haptics
library, no cue bus that tells the presenter "something happened" beyond a new line of prose, and no
feedback on a press. Ranked gaps:

1. **No event channel to the presenter.** The Book reads `GameView` and a `NarrationRecord` (lines plus one
   observed `cue` with a `source_event_id`, `protocol/gameview.schema.json#NarrationRecord`). The committed
   domain events (`item_acquired`, `attack_result`, `status_applied`…, `protocol/event.schema.json`) do not
   reach it as far as read (unknown whether the shell could pass them). Every effect below therefore names
   either a `GameView` diff it can key on today or the one new cue it needs (section 9).
2. **No press feedback.** No component under `mobile/app/book/` styles a pressed state: a source search finds
   no pressed style, ripple or `activeOpacity` (the only `pressed` state is the unavailable card's reason). On a
   phone this reads as unresponsive. P0, cheap, Reanimated only.
3. **No audio or haptics.** `mobile/app/package.json` has neither `expo-audio`, `expo-av` nor
   `expo-haptics`. The page-turn sound is spec'd (`tokens.ts:138`, `PageTurn.tsx:159`) and unplayed outside
   the mock.
4. **Three of the owner's chosen effects are unbuilt:** pickup pop, damage swell-and-red, chapter card blur
   (reserved). The running head is built (`pages.tsx:70 RunningHead`), but its swap is a cut, not a crossfade.
5. **No sense of place in sound.** Showcase has inn, shore, cave, mill, church, forge, crypt, vault; the
   derived sky gives weather, season, tide and solar phase (`CalendarStatus`). None is heard.
6. **No signature moments.** Launch, first blow, nightfall, death and waking, a quest closing, a vault
   opening: each is a prose line today.

Everything else (loading, errors, empty states, save) is already right by being still; the plan keeps it
still and says why.

## 2. Direction and principles

### The effects language

Five primitives, each with a vocabulary the catalogue reuses by name. Nothing outside them is proposed.

| Primitive | Vocabulary | Token source |
|---|---|---|
| **Ink** | *press* (a tapped word darkens toward `fg` then releases); *dry* (a new line enters at `dim` and settles to `fg`); *wash* (a tint over the page for a blow, `action` on light palettes and `danger` on dusk and dark, where `action` is amber, never more than `opacity.wash`); *settle* (a line that is finished fades to `dim`); *gilt* (a rare word briefly carries `warning`'s hue as a sheen, the lab's "Gilt words") | `color.*`, new `opacity.wash`, `motion.dry`, `motion.flash` |
| **Paper** | *lift* (a card rises 1 px with a `line`-coloured shadow); *curl* (the page turn, built); *riffle* (several curls compressed, for travel); *flutter* (the page edge lifts in wind, lab); *flick* (the pickup pop's motion: a short rise-and-settle under the log) | `motion.turn`, `motion.quick`, new `motion.pop`, `motion.riffle` |
| **Light** | *phase* (the palette cross-fade, built); *glow* (a warm radial at the page's hip when a lamp is lit, owner's choice, Beads x6t.7); *flicker* (candle, indoors at night, lab); *afterimage* (lightning: the page flashes to `bg` of the light palette and fades over 1.2 s, lab); *meteor* (built); *faint* (a slow breathing vignette at low HP, lab) | `color.*.bg`, new `motion.flicker`, `motion.afterimage`, `motion.breathe` |
| **Sound** | *paper* (turn, flick, riffle, damp pages); *tick* (a 10 ms transient for a selection); *flick* (the pickup, any item into the hand: one recorded paper flick, Q7; replaces the lab's `pluck()`); *coin* (one short clink: buy, sell, pennies); *tone* (one note: quest gained, low; skill improves, high); *note* (a two-note rise cut from the main theme's first interval: high for level, low for quest resolved and new skill learned); *theme cut* (an 8-15 s cut of the main theme, section 14, chapter card only); *bed* (ambience loops: wind, surf, hearth, drip, crowd); *weather* (rain, thunder); *mechanism* (latch, lever, dial) | `sound.*` (section 6) |
| **Haptic** | *selection* (iOS `selectionAsync`), *light*, *medium*, *heavy* impact, *warning*, *error* notification | `haptic.*` (section 7) |

### Severity scale

Every entry carries a severity; it decides stacking, loudness, haptic and what reduced motion keeps.

| S | Name | Budget | Example |
|---|---|---|---|
| S0 | silent | nothing; the prose is the effect | a status tick, an NPC leaving in the background |
| S1 | whisper | type only, ≤ `motion.dry` (240 ms), no sound of its own beyond the page turn, no haptic | a new log line drying; a refused line |
| S2 | note | one ink or paper change ≤ 300 ms, a tick, coin, flick or tone, at whisper to note loudness, at most one haptic of the weight its entry names | a press; a pickup; a coin counted; a status icon arriving |
| S3 | beat | page-level change ≤ 500 ms, one sound at note loudness, light or medium haptic | a blow taken; a quest resolved; a lever thrown; lightning |
| S4 | chapter | the whole page (blur, card), the theme cut, medium haptic; turns itself after about 4 s | the chapter card; death and waking |

### Timing and easing tokens

`motion` today: quick 160 ease, turn 500 inOutQuad, fade 160 linear, palette 1500 inOutQuad, meteor 700
linear (`mobile/app/book/tokens.ts:128`). Proposed additions, all plain state changes in the token file's sense,
each with its first consumer:

| Token | Value | First consumer |
|---|---|---|
| `motion.press` | 90 ms in, 160 ms out, `ease` | ActionCard, Control, Chip, Tap, letter tiles |
| `motion.dry` | 240 ms, `linear` | LogLines new line; EntityLine arriving; speech line |
| `motion.pop` | 220 ms, `ease` (rise 6 px and settle), hold 1800 ms, 400 ms `linear` out | pickup "+ item" |
| `motion.flash` | 120 ms in, 380 ms out, `inOutQuad` | damage wash; afterimage uses 60 in / 1200 out |
| `motion.settle` | 400 ms, `inOutQuad` | a foe band to `dim`; a running head retiring |
| `motion.card` | 600 ms, `inOutQuad` | chapter card blur-in; 300 ms out |
| `motion.riffle` | 5 curls at 120 ms, `linear` | travel |
| `motion.breathe` | 2400 ms loop, `inOutQuad` | low-HP faint; catching-up text |
| `motion.flicker` | 80-140 ms random steps, `linear` | candle |

Easing names come from `easing.ts` (`ease`, `inOutQuad`, `linear`); an unknown name throws there already, which
is the check for these.

### Stacking, queue and interrupt

- At most one S4 on screen; it interrupts everything and clears the queue.
- S3: one playing, one pending; a third of the same key replaces the pending one (a flurry of blows never
  peaks the wash twice within `motion.flash.gap`, 1 s; later blows keep all but the wash).
- S2: coalesced by key within 300 ms (two pickups in one command are one pop reading "+ sack, + rope";
  two coins counted are one clink).
- S1: free; they are type transitions on their own lines.
- A page turn cancels every in-page effect on the leaving page (its snapshot is already an image,
  `PageTurn.tsx useLeaving`) and the arriving page's effects start after the turn's picture deadline.
- Sound follows the same queue; voices in section 6.
- Fast repeated actions (Chop wood x5): the log's quiet-line merge ("(N times)", `logs.ts`) already removes the
  lines; the effect fires once for the first and not for merges.

### Non-blocking in a long read

The Book is read for minutes at a time. Nothing waits for an effect except the chapter card (already a page that
turns itself, book-ui.md Chapters) and death (a sequence of pages). No effect delays the next tap, moves text
the eye is on, or scrolls. Ink dries in place; pops appear under the log, not in it; washes are below the ink
(the page's background layer), so prose never changes colour.

### What stays silent, and why

- **Senses** (G6 cues): the rule is "the sense is in the words, never an icon or colour"
  (book-ui.md Mechanic renderings). No visual. A sound bed may respond to the room, not to a cue line.
- **Status ticks and expiry, item statuses** (owner rule: silent); the countdown ring is the whole story.
- **NPC background life**: schedules, population births, patrol moves, crow flights out of sight. A wage paid in the player's pennies is the coin cue, as any change to them is.
  The prose says "Nell leaves."; an effect would make the world feel like it is performing for the player.
- **Facts, knowledge, reputation, disposition, rumour, fear, scars**: narrated or not by content; no cue.
- **Save**: confirmed saves are silent; "save not confirmed" is a Note (StatusLine pending state). A save
  sound would teach the player to fear the other case.
- **Loading, errors, empty states**: stillness is the message (section 4.11).
- **Say/Shout, Where, Close/Lock**: verbs the Book does not draw stay undrawn.

## 3. Catalogue by mechanic

Fields: trigger (what the Book can key on today, with the path), placement, look, sound, haptic, why,
priority (P0 ship first, P1 next, P2 later), cost and build method, cue needed (none, `view-diff` = derivable
from a `GameView` change, or `new` = needs the event channel in section 9). Loudness tiers in section 6.

### 3.1 Movement (`kernel/ts/src/mechanics/movement/`)

| | |
|---|---|
| Trigger | `place.id` changes after a step (`GameView.place`); the page turn already fires (`PageTurn.tsx:159`) |
| Placement | the whole page |
| Look | the built curl (`motion.turn`, `page-curl.sksl`); cross-fade under reduced motion (built) |
| Sound | *paper* turn, recorded CC0 (<1 s), 3 variants round-robin, tier note; the spec'd hook in `PageTurn.tsx useLeaving`. Footsteps (lab "steps"): **not proposed**; the curl is the step |
| Haptic | none (the curl is enough; a haptic on every move would wear) |
| Why | the owner's base look; the one effect every turn has |
| Priority | P0 (sound only; motion built) |
| Cost | S, plain: play one sample on the existing hook |
| Cue | none |

**Barred exit** (`Footer` barred-exit story; `refused` line in `logs.ts`): S1, the Footer direction's label
dims via `motion.press` out only; no sound; haptic *warning* once (section 7). Refusal is felt, not heard.
Cue: none (the refused line exists).

**Hidden exit found / door unlocked** (`barrier_changed`; `exits` diff): S2, the new exit's Footer label dries
in (`motion.dry`); sound *mechanism* latch (one 150 ms CC0 sample) only when the player unlocked it
(`action_completed` on Unlock), else silent. P1, S, Reanimated. Cue: view-diff for appearance; `new` to
distinguish the player's unlock from a schedule's.

### 3.2 Containment, equipment, light (`containment/`, `equipment/`, `light/`)

**Pickup** (owner's choice): trigger `inventory` gains an id (view-diff) or `item_acquired` with
`holder_id` = actor (new). Placement: a one-line *flick* directly under the log's last line, `type.small`,
`color.action`, text `+ sack` (the item's displayed name, from `EntityView`, never a presenter literal).
Look: rises 6 px from `dim` to `action` over `motion.pop`, holds 1.8 s, fades. Two in one command: one line
`+ sack, + rope`. Sound: *flick*, a recorded paper flick (Q7 decided: dry, not the lab's pluck), tier note, 3 variants ±4 %; the
same flick serves any item gained, while a buy plays the coin instead, so the log has one sound for "into the hand" ([listening
list](audio-listening-list.md#sound-one-family-for-the-log)). Haptic *light*. Why: the one reward the owner picked; it must feel
like something came into the hand, and a paper flick is the book's own sound for it. P0. Cost S,
Reanimated (one `Animated.Text` under `LogLines`). Cue: view-diff is enough for v1.

**Drop / give / put in**: S0. The line says it; the pocket emptying needs no pop.

**Wield / Apply / Wear** (`equipment/`): S2, the Held or Worn line in Carrying *lifts* once (`motion.press`
out). No sound. P2. Cue: view-diff on `equipment`.

**Container opened, harvest, replenish**: S0.

**Lamp lit** (`light/decide`, `FuelView.lit`): trigger a held or room light's `lit` flips true (view-diff).
Placement: a radial *glow* at the page's hip (the lower outer corner, owner's choice, x6t.7 known),
`color.dark.action` at `opacity.glow` fading to transparent over 40 % of the page width, only on `dusk`
and `dark` palettes. Look: fades in over `motion.palette`; *flicker* indoors (lab "candle"): the glow's opacity
steps ±8 % every 80-140 ms, none under reduced motion. Sound: none on ignite (a match strike would be a
sample for a one-frame event; P2 if the owner wants it). Haptic none. Why: the owner's chosen light in 2026-09; the design README lists lamp glow as not adopted, so it needs its own owner decision before Phase 2. P1.
Cost M, Skia (a `RadialGradient` in the page's background layer, Reanimated-driven opacity; must be measured on
the iPhone 11 before shipping with flicker on). Cue: view-diff.

**Lamp out / fuel gone**: the glow *settles* out over `motion.settle`; the room's dark-room prose does the rest.
S1.

### 3.3 Combat, bleed, death (`combat/`, `bleed/`, `death/`)

**Encounter opens** (`combat` appears; the Combat page auto-opens, book-ui.md Combat): the curl, plus a
*paper* turn variant at tier beat (the same sample, +3 dB); haptic *medium*. S3. P0. Cue: view-diff.

**Blow taken** (owner's choice: swell-and-red): trigger `resources` hp falls while `combat` is present
(view-diff), or `attack_result` with `target_id` = actor and `hit` (new; also gives `loss`). Placement: the
page background and the status line's hp item. Look: *wash* (Q9: oxblood `action` on light palettes, `danger` on dusk and dark) at `opacity.wash`
(0.18) with a scale *swell* of the page content to 1.015 and back over `motion.flash` (120 in, 380 out); the hp
value dries red then back to `fg`. Under reduced motion: no swell, wash at half opacity for the same time; with
Flashes off (section 8): no wash, the hp value alone. Sound: a dull *paper* thud (a closed book dropped on
cloth, CC0, 200 ms), tier beat; variants 3. Haptic *heavy*. Why: damage must land in the body before the eye
reads the number; this is the one place the page may go red. P0. Cost M, Reanimated for the swell and wash
(no Skia). Cue: view-diff works; `new` gives `loss` for scaling the wash (bigger loss, fuller wash, capped).

**Critical hit taken** (G2 crit): same as above with the wash at `opacity.washHard` (0.28) and the swell to
1.03. Needs `new` (crit is in the narration words only; unknown whether `attack_result` marks it: not in its
fields). P1.

**Blow dealt**: S2, the opponent block's band phrase ("the raider — hurt", `Combat.tsx`) *presses* once
when the band changes; no sound (the paper thud is reserved for the player's body); haptic none. Why: the foe's
state is read, the player's is felt. P1. Cue: view-diff on `combat.band`.

**Miss / prevented** (`attack_result.prevented_by`): S1, the line dries. P2.

**Foe falls** (`combat` ends with the opponent dead; `entity_died` new): S3, the band phrase *settles* to
`dim` over `motion.settle`, then the page keeps the names only and the "Back to World" Control dries in. Sound:
one *paper* close (the book shut softly, 300 ms), tier note. Haptic *light*. Why: the closure page already
exists (book-ui.md Combat closure); the settle makes it read as an ending, not a glitch. P1. Cost S. Cue:
view-diff.

**Bleeding** (`bleeding` present): S1, the status line's hp label carries `danger` at full `fg` strength (built as
a band? unknown; the Combat bleeding story exists). Per tick (`status_ticked`): silent, by owner rule. The
bandage action is the effect. P2 to add a slow `motion.breathe` of the label's colour between `danger` and `fg`
while bleeding, none under reduced motion. Cue: view-diff.

**Low HP** (hp in the danger band, `band()` in `pages.tsx:20`): the lab's "faint": a vignette of
`color.<palette>.fg` at `opacity.faint` (0.10) breathing at `motion.breathe` from the page's edges, no sound,
no haptic; none under reduced motion (a steady vignette instead). Why: the number is small type; the player
should feel the page dim before they read it. P2. Cost S, Reanimated gradient or Skia `RadialGradient`
(choose on measurement). Cue: view-diff.

**Death** (`entity_died` of the actor; today the Book shows "You fall." then "You wake at the inn.",
x6t.26): S4 sequence, section 5.

**Ranged** (row 17), **spells doing damage** (29b), **traps** (row 12): the same blow-taken and blow-dealt
entries; a trap adds the *mechanism* snap sound (120 ms). Cue: view-diff for the hp fall; `new` to know it was
a trap (today only the prose knows).

### 3.4 Status and conditions (`status/`, SR1-SR9, W8, G13, W21, W25)

**Status applied to the player** (`conditions` gains an entry; `status_applied` new): S2, the StatusIcon
pops in: scale 0.6 → 1 over `motion.pop`'s 220 ms, the ring full (`StatusIcon.tsx`); sound *tick*
(tier whisper) only when the status is a debuff (`kind`); haptic *selection*. Why: the icon row is graphic-only
by owner rule, so arrival needs a motion the eye catches or the player never learns the icon. P0 (motion), sound
P1. Cost S, Reanimated. Cue: view-diff.

**Status expired**: the icon fades over `motion.fade` (160 ms linear). Silent. P0 with the above.

**Status ticked**: S0 (owner rule). The ring already drains (`drainMs`).

**Status on an NPC** (G3): S0 unless `narration.observed` narrates it (owner rule); the line is enough.

**Permanent status / scar** (W8): no ring (built); no arrival pop (it arrives with death or a scene, which
have their own effect).

**Exposure** (W25 cold/hot/damp/windy/dry): the status icon as above; the weather bed in section 6 carries the
feeling. No page tint for cold (frost creep is archived).

### 3.5 Levelling, skills, attributes (`levelling/`, `skills.ts`, `skill_level.ts`, `attribute/`)

**Level up** (`levelling.level` rises, view-diff; no protocol event exists for it: `new` would be
`fact_changed` or a level event): the owner reserved the card for story-arc markers, so a level is not a card.
S3: the narrated line in the log dries with *gilt* (the words carry `warning`'s hue for 600 ms then settle to
`fg`); sound *note* high (two rising tones from the main theme's first interval, 180 ms apart, tier note); haptic *medium*. On the Character page the
"Level 2, 1 point to spend" line (book-ui.md Levelling) carries *gilt* while points are unspent (steady, not
animated). Why: a level is the game's one "you grew" moment; the status line adds nothing by rule, so the log
line and the Character page carry it. P0. Cost S, Reanimated colour. **Owner question Q1.**

**Raise** (spending a point): S2, the attribute value dries. No sound. P2.

**Skill check passed / failed** (`check_passed`/`check_failed` new; today the prose): S1 either way; a passed
check's line dries, a failed one is already italic (refused form). No sound: a tick on every check would make
dice audible in a book. Cue: `new` if ever wanted; recommend never.

**Skill improves** (G5 growth; prose "Blade improves"): S2, *gilt* on that line; sound *tone* high (one tone, the level's first, tier whisper), at most once per 30 s so grinding does not nag (tune by ear); no haptic. Why: the owner wants growth heard (2026-10-31, reversing "silent"). P0. Cue:
view-diff on `skills`.

**New skill learned** (`skills` gains an entry): S2, the line *gilt*; sound *note* low (the quest's two tones);
haptic *light*. Why: a new page in the character, kin to a quest closing and smaller than a level. P0. Cue:
view-diff on `skills`.

### 3.6 Quests, story points, scenes, chapters (`quest/`, `scene/`, `dialogue/`)

**Quest activated** (`journal` gains a quest with state active; `quest_activated` new): S2, the running head
(`pages.tsx:70`) cross-fades from the old objective to the new over `motion.dry` (today a cut). Sound: *tone* low (one tone, the quest's first; the resolve answers it with two), tier note, P0 (owner, 2026-10-31);
haptic none. Why: the owner chose the running head as the tracker; a cut makes it easy to miss, a fade makes it
"the book turned to this". P0. Cost S, Reanimated opacity. Cue: view-diff.

**Quest resolved** (`quest_resolved`, outcome success): S3, the running head *settles* (to `dim`, then out
over `motion.settle`) before the next objective dries in; the journal line gilt for 600 ms; sound *note*
low (the level's two tones a fifth lower, shared with a new skill learned, so they are kin, not twins); haptic *light*. P0. Cue: view-diff.

**Quest failed / deadline passed** (`quest_failed`, W24): S2, the running head fades to `dim` then out, no
gilt, no note; a single low *paper* close. Haptic *warning*. P0. Cue: view-diff on `journal` state.

**Hint changes** (W23, `QuestView.hint`): S0.

**Story point reached** (`story_point_reached`): by itself S0; a chapter index change is what the Book draws.

**Chapter card** (`chapter.index` rises; book-ui.md Chapters; `ChapterPage`): S4, the owner's choice: the page
behind blurs (Skia `Blur` over the leaving page's snapshot image, the one `PageTurn` already takes, sigma 6 →
12 over `motion.card`), the card's label, title and short rule dry in staggered by 120 ms; sound: the chapter cut of the main theme (section 14, 8-15 s, tier chapter); haptic *medium*. Reserved for story-arc markers, never a level.
The card turns the page itself after `motion.card.auto` (about 4 s from appearing); a tap anywhere skips; the
clock pauses while the app is in the background. With a screen reader active it keeps an explicit Continue and
does not turn itself. The cut plays into the next page and fades there. Presentation only.
Under reduced motion: no blur ramp (a fixed blur), no stagger; the cut stays (sound is not motion; Sound off
silences it). P0. Cost M, Skia on the existing snapshot (the only blur in the Book; never a live view blur on
Android). Cue: view-diff.

**Modal scene** (`scene` present; ScenePage): S1, each line dries. The scene's own content may call for
more; see Q4.

**Dream** (`DreamPage`, bed anchor): the page's `bg` shifts one step toward the dusk palette's `bg` for the
dream's duration (a *wash* at `opacity.wash` of `color.dusk.bg`), cut back on waking; no sound; none under
reduced motion. Why: a dream should read as a different paper without a different page. P2. Cue: view-diff.

**Dialogue** (`dialogue/`, `speech/`, `topics/`): a speech line dries like any line (S1); the speaker's
small-caps name does not animate. Choice offered (`choice` present; `PickLists` open): the chips lift in
staggered 40 ms (S2, P1). Choice resolved: the chosen chip presses, the others fade (`Chip` chosen state).
No sound in conversation; a book does not click when people talk.

### 3.7 Commerce, services, escort (`commerce/`, `service/`, `escort/`, W11)

**Pennies change** (`resources` pennies diff): S2, the status line value dries; sound *coin*, one short recorded clink (one sample, under 300 ms), tier whisper, for coins in or out (owner, 2026-10-31); haptic *selection*. P1. Cue: view-diff.

**Buy / sell on the shop page** (`Shelf.tsx`): the bought line *lifts* then leaves (`motion.settle`); the
pickup pop fires as in 3.2 for a buy, but the coin plays instead of the flick, so one purchase is one sound. A sale is the coin alone. Coin P0, the rest P1.

**Service received** (sleep at the inn, a meal): S0 beyond the rest or eat entry.

**Wage paid** (escort): the coin cue when the player's pennies change (the pennies entry); S0 otherwise.

### 3.8 Food, liquid, water, rest, dreams (`food/`, `liquid/`, `water/`, `rested`)

**Eat / drink / fill / pour**: S0. The line is the act; a gulp sample is the cartoon the owner ruled out.

**Rest** (`rested`): S1. The palette keeps following in-game time (owner rules: no override, and rest does not
jump the clock), so rest is the page turn and its line, with no palette effect. Sound: the paper turn only;
haptic none. P1. Cue: none.

**Hunger / thirst statuses** (G13): the status entry.

### 3.9 Calendar, sky, weather (`calendar.ts`, row 31, W25, `CalendarStatus`)

**Solar phase change** (`time.solar`): built (`motion.palette`). Keep.

**Night sky** (`NightSky.tsx`): built stars and meteor. P2: a slow twinkle (each star's opacity breathing at
`motion.breathe` with a random phase, none under reduced motion). Cost S, RN Animated as the meteor.

**Weather change** (`time.weather` diff): the sound bed cross-fades (section 6). Visual per weather:
*rain*: none on the page (water light and ink run are archived); *wind*: the lab's page *flutter* (the page's
top outer corner lifts 2-3 px and settles, twice, 600 ms total) once on the change and once per room entry
while windy, outdoors only; *storm*: lightning *afterimage* (the page flashes to `color.light.bg` over 60 ms
and fades over 1200 ms) at random 20-60 s intervals outdoors, with *thunder* 1-3 s later (CC0, 3-5 s, tier
beat) and haptic *heavy* once; *fog, snow*: bed only. None of the visuals under reduced motion (the bed stays).
Why: weather is derived by the kernel and read by the status line; hearing it makes the derived sky real. P1
(bed), P2 (flutter, lightning). Cost M. Cue: view-diff; **needs "is this room exposed" from the view** (the
kernel knows: no ignite in an exposed room in wet weather, row 31; `GameView` does not carry it today).

**Season, tide** (`time.season`, `time.tide`): S0 on the page; the shore bed follows tide (section 6).

### 3.10 Knowledge, map, transport, expedition, patrol (`knowledge/`, `transport/`, `expedition/`, `patrol/`)

**New room discovered on the map** (`map` gains a room; `DiscoveredMap.tsx`, `MapDrawing.tsx`): S2, the lab's
"ink map": the new dot and its connection draw on (Skia path trim 0 → 1 over `motion.settle`), the title dries.
No sound. Under reduced motion: appears. Why: the map is the player's own drawing; a line appearing as drawn
says so. P1. Cost M, Skia (the map is already Skia? unknown; if RN views, Reanimated width).

**Travel** (transport, expedition, patrol: `transport/`, `expedition/travel`): S3, the lab's *riffle*: five
compressed curls (`motion.riffle`) with the paper riffle sample (one 600 ms CC0 flip of pages), haptic *light*
at the end, then the arrival page's normal entry. Under reduced motion: one cross-fade. Why: a journey is many
pages. P2. Cost M (a loop of the existing curl with shorter duration and no snapshot per step: one snapshot,
five progress sweeps). Cue: `new` (today a travel is a `place.id` change like any step; the Book cannot tell).

**Expedition / patrol fail** (`expedition/fail`, `patrol/fail`): the quest-failed entry.

### 3.11 Puzzles, locks, traps, readables, notices (row 26, 13, 12, `readable/`, `notices.tsx`)

**Lever thrown / dial turned** (`action_completed` on the lever; today `fact_changed` prose): S3, sound
*mechanism*: a lever is one 250 ms wooden clunk, a dial one *tick* per step; haptic *medium* (lever) or
*selection* (dial). No page motion (the lever is in the prose, not drawn). P1. Cue: `new` (which action
completed); interim: key on the action's label (a presenter literal; refuse).

**Lock picked / forced** (row 13): the latch sample; haptic *light*; a failed pick is S1.

**Trap sprung**: 3.3.

**Notice read, book read**: S0; reading is reading.

**Riddle** (`Riddle.tsx`, letter tiles): tile press *lift* + *tick* (S2); a correct answer: the answer word
*gilt* for 600 ms + *note*; wrong: the tiles return over `motion.settle`, silent. P1. Cue: none (presenter
state).

### 3.12 Population, crow, bell, schedule, emote, position, disposition, reaction, patrol

**NPC enters the room while the player is there** (`entities` gains; `entity_entered_room`): S1, the entity
line dries in. **NPC leaves**: the line fades (`motion.fade`). No sound. P1 (one mechanism with new log
lines). Cue: view-diff.

**Bell** (`bell/bellCue`): the one mechanic with an authored cue already: when the bell cue reaches the room,
a CC0 church bell sample (tier note, ducked under nothing) plays once with the cue line. P1. Cue: `cues` entry
with that sense and source; unknown whether `CueView` names the bell: verify, else `new`.

**Crow shooed, item carried off** (`shooed`): S0 beyond the prose; the crow is a character, not a sound.

**Emote, position (sit/stand/lie), disposition, reaction, schedule, patrol**: S0.

### 3.13 Spells, identify, curses, durability, fire (29a/b, 27, 28, 21, W22)

**Cast** (a spell word chosen from the Character page's Spells section or the "Cast a spell…" pick list): S3,
the word's chip *presses* and the page *flicks* (the pickup's rise-and-settle applied to the whole page content,
3 px); sound *paper* flick at tier note; haptic *medium*. The spell's effect then fires its own entry (a blow,
a status, a light). Why: the owner rejected handwriting and ink run; the cast is the hand on the page. P2.
Cue: `new` (`action_completed` with the spell action).

**Identify / curse revealed** (27, 28): S2, the item's name *gilt* when its displayed variant changes (the lab's
"Gilt words: rarity"). P2. Cue: view-diff on the entity's `words`.

**Durability: item breaks** (21): S2, a *mechanism* snap (the trap's sample) + haptic *warning*. P2. Cue:
`new`.

**Fire** (W22 burning status on things): the room glow entry with a warmer tint (`color.<palette>.warning`
instead of `action`) while something burns in the room; the hearth bed. P2. Cue: view-diff on the room's
entities' statuses (unknown whether exposed).

## 4. Catalogue by Book screen and UI basics

Story ids from `docs/design/polish-tour.md`; components from `docs/BOOK-UI-COMPONENTS.md`.

### 4.1 Press feedback (every tappable) — P0

| Component | Press look | Sound | Haptic |
|---|---|---|---|
| `ActionCard` (`actions.tsx`) | paper *lift*: background `card` → `line` blend 30 %, translateY −1, over `motion.press`; release reverses | none | *selection* |
| `Control` (`pages.tsx:99`), `ContinueButton`, `PageFoot` returns | ink *press*: colour `action` → `fg` over `motion.press` | none | *selection* |
| `Chip` (`Chip.tsx`) | *lift* as a card; chosen state holds the pressed colour | none | *selection* |
| `Tap` (`pages.tsx:37`, section headings) | ink *press* | none | none |
| `EntityLine` name (`type.named`) | ink *press* | none | *selection* |
| Footer joystick direction (`Footer.tsx`) | the direction's label *presses*; the knob return is built | none | *selection* on commit |
| Letter tile (`Riddle.tsx`) | *lift* | *tick* | *selection* |
| Unavailable card pressed (`ActionCard` unavailable pressed state) | no lift; the reason line dries (S1) | none | *warning* |

Why no tap sound: in a text game a click on every tap becomes the loudest thing the player hears. The one
exception is the letter tile, where the player is handling pieces. Build: Reanimated `useAnimatedStyle` on
`Pressable` press state, one shared hook in `pages.tsx`; cost S for all rows. **Owner question Q2 (haptic on
every press).**

### 4.2 Page and sheet transitions

- Every page change: the curl (built) with its sound (3.1). Back and Leave curl the other way (`dir`).
- Combat auto-open: 3.3. Chapter: 3.6. Travel: 3.10.
- Menu (`Menu.tsx`) and section pages (Character, Journal, Carrying, Map, Settings): the same curl; no
  special sound. The chapter-to-settings story (`book-pageturn--chapter-to-settings`) is the reference.
- Tooltip (`StatusIcon` press-and-hold): built fade; add the *selection* haptic when it opens. P1.
- Minimap zoom (`Footer`): built; silent.

### 4.3 World page (`Body.tsx`, `pages-room--*`)

Holds only title, description, people, items, log (owner rule): the effects here are the log's (3.2 pickup
pop sits *under* the log, outside its lines), entity lines drying in and out (3.12), the hip glow and weather
(3.2, 3.9), the night sky (built). Nothing is added to the five parts.

### 4.4 Status line and icons (`Status.tsx`, `StatusIcon.tsx`)

Value changes dry (S1); band entry into warning or danger: the value dries in the band colour and stays
(built colour; add the dry). Icons: 3.4. The locked state ("another tab has the book", `--locked`): still,
silent (4.11).

### 4.5 Action cards, verbs, entity lines, pick lists

4.1 for presses; PickLists open: chips lift in staggered 40 ms (3.6); pending (`--pending`): the pressed
colour holds until the step commits, then releases: no spinner, the hold is the wait.

### 4.6 Logs (`lines.tsx LogLines`)

New narration line: *dry* (S1, P0, the cheapest effect with the widest reach: every turn). Narrated event
(`{event: true}`): dries with `type.italic` (built) and 60 ms later than narration so it reads as a
consequence. Refused: dries at `dim` and stays `dim`? No: refused lines are ink italic by rule; dry as any
line. Quiet "(N times)": no re-dry on merge. Away recap (`AwayRecap`): collapsed block dries once; opening it
is a `Tap` press. Thirty lines: only lines that entered this redraw animate (key on `narrationId`).

### 4.7 NPC page (`Npc.tsx`), item page, shelf

Speech lines dry (3.6); shop lines 3.7; "nothing to say" and closed conversation: still.

### 4.8 Combat page (`Combat.tsx`)

3.3 in full. The round log is a `LogLines`; the opponent block's band phrase presses on change; closure settles.

### 4.9 Sections: Character, Journal, Carrying, Map, Settings (`sections.tsx`, `journal.tsx`, `skills.tsx`, `DiscoveredMap.tsx`)

Character: level gilt (3.5). Journal: Day headings are `Tap`s (press); a resolved quest's line gilt
(3.6). Carrying: wield lift (3.2); empty Worn slot Note: still. Map: ink draw (3.10); the tapped dot presses.
Settings: chips (4.1); a reading-size change re-lays the page with a cross-fade (`motion.fade`): no reflow
animation (sleep reflow is archived).

### 4.10 Chapter, scene, dream, ancestry (`pages.tsx ChapterPage/ScenePage`, `DreamPage.tsx`, `AncestryPage`)

3.6. Ancestry (once-only choice): the chosen chip presses and the page curls; no card, no cut (the
chapter card has just played at launch).

### 4.11 Loading, errors, refused, empty, save, launch, settings

| Case | Effect | Why |
|---|---|---|
| Launch | the Chapter one card (3.6) once per session; before it, the app's first frame is the paper `bg` with nothing on it (no splash art, no logo motion) | the book opens; nothing precedes the page |
| First run (ancestry) | 4.10 | |
| Catching up (`pages-recovery--catching-up`) | the text breathes at `motion.breathe` between `dim` and `fg`; no spinner; silent | a book waiting, not a device working |
| Pending step (`PickLists` pending, `StatusLine` pending) | pressed colour held; "save not confirmed" Note is still | stillness says "not yet" |
| Save confirmed | nothing | silence is the good case |
| Save error (`SaveError.tsx`, four stories) | no motion, no sound; haptic *error* once on arrival | the only haptic the player must not miss |
| Fault (`lines.tsx Fault`) | as save error | |
| Refused action | 3.1 barred exit; 4.1 unavailable pressed | felt, not heard |
| Empty states (`Note`) | still | |
| Settings | 4.9; Sound and Haptics chips preview themselves once on change (the paper turn plays; the *selection* haptic fires) | the player hears what they chose |

### 4.12 Live region and screen readers

`Heard` (`lines.tsx`, outside `PageTurn`) is text only; no effect changes it (book-ui.md Announcements). Sound-only
information (bell, thunder, weather beds) is also a cue line or a status-line word by construction, so a deaf
player misses nothing: the bell has its cue line, weather is in the status line, the flick has its "+ item" text.

## 5. Signature moments

Beat by beat; each uses only catalogue entries.

1. **Opening the book** (launch): paper, nothing else, 300 ms. The Chapter one card dries in label → rule →
   title (120 ms stagger), the theme cut opens under it, haptic medium. After about 4 s, or at a tap, the curl
   turns to the ancestry page or the inn while the cut fades there. The first turn's paper sound is the first sound the player hears after the cut.
2. **First thing taken** (the sack at the inn or the lantern in the loft): the line reads "You take the sack.";
   under the log "+ sack" flicks up with the paper flick and a light haptic, holds, fades. No other item pops for the
   next 300 ms.
3. **First blow** (the boar at boar_run): the Combat page curls open a touch louder, medium haptic. The boar's
   line reads; on its hit the page swells 1.5 % and the oxblood wash rises and falls in half a second, the hp
   value dries red, the paper thud lands with a heavy haptic. The band phrase "the boar — hurt" presses when
   the player's blow lands. A flurry never peaks the wash twice within `motion.flash.gap` (1 s); later blows keep all but the wash.
4. **Nightfall at the inn**: the status line reads dusk; the palette crosses to dusk over 1.5 s, then to dark
   at night. Outdoors the stars come up (built) and a meteor streaks; indoors with the lamp lit the hip glow
   fades in and flickers. The inn bed (hearth and low voices) comes in under the wind bed, which fades.
5. **Storm at the fold**: the status line says storm; the wind bed rises, rain joins; the page flutters once;
   after a random wait the page flashes pale and fades over 1.2 s, thunder rolls two seconds later with one
   heavy haptic. Indoors the beds muffle (the lab's "muffle": a low-pass on the weather bed) and the lightning
   does not reach the page.
6. **Falling and waking**: the fatal blow's wash does not fade; it holds while the page settles to dark over
   `motion.card`; "You fall." dries alone; a beat; the curl to the inn lands on the palette of the current in-game hour (death does not jump the clock) and
   "You wake at the inn." dries. No theme cut: death is not a chapter. Haptic heavy then nothing.
7. **The letter delivered** (Reeve → Wat): Wat's speech dries; the running head "Deliver the Reeve's letter"
   settles out, the note rises, the journal line gilds; the new objective (if any) dries into the running head.
8. **Level two**: the log reads "Level 2."; the line gilds, the note rises a fifth higher than the quest's,
   medium haptic. On the Character page "1 point to spend" sits in gilt until spent.
9. **The lever vault opens**: the lever's clunk and medium haptic; the Footer's new direction dries in with the
   latch; the player turns the page and the vault's dark-room prose arrives with the cave bed (drip).
10. **Crossing to the shore steps by cart** (a paid transport, when authored): five riffled pages and the
    riffle sample, a light haptic at the end, the shore bed (surf by tide) up under the arrival page.

## 6. Sound plan

### Architecture

Three buses under a master: **ambience** (beds and weather, looping, ≤ 2 voices: one place bed, one weather
layer), **sfx** (one-shots from the catalogue, ≤ 4 voices, oldest stolen), **ui** (paper turn, ticks, flick;
≤ 2 voices), plus a **music** bus added by owner decision (section 14). (Q5.)

Ducking: an S3 or S4 sfx ducks ambience −6 dB over 300 ms and releases over 1200 ms. Nothing ducks the paper
turn. Loudness tiers relative to master: whisper −24 LUFS-ish, note −18, beat −14, chapter −12 (proposed;
calibrate on the iPhone 11 speaker and on earbuds; the numbers are targets, unknown until measured).

Variation: every one-shot ships 3 variants round-robin with ±4 % pitch; beds are ≥ 20 s loops with
cross-fade points, never two beds of the same family in a row.

Adaptive layers: place bed by a **bed tag on the room** (inn, village, shore, cave, forge, church, mill,
crypt, vault, wild), weather layer by `time.weather`, muffling (low-pass 800 Hz, −6 dB) when the room is not
exposed, tide for the shore bed (`time.tide`), hour for the village bed (day crowd vs night quiet by
`time.solar`). Cartridge owns the tags (a room property; engine owns nothing about sound): **new content
field**, Q3. Until it exists, one bed per world (wind) and no muffling.

### Library choice

| Option | For | Against |
|---|---|---|
| **`expo-audio`** (recommended) | Expo's current audio module (SDK 53+), works on iOS, Android and web through the same API, supports `setAudioModeAsync` for the silent switch and background, low-latency one-shots via preloaded players | newer; a looping bed with sample-accurate cross-fade must be done with two players; exact API surface on Expo 57 not verified here (unknown) |
| `expo-av` | the old known API | deprecated by Expo in favour of `expo-audio`; unknown whether it still installs cleanly on SDK 57 |
| `react-native-sound` | small, native | community-maintained, no web target (the Book's web preview and Storybook would need a shim), no Expo config plugin |

Nothing paid; all three are free. Decision: `expo-audio` once mobile resumes; until then (owner, 2026-10-31) the browser plays sound and native is a stub. One `AudioManager` module in `mobile/app/book/`
that owns the buses, preloads the ui set at launch and the sfx set lazily, and exposes `play(name)` keyed by
`sound` tokens. On web the module uses the browser directly; the samples page uses
WebAudio synthesis only as placeholders.

### Silent switch and background

iOS: respect the ring/silent switch (`playsInSilentMode: false`): a book should not play through a muted phone.
No background playback: the world keeps running when backgrounded (owner rule) but the beds stop; on
foreground they fade back in over 1 s. Audio interruptions (a call): stop beds, do not resume one-shots.
Android: the same via the audio focus the library requests (unknown granularity; verify).

### Sourcing and naming

CC0 or CC BY, human-made only (freesound.org filtered to CC0, Kenney's audio packs, OpenGameArt CC0, Scott Buckley's CC BY library); keep each sample's source URL
and author in `mobile/app/book/sounds/SOURCES.md` even when attribution is not required. Format: AAC in `.m4a`
at 44.1 kHz mono for one-shots, stereo for beds; total bundle ≤ 3 MB for v1 (about 12 one-shots × 3 variants
and 6 beds at 20 s). Names: `<bus>-<material>-<event>-<variant>.m4a`, e.g. `ui-paper-turn-01.m4a`,
`sfx-paper-thud-02.m4a`, `amb-wind-wild-01.m4a`, `amb-crowd-village-day-01.m4a`. Tokens: `sound.<key> =
{ file, tier, variants }` replaces today's `sound.pageTurn.volume`.

### Captions

Every sound-only fact already has its text (4.12). No separate caption layer.

## 7. Haptics plan

`expo-haptics` (free, Expo module) once mobile resumes; until then a stub, with the web analogue in Phase 0. Vocabulary and the only uses:

| Haptic | API | Used by |
|---|---|---|
| selection | `selectionAsync` | every press (4.1), dial tick, pennies |
| light | `impactAsync(Light)` | pickup, foe falls, quest resolved, travel end, latch |
| medium | `impactAsync(Medium)` | combat opens, chapter card, level up, lever, cast |
| heavy | `impactAsync(Heavy)` | blow taken, thunder, the fatal blow |
| warning | `notificationAsync(Warning)` | refused (barred exit, unavailable card), quest failed, item breaks |
| error | `notificationAsync(Error)` | save error and fault, once |

Rules: never more than one haptic per 100 ms (the wash queue enforces it); none during a page turn; a Haptics
chip in Settings, default on; always off when the device has none (the library no-ops). Haptics are not
motion: reduced motion leaves them on; the Haptics chip turns them off. Owner question Q2.

## 8. Accessibility

- **Reduced motion** (`useReducedMotion`, `fade.ts`): every entry names its reduced form; the rule is "the
  state change still shows, the travel does not": curls become cross-fades (built), pops appear, washes stay at
  half opacity without swell, flicker, breathe, flutter, meteor, lightning and riffle do not run, ink dries at
  `motion.fade`. `ReduceMotion.Never` on the fades the Book still wants, as `PageTurn.tsx` does.
- **Flashing**: at most one full-page luminance change per second and never three in any second (WCAG 2.3.1
  general flash threshold); the lightning interval floor (20 s) and the wash queue enforce it. A **Flashes**
  setting (off → no wash, no afterimage; the hp value and the prose alone) for photosensitive players,
  default on. Reduced motion does not imply Flashes off (different needs); Flashes off does not imply reduced
  motion.
- **Sound**: Sound chip (built as spec); the ring/silent switch respected; every sound-only fact is also text.
- **Colour-independent**: the wash is accompanied by the swell and the number; gilt words are also the words;
  the running head's change is also a text change; status icons have the tooltip and the Character page's
  conditions. Nothing is only a colour.
- **Screen reader**: effects never touch the live region; the pickup pop's text is `accessibilityElementsHidden`
  because the line "You take the sack." is already read.

## 9. Cue channel: what the kernel must add

The Book keys most entries on `GameView` diffs (view-diff above), which is enough for P0. Two things want a
real cue:

1. **Committed events on the narration record**: add `events: EventPayload[]` (the command's committed events,
   already in the trace as `CommittedEvent`) to `NarrationRecord`. One field, no new event type; gives
   `attack_result.loss`, `entity_died`, `action_completed.action` (lever, cast, unlock), `status_applied` vs
   `expired`, `quest_*`, `barrier_changed`. Everything marked `new` above resolves to this. Engine decision,
   not design; the PM should scope it.
2. **Cartridge content fields**: a room's sound bed tag (6) and `exposed` passed through to `GameView` (3.9).
   Cartridges own numbers and names; the engine passes them through; no presenter literal names a room.

Not needed: a crit flag (derive from `loss` against the pool's bands, or leave crit to the words), a
level-up event (`levelling.level` diff), weather events (`time.weather` diff).

## 10. Performance budgets (iPhone 11 reference; Pixel 3a as the floor)

- One Skia runtime effect at a time (the curl); the chapter blur runs on a snapshot image, never during a curl.
- Washes, swells, lifts, presses, dries: Reanimated shared values on the UI thread; no per-frame JS, no
  `setState` per frame; one `useAnimatedStyle` per animated element, elements ≤ 8 at once (a log that animates
  only its new lines).
- Flicker and breathe: one shared value driving ≤ 2 elements; off under reduced motion and when the app is not
  foreground.
- Target 60 fps during a turn with the paper sound playing; the picture deadline (`motion.quick`) already drops
  the curl for a slow page (loka-v2j). Measure the curl + glow + stars together at night outdoors with a lit
  lamp: the worst case; if it drops frames, the glow goes static (no flicker) on that device class.
- Audio: ≤ 6 decoded players alive (2 beds + 4 one-shots), ui set preloaded (~5 samples), the rest loaded on
  first use; ≤ 3 MB bundled; no decode on the JS thread (the library's job).
- Memory: the chapter blur's snapshot is disposed as the curl's is (two rAFs after).
- Low Power Mode: unknown whether Expo exposes it; if it does, treat as reduced motion for flicker, breathe,
  twinkle and lightning only.

## 11. Settings needed

Already spec'd: Sound on/off, reading size, start over. Add: **Haptics** on/off, **Flashes** on/off, both
chips in the existing Settings page row pattern (`pages-sections--settings`). Reduced motion follows the
system (no in-app override; one fewer thing to explain; Q6 if the owner disagrees). Each chip previews itself
on change (4.11).

## 12. Implementation plan

Owner policy: UI polish ships in batches, not per-item PRs (Beads only until a batch opens). Shared pieces
first; each phase shippable alone.

**Phase 0: foundations** (one developer slice, M)
- Tokens: `motion.*` additions, `opacity.wash/washHard/glow/faint`, `sound.*` keyed table, `haptic` table
  (designer writes `tokens.ts`; developer wires).
- Owner, 2026-10-31: no phone testing for now; web analogues, with native stubbed until mobile resumes (`loka-k5ci`). Sound plays through the browser; haptics use `navigator.vibrate` where supported, plus a dev-only pulse in preview and Storybook. The native side is a no-op, and `expo-audio` and `expo-haptics` are installed on resume.
- The asset manifest and its check (section 14, `loka-p2s8`).
- `AudioManager` with buses, preload, round-robin, ducking; `haptic()`
  gated by the Settings chip. Native is a no-op until mobile resumes; web plays sound for real.
- Cue bus: a `useCues(view, was)` hook in `mobile/app/book/` that diffs the two views and emits named cues
  (`pickup`, `hp_loss`, `status_in`, `status_out`, `quest_on/off/fail`, `level`, `place`, `weather`, `combat_open/close`, `pennies`) with the S-queue (coalesce, replace, interrupt). Pure function + one test per
  cue with a red control. Later the record's `events` (9.1) feed the same bus.
- Flashes and Haptics chips in Settings.
- A check: no `withTiming`/`Animated.timing` duration or easing literal outside `tokens.ts` (ast-grep, joins
  `mobile-book-*`); no `Haptics.*` or `play(` call outside the manager.

**Phase 1: P0 batch** (S-M)
press feedback (4.1), log dry (4.6), paper turn sample (3.1), pickup pop + flick (3.2), damage wash + thud +
haptic (3.3), status icon pop/fade (3.4), running head cross-fade (3.6), chapter card blur + theme cut (3.6),
save-error haptic (4.11), and, moved up by owner request, the coin clink (3.7) and all quest, level and skill tones (3.5, 3.6), whatever priority their entries give: the level and journal gilt, the running head settle and fade, their haptics, and the quest failed close. Depends on Phase 0. Design review once for the batch.

**Phase 2: P1 batch** (M)
place beds + weather layer + muffle (6; needs the room tag, Q3), hip glow + flicker (3.2), foe falls, blow
dealt press,
map ink draw (3.10), lever/latch (3.11, needs 9.1), riddle (3.11), entity lines in/out (3.12), bell (3.12),
choice chips stagger (3.6), tooltip haptic.

**Phase 3: P2 batch** (M)
low-HP faint, bleeding breathe, lightning + thunder, page flutter, star twinkle, travel riffle (needs 9.1),
cast flick, gilt on identify/skill, dream wash, wield lift, trap/durability snap, crit wash.

**Death sequence** (5.6): its own slice after Phase 1; touches the Book's page sequence, so it gets the normal
reviewer.

## 13. Open questions for the owner

| Q | Question | Recommendation |
|---|---|---|
| Q1 | Level up without a card: gilt line + two-note + medium haptic, Character page gilt while points are unspent. Enough? | Yes; keep the card for arcs as decided |
| Q2 | Haptic on every press (selection) or only on consequences (pickup, blow, chapter)? | Every press, default on, Haptics chip off for those who dislike it; it is what makes the paper feel touched |
| Q3 | Sound beds need a room tag in the cartridge (inn, shore, cave…). Approve the content field? | Yes; nine tags cover Showcase; authors can leave it blank (wind) |
| Q4 | Should scenes be able to call a named effect (a scene step "effect: lightning")? | Yes, reversed by owner request: see section 14 |
| Q5 | Music: none, or one quiet theme under the chapter card only? | Music, by owner request: see section 14 |
| Q6 | In-app reduced-motion override, or system only? | System only |
| Q7 | Pitch of the pluck: the lab's (reads cartoony per the owner) or a drier paper flick? | Dry flick; the samples page has both |
| Q8 | Lightning: should it ever reach an indoor page (through a window) or stay outdoors only? | Outdoors only; indoors the thunder is muffled |
| Q9 | The owner chose a red flash for damage, but the `danger` token is plum, so on the light page the wash reads mauve (seen in the samples). Use `action` oxblood, a new damage red, or accept plum? | Try `action` oxblood first: it is already in the palette and is the nearest to red |

**Owner decisions, 2026-10-31 (paraphrased).** The owner accepted the recommendations above for Q1, Q2, Q3,
Q6, Q7, Q8 and Q9, then asked for music, cutscenes and JRPG-style battle music. That reverses the recommendations
for Q4 (scenes may call named cues) and Q5 (there is music); section 14 holds the proposed design. Q2 ships on by default and is felt when mobile resumes. The formal record in `docs/decisions/` is written when a batch opens.

### Not covered

- The Realm (multiplayer) and SayField send/receive sounds: out of v1 scope.
- Retired Ashmere content and its rooms: not designed for.
- Voice: none. Any licensed sound: CC0 or CC BY only. Music: section 14; none of it is composed or sourced yet.
- Mechanics with no engine yet (hirelings, bank, trial/jail, mounts, settlement S1-S4, chapter carry-over,
  writing group): their effects fall into the same vocabulary when they exist; the appendix marks them.
- Measuring anything on a device (frame cost, loudness): all numbers are targets.
- The lab effects archived by the owner are not re-proposed, except where an entry flags it; this plan reuses from the lab: ink, candle flicker, lightning afterimage, meteors (built), page flutter, low-health faint,
  ink map, travel riffle, running head (built), pickup pop, damage flash, chapter card, gilt words, ambience,
  damp pages, muffle; drops footsteps, worn pages, ink drying as a page texture, things landing on the page,
  storm map, level-up card (folded into 3.5 without a card).

## 14. Music, battle music and cutscenes (proposed 2026-10-31, details open)

The rule: **music marks an occasion; the room beds carry the long read.** Nothing loops indefinitely under prose
the player is reading, except a fight. All music is original; FF7 is a reference for how the music is used, and
none of its melodies are to be imitated.

### Where music plays

| Moment | Music | Ends | Trigger | Cue |
|---|---|---|---|---|
| Title and opening | the main theme, cut down for the chapter card | fades into the first room's bed | launch | none |
| Chapter card | a short cut of the theme, 8-15 s | plays into the next page and fades there | `chapter.index` rises | view-diff |
| Exploration | sparse: one 1-3 min piece on first entry to a new area, then at least 5-10 min of beds only | plays out, never cut | area changes | cartridge area tag |
| Town or inn | a soft piece by time of day, same sparse rule | plays out | room tag | cartridge tag |
| Ordinary fight | battle track (below) | victory, flight or death | `combat` appears | view-diff |
| Story or boss fight | its own full battle theme | as above | the encounter names a track | new cartridge field |
| Cutscene | as the scene's author names | as the scene's author names | scene step | new cartridge field |
| Death | none: everything cuts on "You fall."; the current hour's bed returns on waking | | death sequence | as 5.6 |

### Battle music

1. **Stinger and turn.** The Combat page's curl lands on a 1-2 s hit that runs straight into the loop. The room bed
   ducks fully. This is the "FF7 moment", and its first bar must be recognisable by the third fight.
2. **Two tiers.** Ordinary fights get a lean loop (percussion, low strings, 60-90 s), because many will last only
   a few rounds and a big theme would wear out and feel oversized against a boar. Bosses and story fights get a
   full theme, so they feel like events. Fights too small to deserve either (the cartridge marks them) keep bed
   only.
3. **Round sounds on top.** Blow dealt, blow taken and miss each get a short impact sample under the music: blade,
   blunt and spell families, 3 variants each, on the sfx bus. This replaces "no sound" for a blow dealt in 3.3,
   while the paper thud remains the player's own hurt.
4. **Low-health layer.** Below the danger band, drop the melody and raise a heartbeat or low pulse. Preferred
   form is synced stems; if `expo-audio` cannot hold two players in sync (unverified), cross-fade to a tense
   variant at a bar line instead.
5. **Endings.** Victory: a 2-4 s fanfare of our own, a recurring motif the player learns to want, then the room
   bed over 1.5 s. Flight: music falls away with no fanfare. Death: hard cut, as above. A repeat fight within about
   a minute skips the stinger, so grinding does not grate.

### Cutscenes

The Book already has the right form: a modal scene shows one persisted line and a Continue, and takes precedence
over the rest of the Book (book-ui.md, Chapters, scenes and recovery). So a cutscene is **a directed scene, not a
video**: the player taps at reading pace, and it survives saves, reduced motion and screen readers, costs little to
author and suits the book. Video would be expensive, heavy, and off-style.

A scene line may optionally name, from a closed list:
- **music:** start, change or stop a track;
- **sound:** one sample (door, thunder, bell);
- **effect:** one catalogue effect (lightning, wash, palette shift, riffle);
- **plate:** a full-page engraving-style illustration, turned to like a page, which needs an art source (open).

Rules: tap to advance, never timed; no effect delays Continue; a tap during an effect jumps to its end state; a
returning player can skip a seen scene. Authors name cues; the engine and presenter own what they do. This needs a
schema field and a `docs/system` amendment first. It reverses Q4's original recommendation.

### Mix, settings and budget

- Separate **Music** and **Sound** settings, both default on.
- Music ducks beds −6 dB in exploration and fully in fights. S3 and S4 effects dip music −3 dB.
- If the player's own audio is already playing, Loka mixes with it and skips its music, keeping sound effects.
- Budget: about 1 MB per stereo minute at 128 kbps, so roughly 10-15 pieces is about 20-40 MB, replacing the 3 MB
  ceiling in section 6. Stream music rather than decoding it into memory (verify on `expo-audio`).
- Every musical fact is decorative; nothing is told by music alone.

### Sourcing: the biggest risk

A game's themes must sound like one composer, and mixed CC0 tracks rarely do. Nothing paid has been the rule so
far. Options: find one CC0 composer or pack with enough range (cheapest; may not reach the bar); commission a
small score of about 10 pieces (best; costs money, needs an owner decision); or use human-made placeholder tracks (the Scott Buckley list) now to
prove the system, and decide on the score before release. **Recommendation: placeholders now, decide before
release.**

**Provenance ([owner decision](../decisions/owner-decision-human-made-content-2026-10-31.md)).** Everything a
player hears is human-made, including placeholders: no generated audio and no AI-written score. Recheck store
rules before submission.

**Tracking placeholders.** One `mobile/app/book/sounds/manifest.json` replaces `SOURCES.md` from section 6, with
one row per bundled file:

```json
{ "file": "amb-wind-wild-01.m4a", "status": "placeholder", "used_for": "wild bed",
  "author": "...", "source_url": "...", "licence": "CC0", "credit": null,
  "human_made_evidence": "...", "replace_note": "needs a longer loop" }
```

`status` is `placeholder` or `final`. A check beside the other `bin/` checks, built in Phase 0, gives three results:
- **Every push:** fails if a bundled audio file has no row, a row has no file, or a required field is empty.
- **Report:** prints the placeholders still to replace, grouped by use.
- **Release:** fails while any row is a placeholder.

Shortlist to audition: [audio listening list](audio-listening-list.md) (the Scott Buckley catalogue by moment,
stinger, fanfare, log-line sound family, paper and combat sounds) and [placeholder audio candidates](placeholder-audio-candidates.md)
(other composers and sound packs). Art joins the same manifest when plates or icons arrive. CC-BY `credit` values feed the credits page.

### Build order

Music bus, Settings and fight tracks with the stinger and endings join Phase 2, since `combat` is already visible
to the Book. Impact samples need 9.1 to tell blow types apart, or start with one family. The boss-track field, area
tags, directed scenes and low-health layer form a later batch of their own.

## Appendix A: coverage by mechanic folder (`kernel/ts/src/mechanics/`)

| Folder / file | Entries | or no effect, because |
|---|---|---|
| alternates.ts | — | text variants, S0 |
| attribute/ | 3.5 Raise | |
| barrier/ | 3.1 hidden exit / unlocked | |
| bell/ | 3.12 bell | |
| bleed/ | 3.3 bleeding | |
| calendar.ts | 3.9 | |
| combat/ | 3.3 | |
| commerce/ | 3.7 | |
| containment/ | 3.2 pickup; drop S0 | |
| crow/ | — | 3.12: prose only |
| death/ | 5.6 death sequence | |
| delayed.ts | — | timing, S0 |
| description_variant/ | — | text, S0 |
| dialogue/ | 3.6 dialogue, choices | |
| disposition.ts | — | S0 |
| emote/ | — | S0 |
| equipment/ | 3.2 wield/wear | |
| escort/ | — | 3.7 wage S0 |
| expedition/ | 3.10 travel, fail | |
| fact_typed.ts, fact.ts | — | 3.11 lever keys on the action, not the fact |
| food/ | — | 3.8 S0 |
| knowledge/ | 3.10 map | |
| levelling/ | 3.5 | |
| light/ | 3.2 lamp lit / out | |
| line.ts | — | narration plumbing |
| liquid/ | — | 3.8 S0 |
| locks.ts | 3.11 lock picked | |
| lookups.ts | — | plumbing |
| movement/ | 3.1 | |
| patrol/ | 3.10 | |
| policy.ts | — | plumbing |
| population/ | 3.12 enters/leaves | |
| position/ | — | S0 |
| quest/ | 3.6 | |
| reaction.ts | — | its effects are the events above |
| readable/ | — | 3.11 S0 |
| resource.ts | 3.3 hp, 3.7 pennies | |
| scene/ | 3.6 scene, chapter, dream | |
| schedule/ | — | S0 |
| scripted_action/ | 3.11 lever/dial (via action_completed) | |
| senses.ts | — | "the sense is in the words"; beds only |
| service/ | — | 3.7 S0 |
| skill_level.ts, skills.ts | 3.5 checks, growth | |
| speech/ | 3.6 | |
| status/ | 3.4 | |
| topics/ | — | S0 |
| trail.ts | — | S0 (W13 tracks: prose) |
| transport/ | 3.10 travel | |
| water/ | — | 3.8 S0 |
| Not yet engine (toolbox rows 22-25, 33-36, 43-45, 47-48, S1-S4, R1) | — | no mechanic to cue; vocabulary applies when built |

## Appendix B: coverage by Book screen and component (`mobile/app/book/`, `mobile/app/SaveError.tsx`)

| Screen / component | Entries |
|---|---|
| World page (`Body.tsx`) | 4.3; 3.2 pop; 3.12 lines; 3.9 weather; NightSky |
| Title, RunningHead (`pages.tsx`) | 3.6 running head |
| Page, PageFoot, Control, ContinueButton, Tap, Note | 4.1 presses; 4.11 stillness |
| PageTurn (`PageTurn.tsx`) | 3.1 sound; 3.6 chapter blur on its snapshot; 3.10 riffle |
| StatusLine, StatusIcon, Tooltip (`Status.tsx`, `StatusIcon.tsx`) | 4.4; 3.4 |
| ActionCard, VerbLine, Cards, PickLists (`actions.tsx`) | 4.1; 4.5 |
| EntityLine, Here, Heard, LogLines, AwayRecap, Fault (`lines.tsx`) | 4.6; 4.12; 4.11 |
| Chip (`Chip.tsx`) | 4.1; 3.6 choices |
| Combat (`Combat.tsx`) | 3.3 |
| Npc, Shelf (`Npc.tsx`, `Shelf.tsx`) | 4.7; 3.7 |
| Sections: Character, Journal, Carrying, Settings (`sections.tsx`, `journal.tsx`, `skills.tsx`) | 4.9; 3.5; 3.6; 11 |
| DiscoveredMap, MapDrawing | 3.10 |
| Chapter, Scene, Ancestry, Dream (`pages.tsx`, `DreamPage.tsx`) | 3.6; 4.10 |
| Riddle, letter tiles (`Riddle.tsx`) | 3.11 |
| Notices (`notices.tsx`) | S0 (3.11) |
| SayField (`SayField.tsx`) | not covered (Realm) |
| Footer, minimap, joystick (`Footer.tsx`) | 4.1; 3.1 barred / new exit |
| Menu (`Menu.tsx`) | 4.2 |
| NightSky (`NightSky.tsx`) | 3.9 twinkle (P2); meteor built |
| Text (`Text.tsx`) | the dry transition's host |
| SaveError (`SaveError.tsx`) | 4.11 |
| Book (`Book.tsx`) | the cue bus's home (12, Phase 0) |
