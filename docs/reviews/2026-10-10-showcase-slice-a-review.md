# Review: toolbox showcase slice A, hub, body and world districts (loka-y6yg.1)

- Branch `toolbox/showcase-a`, head `e0a616f9e27719c89ffd98089135d68756b0c4ee`, base `origin/main` `a0dda330`, 103 files. No PR; handoff and PM rulings in Beads `loka-y6yg.1`. Record kept per the PM brief.
- Governing: [showcase plan 1](../showcase/hub-and-first-districts.md) (Manifest, Hub, Body district, World district); [SHOWCASE.md](../SHOWCASE.md); [owner decision](../decisions/owner-decision-showcase-2026-10-10.md).
- Hosted CI on the head: ci and book-e2e, both success (`gh run list --commit`).
- Verdict: **CHANGES REQUIRED**: two should-fix (the PM rulings 2 and 3, not yet applied), two nits. Nothing else blocks.

## Must be true

1. Each guided step in the hub, body and world tables happens as written and is asserted with literal answers; deviations are listed.
2. Content only: no engine, protocol, other cartridge or Chapter 1 byte changes.
3. The three signpost texts are the plan's verbatim; no topic granted.
4. The hub lists two exits; entry and death shrine are `crossroads_inn`.
5. Every wait spans at most one day; world tests run on clear days.
6. The hash pin holds the source to the bytes the TS walkthroughs load.

## Proof

- (2) `git diff --name-only origin/main...head` outside `cartridges/toolbox_showcase/`: `docs/SHOWCASE.md`, `docs/system-graph.gen.json` (one generated line), the three new TS test files, the new hash fixture, the Elixir test. No other cartridge, engine or Chapter 1 file.
- (3) The three `readable.sign_*` strings in `text.json` equal the plan's block quotes byte for byte (script compare).
- (6) Recompiling the source reproduces `protocol/fixtures/toolbox_showcase_hash.json` with no diff; `test/loka/content_showcase_test.exs` passes.
- (1) Both walkthroughs pass (23 tests). Five content mutants, each recompiled into the fixture, all red: `chilled.duration` 9000→10800 (body 4, 5, 7, 8); Wat leaves at 10 not 9 (body 7); climb damage 3→2 (world 3-4 onward); `shore_steps` spring variant ahead of high tide (world 2); `search_cleft` window from 9 (world 5).
- (5) `wait` asserts the one-day span; the weather oracle comments give days 1 to 4 clear for the world id.
- Claims rerun: sim seeds 1-20 on the compiled showcase: 19 clean, seed 4 `gameview_agrees_with_admission (permission_denied)`, shrunk to take waterskin then drink with the NIL command id. `liquidAgrees` (`kernel/ts/src/view/invariants_view.ts:160`) lacks the NIL-id and wrong-actor carve-outs `serviceAgrees` has (`:195-197`); `needs_sampler` seed 10 fails the same way (`not_found`) with sources identical to main. Cause is loka-xcms, not showcase content.
- Deviations judged: Wat `hp.minimum 1` (same no-death floor as the player) and `immune` (precedent `npc_status_sampler/npcs/golem.json`; no player-only entrant filter exists, [W3 entrant filter](../system/mechanics.md#rumour-by-co-presence-toolbox-row-w3)), accepted. `look_about` alias `gaze`, accepted. `map_positions.json` (precedent `hidden_sampler`; world 7 asserts map links), accepted. Slice B capabilities: the plan's Manifest list names them, so this is not a deviation. World 9 before world 8: world 9 branches on its own world, day 3 before day 4, accepted.
- Playability: start room `crossroads_inn` (07:00 day 1, exits east, north). `loka play` on the compiled artifact runs; in `fell_gate` `read sign` answers "You don't see that here" (finding 1). The web Book preview serves the bundled Chapter 1 only, so the showcase is not playable there without a bundle switch; outside this slice.

## Findings

1. **should-fix** (PM ruling 2), `cartridges/toolbox_showcase/items/sign_body.json:14` (and `sign_hub.json`, `sign_world.json`): signposts are takeable items, so Read is refused until Take. The engine supports reading in place: `readable/rule.ts:16` reads `world.details[target]?.readable`, `:33` admits a detail by room, `view/read_actions.ts:21` offers it from `inspectable_details`; precedent `ashmere_missing_child/rooms/reed_path.json` `details.fox_prints.readable`. Topics come only from items (`rule.ts:42`), so "no topic" still holds. Failure: a player in `fell_gate` types `read sign` and is refused; a taken sign can also be carried off, leaving the room without it. Fix: three room details with `description` and `readable`; body 1 and world 1 read without `take`.
2. **should-fix** (PM ruling 3), `cartridges/toolbox_showcase/items/spare_rope.json` and `text.json:137-139`: the spare rope is still present and does nothing (no climb in `tide_pools`). Remove the item and its three text keys.
3. **nit**, `kernel/ts/test/showcase_world.test.ts` world 1 and 5: plan world 1 "the same command ids give the same lines on replay" is unasserted, and world 5 refuses a `perform` rather than a typed `search`. Neither is listed as a deviation. Failure: none today (variety and target resolution have their own tests); say so in the handoff or pin them.
4. **nit**, `cartridges/toolbox_showcase/text.json:114`: "A [oilskin coat] hangs on a peg." should read "An".

Developer `/code-review` result: not reported in the Beads handoff (commit `e0a616f9` is titled self-review fixes); report it in the fix round.

Not checked: Book web rendering of the showcase; the four sky variants of `fell_top` beyond frost, rain and drought; the fold's garment mixes beyond the frost chill and the Drover.
