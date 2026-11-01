# Designer rulings: effects batch 2 (loka-xz76e)

Decided, one pass, for the build of G1 to G8. The epic's owner approval is the per-effect decision `docs/design/README.md` requires; it covers lamp glow and revives nothing else on the not-adopted list. Sources: `docs/design/effects-and-sound-plan.md`, `docs/system/book-ui.md`, `docs/BOOK-UI-COMPONENTS.md`, `docs/design/interaction-patterns.md`, `protocol/gameview.schema.json`, `mobile/app/book/cues.ts`, `mobile/app/book/tokens.ts`.

The designer writes `tokens.ts` values on request, or the developer pastes the table below under this approval. The spec paragraphs below are approved text for the developer to paste.

**As built, batch 2 C (designer sign-off on PR 558, 2026-11-01), where the text below differs and stays as history:** G2's miss sounds a whisper, read from the event (`book-ui.md`, Impact), not silence; G7's lever is the authored `lever` custom event and the latch a door verb or `action_completed`; `thunder` has no `haptic` field; `motion.bed.fade` is `motion.bed.duration`.

## Rulings that override the plan

Each was checked against `tokens.ts`. The plan's values break the 4.5:1 rule (`docs/BOOK-UI-COMPONENTS.md`, Motion and sound), whose only exemption was the blow wash.

| Plan said | Ruled | Why |
|---|---|---|
| 5.6: the page settles to dark while falling | Removed. The fatal wash holds at `opacity.faint`; the palette does not change | A light-to-dark settle is a polarity cross-fade, which the spec forbids |
| Fatal wash holds at wash strength | Holds at `opacity.faint` (.06) | .18 held drops `warning` to 3.8:1 past the half-second exemption |
| `opacity.faint` .10 | .06 | At .10, `warning` is 4.23:1 on `light` and on `dark`; at .06 the worst is 4.57:1 |
| `opacity.glow` unset | .08, flicker included | Worst is 4.66:1 on `dark`; .10 fails at 4.48:1 |
| Dream wash at `opacity.wash`; none under reduced motion | `opacity.faint`; shows under reduced motion | .18 fails on `light`; the shift is a state, and a state still shows |
| Afterimage flashes the page to `light.bg` | Under-ink overlay of `light.bg`, peak `opacity.afterimage` (.12) | A full flash crosses polarity and blanks light ink for over a second; a new bounded exemption is in the G7 paragraph |
| Twinkle per star, random phase | Two star groups in opposed phase, one shared value | Perf rule: one shared value driving at most two elements |
| Muffle every bed indoors | Only the weather layer muffles | A room's own bed is not heard through a wall |
| Layers stack freely | One held under-ink layer at a time: fatal hold, then vignette, then glow | Stacked, `warning` fails: glow + vignette 4.03:1 on `dark`, 4.14:1 on `dusk`; lowering values cannot fix it (glow .06 + vignette .06 is still 4.19:1) |

Contrast above is on `bg`. Cards and tiles are opaque above these layers.

**One held layer.** The highest of fatal hold, vignette, glow shows; a lower one fades out over `motion.settle` and returns the same way when the higher ends. Consequence the owner may notice: at the danger band the lamp's glow is gone. A dream page has no vignette, so dream tint never stacks. The blow wash stays above the held layer for its half second, under its existing exemption. Lightning cuts the held layer for its strike, which returns over `motion.settle`, so its exemption numbers below are true.

## Facts each group needs

