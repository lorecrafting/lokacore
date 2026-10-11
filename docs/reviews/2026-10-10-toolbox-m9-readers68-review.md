# Review: status readers 6 and 8, perception and concealment (loka-kgd.91, loka-kgd.93)

- Branch `toolbox/m9-readers68`, head `a7bb2592fa63332be6d0709b330b1dfdcf300d48`, diffed against `toolbox/batch-m9` `e56d1226` (21 files). No PR (batch model). Contract slice: `StatusDefinition.perception` and `.concealment`, kernel_api 1.61 floor in both loaders.
- Governing: [Perception and concealment](../system/mechanics.md#perception-and-concealment-on-a-status-toolbox-rows-sr6-and-sr8), [status declarations](../system/cartridge.md#status-declarations), status survey D and E (`2026-10-10-status-effects-survey.md`), [composition](../system/architecture.md#building-mechanics-by-composition), Beads `loka-kgd.91`, `loka-kgd.93` (PM accepted `see_invisible` and the empty-perception refusal; blind fallback line deferred to `loka-x6t.36`).
- Hosted ci and book-e2e green on the head (`gh run list --commit a7bb2592…`: ci 38122237093, book-e2e 38122237071; reviewer).
- Verdict: **APPROVE WITH NOTES** (one should-fix, two questions).

## Must be true

1. Blind: `dark()` true in every room, over a held light and dark sight; content and NPCs hidden as in darkness, no bypass by an NPC perception fact or a glow.
2. A `dark_sight` status equals the ancestry flag; blind beats it.
3. Deaf: sound cues gone from the player's view and from `cue_perceived` for a deaf NPC; smell and heat unchanged.
4. Concealment on an NPC: unlisted, untargetable by every verb, not scanned; on the player: no entry engagement. `invisible` yields to the seer's `see_invisible`, `hidden` to nothing.
5. Only active statuses count; no new write, event, job or save row; cartridges without the fields keep bytes and GameView.
6. Both loaders: 1.61 floor, per_tick optional, empty `perception` refused, same codes and paths.
7. No new import cycle: nothing `status/shared.ts` reaches imports light, movement, disposition, senses, combat or dialogue.

## Proof

- Focused run green: `status_readers`, `light`, `senses`, `attributes`, `targets`, `writer_groups`, `sim` tests; `npm run typecheck`; `content_status_readers_test.exs`, `content_status_test.exs`.
- Target leaks: every verb's ids pass `hiddenTarget` (`commands/actions.ts:287`) and `present` (`commands/target.ts:84`), both through `visible()`, which now returns false first for a concealed or blind-hidden NPC (`light/shared.ts:109`).
- Mutants, all killed (named test failed on assertion): blind dropped from `dark()` (light test); `see_invisible` read on the holder not the seer; `hostileAt` clause dropped; deaf view filter dropped; deaf NPC check dropped; glow `!blind` dropped; scan `shownTo` dropped; dark_sight status dropped; `hidden` yields; TS floor 1.60; TS empty-perception check dropped; Elixir floor `[1, 60]`; Elixir `perception/2` dropped.
- Step invariants: the 13 `CHECKED.step` ids of `test/sim.ts` (incl. `gameview_agrees_with_admission`, `delta_preconditions_hold`) hold on a throwaway probe for the entry move into an invisible hostile troll, then attack, talk, look, scan, flee; blind mid-fight attack, look, scan, flee; an invisible peaceful troll: attack, talk, whisper, look, say. No offer names the unseen troll; every targeted verb is refused (`not_present`, talk `unsupported_capability`: the sampler has no dialogue).
- Payload ids: every `CommandPayload` EntityId field an NPC can fill is in `hiddenTarget`; the absent ones (`endpoint_id`, `detail_id`, `corpse_id`, `supply_id`) name details or items.
- Import cycles: a transitive walk of runtime imports from `status/shared.ts` (37 files) reaches none of the modules above; red control: the same walk from `disposition.ts` reports combat.
- Chapter 1: `ashmere_chapters`, `ashmere_sampler`, `ashmere_missing_child`, `ward_sampler`, `status_sampler`, `toolbox_showcase` compile byte-identical with the base and head `status.ex` (cmp).
- Claims rerun: `disposition.ts:97` is the one clause; "a new attack on it is refused `not_present`; flee still works" confirmed by a throwaway probe (blind mid-fight: attack `not_present`, `flee` offered, the round still lands both ways).

## Findings

1. **should-fix**, `kernel/ts/src/mechanics/disposition.ts:85-97` with `docs/system/mechanics.md:2366`: an invisible hostile NPC still opens a fight on entry (by design, only the player's concealment is read there), and the GameView `combat` block then names it (`opponent_id`, `npc.troll.short`) while the room lists nothing and no attack is offered. Probe: `soaked: {concealment: invisible}` on a hostile troll, move east: encounter opened, `combat` names the troll, `attack` is `not_present`. Known limits list only the "concealed mid-fight" case. Fix: one sentence in Known limits (and the follow-up Beads issue if the Book should say "something unseen").
2. **question**, `kernel/ts/src/mechanics/status/shared.ts:204-210`: the `sensed` gate scans every status declaration on each call to skip a per-body scan that returns nothing anyway when no declaration has the fields. Is it kept for speed? The opt-in claim holds without it; no wrong result either way.
3. **question**, `kernel/ts/src/mechanics/expedition/sequence.ts:98-113`: `houndHere` opens a hound fight without reading the player's concealment. Is an expedition hound "entry engagement" under the doc's known-limit wording, or should the limit name it?

## Open items for the batch merge

- `toolbox/m9-reader7` (f33cf485) also adds `floorOf` in `cartridge_status.ts`, edits `status.ex` `floor/2` and sets `INSTALLED.kernel_api` to 1.62; `toolbox/m9-spellxp` sets 1.60 and rewrites `disposition.ts` near `hostileAt`. Textual conflicts expected: keep movement 1.62 above senses 1.61 in both ladders, the installed kernel at the highest, and the `concealed` clause in `hostileAt`'s filter.
