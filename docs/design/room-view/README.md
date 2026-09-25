# Room view prototype (design exploration)

**Status:** informative, not authority. This is an owner-chosen UI direction from exploratory mockups (2026-09-24), not specification. [docs/spec](../../spec/IMPORT.md) still governs, including [00 §4.10 Touch interface](../../spec/00-first-cartridge-design.md#410-touch-interface) and the [Lantern proof](../../spec/pre-release-proof.md). Where this page conflicts with the spec, the spec wins until an owner decision changes it.

Open [room-view.html](room-view.html) in a browser to play the Lantern loop on the chosen design. The pages are self-contained HTML and load fonts from Google Fonts. The model inside is a hand-written mock of the proof's four places, not the engine.

## The chosen direction

- **A book, one page per room.** Moving or looking turns to a fresh page with a 3D page curl and a paper sound. The room title is the Look button. Anything you open (a person, a thing, a conversation, a scene, Map, Character, Contents) is a new page, never a sliding menu. The text drawer is the one exception, because it holds the keyboard.
- **Type.** Titles use IM Fell English and the body uses EB Garamond. Paper palette by day. The **darkness rule** is an overlay ("It is too dark to see", then feel around, light the lantern), in the spirit of LegendMUD.
- **The page.** A pinned room title, then the description (only small details such as the mooring post are tappable inline), then MUD-style lines for people and things ("**Bram** the ferryman stands here, one boot on the ferry."), then that room's event log.
- **The footer.** A tiny endpaper minimap sits between two long hairline rules. You are the solid dot, places are open rings reaching two steps out, and paths meet each ring at its edge. Unexplored ways are dotted, and a barred way ends in a small red tick.
  - **The map is the joystick.** Press it and it zooms about 2.6×. Drag toward a path to light it, then release to walk; drag back to the middle to cancel. For up and down, drag out to stair nodes that appear beside it. A tap opens the Map page. A tip bubble teaches the gesture once, and hidden "Go north" buttons serve screen readers.
  - **One status line:** `06:00 · standing · hp 300/300  ma 120/120  mv 200/200`. Tapping the position cycles standing, sitting, resting, meditating and sleeping (you must stand to walk). Tapping the numbers opens Character.
  - Swiping up on the footer (away from the map), or tapping the small handle, opens the text drawer. Every tap shows up there as its command.

## Open questions

1. **Discoverability.** Neither "tap the title to look" nor "press the map to walk" is visible on screen. P5 needs a non-developer to finish without instructions, so both need a first-run hint (the joystick has one) and a real device test.
2. **Darkness in the proof.** The dark shelter is a mockup invention. The Lantern proof does not require it.
3. **Map reach.** The mock shows places two steps out even if unvisited (drawn faint). The real map should draw only what GameView reports as discovered.
4. **Device feel.** The page curl is ten DOM strips in the mock. On a Pixel 3a it should be a Skia page-curl shader driven by Reanimated, and the sound should be a bundled recorded sample. The zoom size and stair-snap distance need tuning on a phone.

## GameView needs

Compared against [protocol/gameview.schema.json](../../../protocol/gameview.schema.json) at `4e8f40b`, which already covers several of the first-pass notes: exit and action reasons with an optional message, text bindings, the choice prompt, speaker and `closable`, `NarrationRecord`, and the current `time`. "Must" means the Lantern loop can't be played by touch without it.

| # | Need | For | Nearest today |
|---|---|---|---|
| 1 | must: exits for `up` and `down` in the same ExitView list, with the same reasons | the joystick's stair nodes | ExitView.direction (keys already allow it) |
| 2 | nice: resources as current/max with a band (`hale`, `hurt`, `badly_hurt`), so the UI never invents thresholds | the status line and Character | none |
| 3 | nice: the actor's position (standing, sitting, resting, meditating, sleeping) and the actions that change it, with a typed reason when movement needs standing | the status line; "Stand up first" | none |
| 4 | nice: discovered map places with grid coordinates and z, the edges between them, and which are visited | the minimap and Map page | none ("map joins with its capability") |
| 5 | nice: a closed door told apart from a barred way (openable or not) | the dashed stair ring and struck exits | UnavailableReason.code (only `exit_locked`) |
| 6 | nice: per-entity visible status (the lantern is lit) and a long description | thing pages; "(lit)" in Carrying | EntityView {id, name, kind, actions} |
| 7 | nice: inspectable details marked as targetable non-entities | the tappable mooring post | none |
| 8 | nice: the objective or stage text of each quest | Journal; tracked objective | QuestView {quest, state, title} |
| 9 | nice: discovered dialogue topics per NPC | "Ask about" chips | none |
| 10 | nice: text aliases per action and target | text drawer suggestions and echoes | ActionDefinition notes they arrive with the parser |
| 11 | nice: the accessibility text key on each advertised action | screen readers | ActionDefinition.accessibility (not projected) |
| 12 | nice: the destination name of an exit the player already knows | screen-reader labels; the Map page | none |

Questions for the engine rather than needs:

- Should rooms carry lit or dark, and obscured entities a perceived name ("something brass") with an opaque handle?
- Are "is here" lines ("Bram the ferryman stands here…") cartridge content in GameView, or built by the UI from the name?
- Should narration carry a semantic cue key (for example `quest_resolved`) for sound and haptics, or should the UI infer it?
- Does moving cost `mv`, and if so is the cost per exit or per terrain?

## Explorations

These are the galleries the direction was picked from, kept so the reasoning can be retraced. Each is a working HTML page.

- [Mood board](explorations/moodboard.md): the first ten directions. Paperback, Chip Rail and Lantern Light were built out.
- [Lantern loop, three ways](explorations/lantern-loop.html): Paperback, Chip Rail and Lantern Light side by side, with notes on each.
- [Bottom bars](explorations/bottom-bars.html): twenty compass and bar layouts, from a cross to a sundial.
- [Exit lines, MUD style](explorations/exit-lines.html) and [book style](explorations/exit-lines-book.html): one-line exits with MUD-derived prompts.
- [Footer blocks](explorations/footer-blocks.html) and [map ornaments](explorations/map-ornaments.html): dividers, a minimal minimap, and the map as the ornament.
- [Tiny map](explorations/tiny-map.html): the chosen ornament (#1), with ring styles and one-line status formats.
- [Map joystick](explorations/map-joystick.html): drag-to-walk with five answers to up and down. The first variant was chosen.