| Fact | Source | Used by |
|---|---|---|
| The player died | Committed `entity_died` with no `victim_definition` (the kernel's own test, `kernel/ts/src/mechanics/death/lines.ts:28`), passed by the authority with the receipt; never a view diff, a rendered line or a room name | G1, G2 |
| Fled, foe fell | View diff at `combat_close`: died (above) wins; else `place.id` changed = fled; else `opponent_id` no longer in `entities` = foe fell; else ended quietly | G2 |
| Blow dealt | `combat.band` changed or `combat.active_opponents` fell, same encounter | G2 |
| Lit | Any `fuel.lit` true on a row of the view that carries `fuel`, held or in the room | G3 |
| First of a playthrough | View-derived, see G3. No save field, no device key | G3 |
| Travel | The invocation sent has `command === 'expedition'` (`mobile/app/book/buttons.ts:265`) and the confirmed `place.id` changed | G4 |
| Exposed | New `place.exposed`, projected from the room's existing `exposed` tag (`kernel/ts/src/mechanics/light/shared.ts:30`) | G3 flicker, G6, G7 |
| Bed tag | New room field and `place.sound` (plan Q3, accepted by the owner) | G6 |
| Weather | `calendar_status.weather` phase, exactly `rain`, `wind` or `storm`; any other phase has no effect. Phases are authored: content must use these names | G6, G7 |
| Lever, latch | `action_completed` event (plan 9.1). No label-keyed interim | G7 |

## Proposed tokens

```ts
opacity: {
  faint: 0.06,      // a held under-ink layer: low-health vignette, dream paper, the fatal wash's hold; 4.5:1 holds
  glow: 0.08,       // the lamp at the page's hip, at its flicker's peak; 4.5:1 holds
  afterimage: 0.12, // lightning's peak, the exemption: BOOK-UI-COMPONENTS.md#design-tokens
}
motion: {
  breathe: { duration: 2400, easing: 'inOutQuad' },  // one way of the vignette and the star groups
  flicker: { min: 80, max: 140, depth: 0.08 },       // the lamp's random step (ms) and share of opacity.glow; the peak is opacity.glow
  stagger: { gap: 40 },                              // choice answers lifting in, with motion.press
  riffle: { sweeps: 5, duration: 120, easing: 'linear' }, // one travel's sweeps over one snapshot
  afterimage: { duration: 60, out: 1200, outEasing: 'linear', every: [20000, 60000], thunder: [1000, 3000] },
  flutter: { duration: 600, lift: space.xs, times: 2 },
  bed: { fade: 1000 },                               // bed to bed, and on returning to the foreground
  first: { hold: 1200 },                             // gilt's hold on a first of a playthrough (ordinary: motion.settle.hold)
}
sound: {
  impact: { tier: 'note', variants: 3 },             // a blow dealt, under the music; one family
  fightIn: { tier: 'chapter', variants: 1 },         // stinger, music bus
  fightLoop: { tier: 'chapter', variants: 1, gap: 60000 }, // gap: a fight this soon after the last skips the stinger
  fightWon: { tier: 'chapter', variants: 1, haptic: 'light' }, // fanfare, music bus
  riddleRight: { tier: 'note', variants: 1, haptic: 'light' }, // the note-low sample; no new file
  riffle: { tier: 'note', variants: 1, haptic: 'light' },
  bed: { tier: 'bed', variants: 1 },                 // ambience bus
  weather: { tier: 'bed', variants: 1 },             // ambience bus; G7
  explore: { tier: 'chapter', variants: 1, gap: 600000 }, // music bus; at most once per gap
  thunder: { tier: 'beat', variants: 3, haptic: 'heavy' },
  lever: { tier: 'beat', variants: 1, haptic: 'medium' },
  latch: { tier: 'note', variants: 1, haptic: 'light' },
}
mix: {
  tier: { bed: -30 },                                // uncalibrated, as the other tiers
  dip: { db: -3 },                                   // music under an S3 or S4, with mix.duck's times
  bedUnderMusic: { db: -6 },                         // beds under exploration music; in a fight they go silent
  bus: { ambience: 3 },                              // was 2: two beds in a cross-fade, plus the weather layer
  muffle: { hz: 800, db: -6 },                       // the weather layer when not place.exposed
}
```

No new colour. Glow uses `color.dark.action`; vignette the palette's `fg`; dream paper `color.dusk.bg`; afterimage `color.light.bg`. `motion.flash.gap` keeps the Flash limit for lightning too.

## G1 Death and waking

Trigger: the died fact. One new cue, `death`, S4: it clears the queue. Component: `Blow` (hold) and the existing Combat closure.

| State | Form |
|---|---|
| Fatal blow in combat | The blow's wash peaks as usual, then falls to `opacity.faint` instead of 0 and holds until the page turns. Thud plays with its heavy haptic, the only one: the `death` cue adds no haptic in a fight. Clearing the queue drops pending cues only, never the thud playing. Nothing after it |
| Closing lines | Dry as always; the existing Combat closure and Back to World stay. Nothing auto-turns |
| Death outside combat (bleed, drain) | No wash (Combat is the only place it appears). World page turns to the recovery room as `book-ui.md` Line placement says. Haptic heavy once; no thud unless the tick already plays one |
| Waking | Palette of the current `calendar_status.solar`, automatic. No chord or theme. Current room's bed fades in over `motion.bed.fade` when the room page shows |
| Music and beds | Cut at the died fact, 0 ms, no fade |
| Reduced motion | Wash peak at `opacity.washStill`, no swell, same hold |
| Flashes off | No peak; the hold fades in over `motion.settle` |
| A cold reopen after death | Silent, no cue (first view rule) |

Never hard-code a room: the recovery room is the cartridge's, and the wake line is `world.death.narration.woke`. Conflict: none; it adds no World page part.

**Spec, `book-ui.md`, Effects, after Blow wash:**

> **Falling.** The player's death is a committed fact from the receipt, never a view diff, a rendered line or a room name. It is one S4: pending cues clear, music and beds cut at once, and one heavy haptic is the last thing felt: in a fight the thud's own, which is never cut; outside one, the death cue's. In a fight the fatal blow's wash falls to `opacity.faint` and holds until the page turns (Flashes off: no peak, the hold fades in over `motion.settle`; reduced motion: the half wash, no swell, the same hold). A death outside a fight has no wash. Waking has no chord: the page lands on the palette of the current in-game hour, because death does not move the clock, and the current room's bed returns. No palette change marks the fall.

## G2 Fight flow

Music bus holds one voice. All music obeys the Music setting; impacts and the thud obey Sound.

| State | Trigger | Sound | Visual | Haptic |
|---|---|---|---|---|
| Fight opens | `combat_open` | `fightIn` into `fightLoop`; beds go silent over `mix.duck.duration`. Within `sound.fightLoop.gap` of the last fight: the loop alone | Existing curl | Medium (plan 3.3), after `curlEnds` or dropped |
| Reopened saved fight | First view with `combat` | Loop alone, on the first gesture, no stinger | None | None |
| Blow dealt | Blow dealt fact | `impact`, one family | Opponent band phrase presses once (`motion.press`), S2 | None |
| Blow dealt with no band change | Nothing in the view | Silent | None | None |
| Miss, dodge, block | Nothing in the view | Silent | Its line dries | None |
| Blow taken | Existing | Thud; dips music `mix.dip` | Existing wash | Heavy |
| Foe falls | Foe fell fact | Loop cuts over `motion.quick`, `fightWon`; room bed returns over `motion.palette` | Band settles to `dim` over `motion.settle`; Back to World dries in | Light |
| Fled | Fled fact | Loop fades over `motion.palette`; no fanfare; new room's bed fades in | Existing closure | None |
| Quiet end (a truce, a scene) | Else branch | Same as fled | Existing closure | None |
| Death | G1 | Hard cut | G1 | G1 |

**Ruled out for now:** blade, blunt and spell impact families and a miss sound. The view cannot tell them apart and a rendered line must not key them. They return with plan 9.1 events. Low-health music layer stays for a later batch. Detecting the player's own audio is out: the web cannot; the native stub stays.

Reduced motion: band press keeps its colour change, no travel; audio unchanged. Flashes: only the wash is touched, as today.

**Spec, `book-ui.md`, Effects, after Falling:**

> **Fight music.** A fight's opening plays a stinger into a lean loop on the music bus, and beds go silent; a fight within `sound.fightLoop.gap` of the last, or a reopened one, plays the loop alone. A foe falling cuts the loop into a short fanfare, then the room's bed returns. Flight or a quiet end lets the loop fall away with no fanfare. Death cuts it (Falling). A blow dealt presses the opponent's band phrase once and plays one impact under the music; a blow that moves no band, a miss, a dodge and a block add no sound, until events can tell them apart, and never from a rendered line.

**Spec, `book-ui.md`, Settings, replace the Music sentence:**

> Music governs every piece of music: the theme cut, fight music and exploration music. Sound governs every other sound, beds and weather included. Turning either off stops what it governs at once; turning Music on again during a fight starts the loop, nothing else.

## G3 Lamp, map, first times

**Lamp glow.** Trigger: lit fact true, shown palette `dusk` or `dark`. Component: new `LampGlow`, a Skia `RadialGradient` (no runtime effect) in the page's background layer, on World and Combat. Placement: lower outer corner, `color.dark.action` at `opacity.glow` to transparent over 40% of page width. In: `motion.palette`. Out: `motion.settle`. Flicker when `place.exposed` is false: random steps between `(1 - depth)` and 1 of `opacity.glow`, every `motion.flicker` ms. Until `place.exposed` lands (PR C), the glow is steady everywhere. Off in the background. Reduced motion: steady, still fades in by cut. Flashes: unaffected; it is far below a flash. No sound, no haptic. Night worst case: if frames drop, twinkle stops first, then flicker.

**Map ink.** Trigger: a room or link in `map.rooms`/`map.links` not yet shown on this Map since launch; the first opening after launch draws nothing, so a reload never replays the map. Component: `DiscoveredMap`/`MapDrawing`. New connection and dot trim 0 to 1 over `motion.settle`; all new ones together. New title dries. Silent, no haptic. Reduced motion: appears. Flashes: unaffected.

**First times.** All view-derived, so they survive reload, reset on Start over and add no save field or device key.

| First | Trigger | Stronger form |
|---|---|---|
| Pickup | A `pickup` cue when `was.inventory` and `was.equipment` are both empty | The pop's name in `warning` through its hold |
| Quest | A `quest_on` cue when `was.journal` is empty | Running head in `warning` for `motion.first.hold`, then as usual |
| Level | A `level` cue when `was.levelling.level` is 1 | Level line's gilt holds `motion.first.hold` |

Each also plays one tier louder and one haptic step stronger (selection, light, medium, heavy; none stays none). The ding's sample is loka-g5hh.2's; this batch adds only the strengthening. Accepted limits: a playthrough that starts holding items has no first pickup; dropping everything then picking up repeats it. Reduced motion: colour holds, no rise beyond today's. Flashes: unaffected.

**Spec, `book-ui.md`, Effects, after Gilt:**

> **Lamp glow.** While a flame is lit and the shown palette is dusk or dark, a glow sits at the page's lower outer corner, `color.dark.action` at `opacity.glow` fading out over 40% of the page width, in over `motion.palette`, out over `motion.settle`. Away from an exposed room it flickers by `motion.flicker`; reduced motion holds it steady. It lights no sound and no haptic. It is under the ink, draws no block, takes no touch and is no part of the room page's anatomy.
>
> **Map ink.** A room or link new since the Map last showed draws on over `motion.settle` and its title dries; silent. The first opening after launch draws nothing. Reduced motion: it appears.
>
> **First times.** The first pickup, first quest and first level of a playthrough are one step stronger: `warning` held for `motion.first.hold`, one tier louder, one haptic step up. The view alone decides: empty hands and worn before a pickup, an empty journal before a quest, level 1 before a level. Nothing is saved for it.

## G4 Page life

| Effect | Trigger | Form | Reduced motion | Flashes | Sound, haptic |
|---|---|---|---|---|---|
| Choice answers | `choice` first seen with a new continuation; never on a redraw | Each answer on `PickLists`/NPC answers lifts in `motion.stagger.gap` apart with `motion.press`, at most 8 animated; after 8, the rest arrive with the eighth | Appear together | None | None |
| Chosen answer | Existing press | Others fade `motion.fade` | Same | None | Existing press only |
| Person arrives | `entities` gains an id, same `place.id`, S1 | Entity line dries (`motion.dry`) | Same (colour, no travel) | None | None |
| Person leaves | `entities` loses an id, same `place.id`, S1 | Line fades `motion.fade`, takes no touch while fading, then the paragraph closes up | Same | None | None |
| Low health | hp pool `tone === 'danger'` on World and Combat | Under-ink edge vignette of palette `fg`, 0 to `opacity.faint`, one `motion.breathe` value | Steady at `opacity.faint` | None | None |
| Riddle tile | Existing | Lift and tick, unchanged | Existing | None | Existing |
| Riddle right | After Submit, the pending choice is gone with no refusal | The submitted word stays where the answer line was, `warning` for `motion.settle.hold`, settles, leaves at the next redraw | Colour holds | None | `riddleRight` |
| Riddle wrong | After Submit, same `choice_id` still pending | Used tiles return over `motion.settle` | At once | None | Silent |
| Star twinkle | Shown palette `dark` | Two star groups (`NightSky`), opposed phase, opacity 1 to .6 over `motion.breathe`, RN Animated | Still | None | None |
| Dream paper | `DreamPage` shown | Page paper carries `color.dusk.bg` at `opacity.faint` from mount; the curl or fade brings it and takes it away | Same | None | None |
| Travel riffle | Travel fact, replacing the ordinary turn | One snapshot, `motion.riffle` sweeps; no second runtime effect | One `motion.fade` | None | `riffle` once; light haptic after `curlEnds` |

Never animate the riddle clue, the entity's prose or any log line beyond the existing dry. The word shown on a right riddle is the player's own, not prose. Gilt rule holds: a wrong riddle is not gilt. Combat and scenes take no riffle.

**Spec, `book-ui.md`, Effects, after Map ink:**

> **Page life.** A new choice's answers lift in `motion.stagger.gap` apart, never again on a redraw; under reduced motion they appear together. A person arriving in the room dries in; one leaving fades over `motion.fade`, takes no touch while fading, then the paragraph closes; both silent. At the danger hp band a vignette of `fg` breathes at the page's edges up to `opacity.faint` (steady under reduced motion), silent. A right riddle answer stays in its place in `warning` for `motion.settle.hold`, then settles, with one note; a wrong one sends the tiles back over `motion.settle`, silent, never gilt. On a night page two groups of stars twinkle in opposed phase (still under reduced motion). A dream's page carries a tint of `color.dusk.bg` at `opacity.faint`. A travel, known by the sent expedition's confirmed room change, turns five quick sweeps over one snapshot with one riffle and a light haptic after it (one fade under reduced motion). Under-ink layers draw no block and take no touch.

**Spec, `book-ui.md`, Room page anatomy, after the + item pop exception (here only; `AGENTS.md` links to this section):**

> Under-ink layers (night sky, lamp glow, low-health vignette, lightning, wind flutter) are paper, not parts: they draw no block, hold no words and take no touch.

**Spec, `BOOK-UI-COMPONENTS.md`, Design tokens, Motion and sound, new sentence:**

> A layer that stays under the ink (`opacity.faint`, `opacity.glow`) keeps every text role at 4.5:1 at its peak in every palette it shows on. Only one shows at a time, highest first: the fatal hold, the low-health vignette, the lamp glow; together they would break the 4.5:1 rule.

## G5 Credits page

Location: **Settings**, a Control row labelled `Credits`, after Flashes, before Start over. Not a sixth Contents section. Template: the Notice shape in `interaction-patterns.md` (title; body; one way back), as a child page of Settings; the tap is local, `Back` returns to Settings, no engine verb.

- Title: `Credits`. Body: one `type.log` `fg` line per row of `mobile/app/book/sounds/manifest.json` whose `credit` is not null, in file order, each exact text once. The manifest is the only source; no list is kept in code.
- CC0 rows draw nothing. No other words, no links, no heading.
- Motion, sound: an ordinary page turn. No haptic beyond the press. Reduced motion and Flashes as any page.
- Labels only: `Credits`, the existing `Back`. Add `Credits` to `labels.ts`.
- A check: a `credit` line in the manifest for every CC BY row is `bin/check_sounds.py`'s job already; call its release mode before release (loka-gj82.6).

**Spec, `interaction-patterns.md`, Sections template, Settings line:**

> Settings: Reading size, Sound, Music, Haptics, Flashes, Credits, Start over. Credits opens a child page of Settings listing each non-null `credit` in `mobile/app/book/sounds/manifest.json`; it is not a Contents section.

**Spec, `book-ui.md`, Settings, add:**

> A Credits row after Flashes opens a read-only child page, one line for each distinct `credit` in the sound manifest, with Back to Settings.

Also update the doc comment at `mobile/app/book/sections.tsx:191` with this order.

## G6 Beds and exploration music

**Cut form.** One loop file per `place.sound` tag the prologue actually uses, at least 20 s, no hour, tide or weather variants. Tag set as plan section 6: inn, village, shore, cave, forge, church, mill, crypt, vault, wild. Blank tag plays `wild`. A tag with no file plays `wild`; no `wild` file is silence, never a throw. Authors tag rooms; the agent assigns no prose.

| State | Form |
|---|---|
| Room change, same tag | The bed continues without a seam |
| Room change, new tag | Cross-fade over `motion.bed.fade`; `mix.bus.ambience` 3 fits both beds and the weather layer |
| Foreground | Fade in over `motion.bed.fade`. Background: stops. No background playback |
| S3, S4 sfx | Existing `mix.duck`. A chapter cut ducks too (loka-gj82.8). The paper turn ducks nothing |
| Exploration piece playing | Beds at `mix.bedUnderMusic` |
| Fight | Beds silent; back over `motion.palette` (G2) |
| Death | Cut (G1) |
| Sound off | Beds stop. Music off leaves beds |
| Native | Stub, as sound today |
| Reduced motion, Flashes | Unaffected |

**Muffle.** Applies to the G7 weather layer only, when not `place.exposed`.

**Exploration music.** Trigger: entering a `place.sound` tag not yet entered since launch, at least `sound.explore.gap` after the last piece. One 1 to 3 minute piece for that tag, if a file exists. In memory only; a reload may play one again. It never loops, plays out, and is cut only by a fight, a chapter theme or death. No prose rule breaks: nothing loops under prose except a fight. Directed scene cues are not built.

No haptic anywhere in G6. Sources: `docs/design/audio-listening-list.md`; each CC BY cut gets its manifest row with `(edited: cut and looped)`, which is what G5 reads.

**Spec, `book-ui.md`, Effects, after Fight music:**

> **Beds.** Each room plays its tag's one loop on the ambience bus, or `wild`, or silence; the same tag across rooms carries on, a new tag cross-fades over `motion.bed.fade`, and the background stops it. S3 and S4 sounds duck it; the paper turn does not.
>
> **Exploration music.** The first entry since launch to a tag may play its one piece, at most once per `sound.explore.gap`. It never loops, plays out, lowers beds by `mix.bedUnderMusic`, and only a fight, a chapter or death cuts it.

Update the Event sounds silent list only if a developer finds it contradicts these; a bed is not an event sound.

## G7 Storm, wind, lever, latch

Assumes `place.exposed`, weather phases and `action_completed`. Nothing here is built before they land. The Book draws these only on World; never on Combat, a scene, a chapter card or a page in a curl.

| State | Trigger | Visual | Reduced motion | Flashes off | Sound | Haptic |
|---|---|---|---|---|---|---|
| Lightning | Phase `storm`, `place.exposed`, foreground, random in `motion.afterimage.every`, at least `motion.flash.gap` after a wash | Under-ink `color.light.bg` to `opacity.afterimage` over 60 ms, out over 1200 ms | None | None | Thunder 1 to 3 s later, sfx bus | Heavy on the first thunder of a room entry only |
| Thunder, not exposed | Same clock, phase `storm` | None. No light indoors (Q8) | None | None | Thunder through `mix.muffle` | None |
| Weather layer | Phase `rain`, `wind` or `storm` | None | None | None | `weather` loop, its own ambience voice, `mix.muffle` when not exposed | None |
| Wind flutter | Phase `wind`, `place.exposed`: once on change, once per room entry | Paper of the top outer corner lifts `motion.flutter.lift`, settles, twice, over 600 ms; never moves ink | None | Unaffected | None | None |
| Lever | `action_completed` for a lever | No page motion | Same | Same | `lever`, S3 | Medium |
| Hidden exit or unlock | Exit newly in `exits` | Footer label dries | Same | Same | `latch` only when the player's own action unlocked it | Light, same condition |

Rain draws nothing (water light and ink run stay rejected). Frost, footsteps and damp pages stay out. Thunder's first hearing states no new fact, so plan 4.12's text duplicate does not apply; a lever's effect keeps its authored line.

**Spec, `book-ui.md`, Effects, after Flash limit:**

> **Storm.** On an exposed World page in a storm, at random 20 to 60 s apart and never within `motion.flash.gap` of a wash, an under-ink layer of `color.light.bg` rises to `opacity.afterimage` over 60 ms and leaves over 1200 ms; thunder follows 1 to 3 s after, with a heavy haptic only on a room entry's first. Reduced motion or Flashes off keep the thunder and draw no light. Indoors there is no light and the thunder and weather layer pass through `mix.muffle`, no haptic.
>
> **Wind.** On an exposed World page, on the change to wind and once per room entry, the top outer corner's paper lifts twice over `motion.flutter`; no ink moves, nothing under reduced motion.
>
> **Lever and latch.** A lever's completion is one clunk and a medium haptic, without page motion. An exit newly shown dries in the Footer, with a latch and a light haptic only when the player's own action opened it. Both read the event, never a label.

**Spec, `BOOK-UI-COMPONENTS.md`, Design tokens, after Blow wash:**

> **Lightning.** The second exemption from the 4.5:1 rule, for at most 700 ms: at `opacity.afterimage`, `fg` stays above 7:1 and `action` and `danger` above 5:1, while `dim` dips to 4.25:1 and `warning` to 4.03:1 on dusk, and `warning` to 3.95:1 on dark. No other role falls below 4.5:1. It draws with no other held layer under it.

## G8 Prologue ending

**Structure, no new page type and no cartridge field.** The authored final scene, then the existing chapter card, reached by the existing chapter index change.

| Step | Hook | Effect |
|---|---|---|
| Last scene lines | Authored scene text, or none | Existing scene page; one Continue; no added motion |
| Ending card | Chapter label and title, authored; an empty chapter declares no card, and the step is skipped | Existing `S4` chapter card: blur, theme cut, medium haptic; beds duck, exploration piece cuts; screen-reader Continue as today |
| Reduced motion, Flashes | Existing chapter forms | Unchanged |

No lightning, gold or other directed effect on the last beat: scene-called cues need the schema amendment plan section 14 names, and are not in this batch. No wording from an agent: every field above is authored or empty.

**Spec, `book-ui.md`, Chapters, scenes and recovery, add:**

> A cartridge's ending is its last scene, then its last declared chapter's title page; the Book adds no ending page and no words of its own.

## G6 prologue room table

The outline's 18 rooms (`docs/worldbuilding/notes/prologue-outline-2026-10-30.md`), to tag and piece. Structure only, no wording; the cartridge's rooms take these when written. Exposed is the `exposed` tag.

| Room | `place.sound` | Exposed | Piece (first entry) |
|---|---|---|---|
| Awakening Clearing | wild | yes | Path Through The Mountains |
| Healing Grove | wild | yes | Path Through The Mountains |
| Heartwood (hearth and hall) | inn | no | Echoes Of Home |
| The Spring | shore | yes | Ephemera |
| Lira's Memorial | church | no | Soul Searcher |
| Elder Hall records | vault | no | Passage Of Time |
| High Terrace | wild | yes | Path Through The Mountains |
| Tending Fields | village | yes | Home Was You |
| Understory (your hut and Dov's) | village | no | Home Was You |
| Eastern Grove (Blight line, Watering Hollow) | wild | yes | Path Through The Mountains |
| Small Grove | wild | yes | Path Through The Mountains |
| Deep threshold (Three Roots stone) | cave | no | Decoherence |
| Deep caves (Seren) | cave | no | Decoherence |
| Heartroot Chamber | crypt | no | Katabasis I |
| The Thinning | wild | yes | Path Through The Mountains |
| The Edge | wild | yes | Path Through The Mountains |
| Hull corridor with cradle room | vault | no | Passage Of Time |
| The stone outside the hull | wild | yes | Path Through The Mountains |

## Escalated to PM (one item)

What the player sees after the ending card: the World continuing, a hard stop, or an offer to Start over. It is product flow, not design. Until decided, the card turns to the World as any chapter does, which needs no extra build. Not a Fable design request.

Also still open from the epic, not designed here: where a prologue player wakes (`world.death.shrine`). Nothing here depends on it.

## Proposed checks (developer slices)

1. A test computing each under-ink opacity token against every text role per palette: fails below 4.5:1 unless named in the exemption list. Red control: raise `opacity.faint` to .10. A second test: the Book's layer chooser never returns two held layers, given low health, a lit lamp and a fatal hold together; red control: return two.
2. Credits test: page rows equal the manifest's distinct non-null `credit`s, from a controlled manifest.
3. A grep check that `cues.ts` keys no effect on `.text`, a rendered line or a label.
