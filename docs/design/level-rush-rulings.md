# Level-up rush: design rulings for B1 to B3

Decided, one pass, for `loka-g5hh.2`, `loka-ot39`, `loka-x6t.59` and `loka-xpk3n`. The owner approved the shape on 2026-10-31 (design note on `loka-g5hh.2`); this record settles what that left open. It reuses the effects epic and adds one token, one view field and one refusal cause. The spec paragraphs at the end are approved text for each slice's developer to paste, because `book-ui.md` describes what is built.

All player words come from authored keys. Nothing here adds any. The composed lines already in `received.ts` stay only as fallbacks for cartridges that author nothing.

## Rulings

### Experience gained

| Question | Ruling |
|---|---|
| When it shows | Every accepted proposal with a net gain, when the cartridge declares `world.levelling.gained`. A loss draws no line, as `levelUp` already does |
| How it looks | An ordinary Log line, no gilt, placed by [Line placement](../system/book-ui.md#line-placement) like the level line |
| The fill | The authored branch at `words.ts:194` fills bound `{slots}`, as `lineSentence` does. Only bound slots: an unbound brace stays as written. Today only `levelling_sampler` has such a slot outside emotes |

### The experience rule (`ExperienceRule`, new component)

Consumer: `StatusLine`. Owner pick `mv1j35ltxddx`; it is the one exception to "the status line adds nothing".

| Point | Ruling |
|---|---|
| Place | A sibling directly below `statusRow` in `StatusLine`, the row's width. Outside the Contents button: no touch target, `pointerEvents="none"`, no layout shift when it fills |
| Size | New token `size.experienceRule: 2`. The brief's `size.rule` is 1 and the owner approved 2 |
| Colour | Track `line`, fill `fg` |
| Value | `(experience − from) / (next − from)`; full with no `next`. Absent when the view has no `levelling` |
| Gain | The fill grows over `motion.dry` |
| Loss, same level or lower | The fill falls over `motion.dry`, no flash |
| A level (one or two crossed) | One run: grows to full over `motion.dry`, turns `warning`, holds `motion.settle.hold`, returns to `fg` at the new fraction over `motion.dry` |
| Reduced motion | Width cuts. The `warning` hold stays; it is a colour, not motion |
| Flashes off | Unchanged. Two pixels are not a page luminance change |
| Screen readers | Hidden. The gained line is read once in its live region and the number is on Character |
| First draw of a launch | No animation |
| Status line hidden (a detail page, a conversation) | The last drawn value survives the unmount. On return the rule runs from it to the current value, with the level run if a level passed. Otherwise a level earned in conversation would never show here |

The rule reads the view, not cues, so a chapter or a dropped S3 cannot cost it its run.

### The level moment

No card. In one reply: the level line in gilt, the `level` sound and medium haptic (existing), one wash, the rule's run.

| Point | Ruling |
|---|---|
| Wash | `warning`, `opacity.wash` under the ink over `motion.flash`. Reduced motion `opacity.washStill`. **No swell**: the swell reads as impact |
| Where | Any page showing when the cue plays, not just Combat. Experience can arrive from a kill, a conversation or an `experience.grant` reaction. A new `LevelWash` is the first child of the `Page` root (`pages.tsx:136`): above `UnderInk` and `Blow`'s layers, below the ink, on paperless pages or not. Opaque cards and the footer stay unwashed, as the blow wash leaves them |
| Clock | One Flash limit. In `play` (`cues.ts:115`) `level` takes `wash` like `hp_loss`, gated by Flashes, `motion.flash.gap` and `s.washed`. Storm already keeps its gap from any `cue.wash` |
| Hit and level together | The level wins. `cuesOf` already lists it first; the blow follows one beat later with `wash: false`, keeping value, thud and haptic. A blow washed under a second before: the level has no wash, and keeps everything else |
| `Blow` | Must answer `hp_loss` only. It reads `cue.wash` from any cue today (`Blow.tsx:57`), so a level in a fight would wash `danger` and swell |
| Two levels | One line, one wash, one sound, one run. `levelUp` already emits one line |
| Flashes off | No wash. Line, sound, haptic and rule stay |
| Chapter in the same reply | Queue unchanged: the chapter card takes the moment and its S3 cues go (`cues.ts`, `step`). Line and rule stay; sound, haptic and wash are lost. Authoring note below |
| Death in the same reply | Falling unchanged: no level wash |
| Page turn during it | Ends it, as for the blow wash. Accepted |

**Contrast.** Same half-second exemption as the blow wash, extended by name. At .18 on `bg`, worst across palettes: `fg` 8.1, `action` 5.2, `danger` 5.5, `dim` 4.15, `warning` 4.0. Over a held layer, worst: `fg` 7.1, `action` 4.7, `danger` 4.8, `dim` 3.75, `warning` 3.6. At `washStill` on bare `bg`, `dim` and `warning` hold 4.5; over a held layer `dim` falls to 4.2 and `warning` to 4.1. Text on cards is unaffected. The held-layer figures treat the vignette (`fg` at `opacity.faint`) and the glow (`color.dark.action` at `opacity.glow`) as uniform at their peak: a worst case, since both are gradients. No new opacity token.

**Gilding the level line needs one engine field.** `level_up` is a cartridge-chosen key and the Book cannot read `world.levelling`; rendered words must never identify it. B2 adds `level_up` (a TextKey) to the view's `levelling` in `levellingView` (`kernel/ts/src/view/skills.ts:72`) and its schema, and the Book gilds the line whose key equals it. The `gained` line stays plain.

**First level** (`loka-xpk3n`). With `cue.first`, the same line holds its `warning` for `motion.first.hold`, as the first pickup's line does. Louder and the haptic step up already exist.

### Learned and rank lines (`received.ts:196`, `cueDiff.ts:85`)

The #570 review's two notes. Intended behaviour, for one reply and one skill, at most one line:

| Case (`w` the skill in the old view, `n` in the new) | Line | Cue |
|---|---|---|
| Taught: `n.acquired && !w?.acquired` | `n.learned`, else `n.rank.reached`, else composed | `skill_learned` |
| Rise, taught: `w?.acquired`, level higher | `n.rank.reached`, else composed | `skill_up` |
| Rise, untaught: `w` present, not acquired, level higher | `n.rank.reached`, else silent | `skill_up` only with a line |
| Newly unconcealed, untaught: `w` absent, not acquired | Silent, whatever its level | None |

All gilt, placed as today. One shared predicate decides for both `skillEvents` and `skillCues`, matching key and kind (`cueDiff` matches key only today), so a line and its sound never disagree. This lifts the `w?.acquired` guard at `received.ts:202` and the same one at `cueDiff.ts:90` without the spurious line.

**Two levels at once.** Confirmed from the mechanics: use adds one per check and a skill rises by at most one threshold; `skill.acquire` adds one. So a jump of two is a teach plus a rise, and `learned` wins. A rise past one threshold by other means shows the current rank's `reached`. An intermediate rank's line is never told; no engine change.

**Rank labels.** A skill row with `rank` reads `<label> — <rank label>` where it reads `<label>, level N` today. No `rank`: unchanged.

### Skills page (`loka-x6t.59`)

| Point | Ruling |
|---|---|
| Authority | Owner Q3, 2026-10-31, supersedes [the PM's ruling](../decisions/pm-decision-skills-on-character-2026-10-15.md) |
| Contents | Exactly Character, Skills, Inventory, Map, Journal, Settings. Always listed |
| Moves to Skills | Plain skills, professions, Spells, in today's order |
| Stays on Character | Name, position, ancestry, level, conditions, attributes, resources, xp, Raise, and topics, which the approved move does not name |
| Empty | One Note, `LABEL.nothingKnown` |
| Foot and routing | Follow Journal's in `Book.tsx`. Aimed spells cast from Skills. The status icon still opens Character |
| Label | "Skills", the name the owner approved in Q3 |

### Sanctuary Attack: hide

The premise needs correcting: `book-ui.md` does not say sanctuary greys. [Unavailable actions](../system/book-ui.md#unavailable-actions) already hides a refusal the player cannot change. Sanctuary greys only because `attackRefused` returns a bare `invalid_state` (`combat/shared.ts:59`), shared with refusals the player can change.

Ruling by `loka-3751`'s test (could the player change the outcome while standing there?): **hide**. Leaving the room removes the card anyway.

Needs protocol and engine, so it is its own small item, S1, outside B1 to B3: add `sanctuary` to `RefusalCause` (`protocol/error.schema.json:93`), return `{code: 'invalid_state', cause: 'sanctuary'}` before the transient checks (else a sitting player sees grey, stands, and the card vanishes), add it to `HIDDEN` in `reasons.ts`. The `loka-vduxr.22` question is answered here.

## Slices

Each is one PR. B2 needs B1. B3 and S1 stand alone.

### B1: experience shows

Gained fill; `ExperienceRule` with its token; rank labels; authored skill lines and the shared predicate.

- With `{amount}` bound, the gained line shows the number; an unbound `{x}` stays literal.
- Each row of the Experience rule table, in a story per state and a test: gain, loss, level run shape, top, absent, reduced motion, first draw, return from a detail page with a gain and with a level.
- The rule has no accessible element, and pressing where it lies does nothing.
- Each row of the skill lines table asserts line and cue on controlled views, including the newly unconcealed case silent and teach-plus-rise showing `learned` once.
- A test that line and cue agree on every row.

### B2: the level moment

`levelling.level_up` view field and schema; `LevelWash`; `play` and `Blow` changes; level line gilt; first-level hold; the rule's `warning` hold.

- A level on World, on an NPC page and in Combat each gives one `warning` wash with no swell, under the ink.
- `hp_loss` and `level` in one reply: `level` has `wash: true`, the blow `wash: false` with value, thud and haptic intact, and `Blow` does not move.
- A level within `motion.flash.gap` of a washed blow: no wash, line and sound remain. Storm keeps its gap from a level wash.
- Two thresholds crossed in one reply: one wash, one line, one run.
- Flashes off and reduced motion match the table.
- The line whose key is `levelling.level_up` is gilt whatever its words; the gained line is not. First level holds `motion.first.hold`.

### B3: Skills page

Per the table. The tests named in the brief (`pass2_book.test.ts`, `practical_skills.test.ts`, `training.test.ts`) follow the content; `SectionPages.stories.tsx` gains the page, with and without skills. Add the fixed Contents list test `interaction-patterns.md` says is missing.

- Contents lists the six in order; Skills opens from it and returns as Journal does.
- Character no longer draws a skill, profession or Spells line, and keeps everything in its row above.
- An aimed spell casts from Skills.

### S1: sanctuary refusal

Per the ruling.

- In a sanctuary the Attack card is absent, sitting or standing, and returns outside.
- An engaged or sitting player elsewhere still sees it grey.

## What the owner must write

- `world.levelling.gained`, with `{amount}`, and `world.levelling.level_up`. It has no `{level}` binding.
- A `narrate` line in each `on {event: level_reached, level: N}` reaction, naming that level's ability. That is the "named new ability" of the rush, and it is content, not Book.
- Each skill's `learned`, and each rank's `name` and `reached`. A rank with no `reached` on a taught skill falls back to the composed line, so author all of them for the prologue. On a skill with `learned`, rank 1's `reached` shows only if rank 1 comes by practice before the teach; a skill only ever taught never shows it.

**Authoring note.** Do not grant a level on the same press as a chapter; the card takes its sound and wash.

## Proposed checks

- The fixed Contents list test (B3).
- The line and cue agreement test (B1).

## Spec text to paste

### B1

`docs/system/book-ui.md`, [Levelling details](../system/book-ui.md#levelling-details): replace "Everything shows on the Character page; the status line adds nothing." with

> Everything shows on the Character page, except the experience rule: 2 px under the status row, `line` track, `fg` fill, no number and not read aloud (owner, 2026-10-31). It fills over `motion.dry` on a gain and falls with no flash on a loss. A level, one or more, runs it to full, then `warning` for `motion.settle.hold`, then back to `fg` at the new fraction. Reduced motion cuts its width. A launch's first draw does not animate; returning from a page without the status line runs it from the value last drawn.

[Skill tree details](../system/book-ui.md#skill-tree-details), after its first paragraph:

> A row with a projected `rank` reads "<label> — <rank label>" in place of ", level N". One skill says one line per reply. Taught: its `learned`, else its rank's `reached`, else "You learn X." A rise on a taught skill: its rank's `reached`, else "Your X improves." A rise on an untaught skill: its rank's `reached`, else nothing. A skill first shown untaught says nothing. The sound follows the line.

`docs/design/interaction-patterns.md`, Status line: add the rule to any list of what it draws. `docs/BOOK-UI-COMPONENTS.md`: list `size.experienceRule`; the component's doc comment and catalogue entry per the table.

### B2

[Effects](../system/book-ui.md#effects-sound-and-haptics), after Blow wash:

> **Level wash.** A level washes the paper once under the ink in `warning`, on whatever page shows, with no swell. It shares the Flash limit with the blow wash; when both land together the level has it and the blow keeps value, thud and haptic. Reduced motion halves it; Flashes off removes it, leaving the gilt line, sound, haptic and experience rule.

Flash limit: unchanged in substance; "a later blow" becomes "a later blow or level". Gilt: add the level line, recognised by `levelling.level_up`, never by its words. First times: replace "(a level draws no line in the Book yet, so it takes only the rest)" with nothing. Levelling details: keep "no banner".

`docs/BOOK-UI-COMPONENTS.md:141`, replace "Combat is the only place the wash appears." with

> The level wash shares this exemption for its half second, in `warning`: at its peak `fg` stays above 7:1, `action` and `danger` above 4.5:1, while `dim` dips to about 3.75:1 and `warning` to about 3.6:1 over a held layer.

`docs/system/mechanics.md`, levelling view: add `level_up`.

### B3

`book-ui.md` Contents and `interaction-patterns.md` Sections: "exactly **Character**, **Skills**, **Inventory**, **Map**, **Journal**, **Settings**". Character: drop skills, professions and Spells; add Skills: "skills and professions, Spells (refused words with reasons)". Keep "Never appears: a further section without an owner decision".

### S1

[Unavailable actions](../system/book-ui.md#unavailable-actions), the `hides` clause: "today an Attack on a person who cannot be hurt, or any Attack in a sanctuary".
