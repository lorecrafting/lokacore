# Review: Editor E6b, NPC and Item inspector cards (PR #656, loka-wfrgk.4)

- PR: [#656](https://github.com/lorecrafting/lokacore/pull/656), branch `editor/e6b-npc-item`
- Reviewed commit: `a4b1abbbc012a2c2bb916951d35408a3e55c734d`
- Governing: [gui-editor design §4.2, §4.3 and §11](../rnd/gui-editor-design-2026-11-04.md), [owner editor plan](../decisions/owner-decision-authoring-editor-plan-2026-11-04.md) (cards hold no logic, the generic list only shrinks), [E6a review](2026-11-05-e6a-room-review.md), [E6e review](2026-11-05-e6e-world-review.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at the reviewed head (`gh run list --commit a4b1abbb...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body (10 findings; 6 left open and ruled below).
- Merge: a trial merge with origin/main `9796b9a55` is clean.

## Verdict: CHANGES REQUIRED (three should-fixes, no blockers)

## Must be true (written before the diff)

1. Every write goes through `useCard` (`POST /change`, `POST /undo`), with no new route, and Undo restores the bytes.
2. The cards hold no logic: each edit is a plain `card.ts` function with `node:test` cases.
3. The card offers only fields that compile under the declared capabilities, and it can still express everything the compiler accepts. That covers an item's location in a room, an NPC, an item or a template, and an NPC's room. `spawn_template` hides placement.
4. A new value is the schema's minimum or the sampler's value, and new words are `~` only.
5. The baseline shrinks by exactly the `npcs.*` and `items.*` paths, and the red controls fail when a card is unregistered.
6. The Room card is not weakened.

## Checks that held

- Writes and undo, walked in real Chrome, dark, on a copy of `toolbox_showcase`:
  - Adding `hp` to the `chandler` NPC and pressing Undo left the file byte-identical (same sha).
  - Setting `training_sword`'s `mass_grams` from 600 to 650 and pressing Undo left the file byte-identical.
- Gates checked against the compiler:
  - `npcs.attack`: matches `lib/loka/content/combat.ex:155-161` (needs `world.combat` and the NPC's hp) and `:216-221`.
  - `items.bandage`: matches `bleed.ex:29-34`.
  - `items.affects`: its owner, attribute, matches `derived.ex:129-134`.
- Room is not weakened. `adder` reads `card.draft` when it runs, and `Room` calls `allowed` without a doc or world, so `NEEDS` (npcs only) never applies to a room.
- Baseline: 189 lines removed (99 `items.*`, 90 `npcs.*`), and nothing else.
- `elixir bin/red_controls.exs` exits 0, with `ok editor gate: npc-card` and `item-card`. This backs the PR claim.
- Focused tests: `test/card.test.ts` and `test/author_mapedit.test.ts` pass (34 tests). Their expected values are hand literals.

## Mutants

`bin/mutate_diff.sh origin/main` produced 42 mutants, of which 23 ran: 14 red-narrow, 9 SURVIVED, 19 NO-TESTS, no TIMEBOX.
- Two survivors, `card.ts:355` and `:356`, only change numbers inside comments (`owner/2`, `gate/1`). They are equivalent mutants.
- The other 7 survivors are in `mapwire.ts`.
- The 19 NO-TESTS rows are panel `.tsx` files.

Three hand mutants, all red:
- `placed` spreads the old `location`: the placement test fails.
- `owners.every` becomes `some`: both add-menu tests fail.
- The `items` to `item` mapping is dropped: the picker test fails.

## Findings

1. **Should-fix: an item's placement is a room picker only.** At `tools/author-panel/src/edit/cards/Entity.tsx:67`, `own=[...WORDS, at]` hides `location` from the form. `Placement` (`:75-111`) offers only a room, and it returns null for `in: 'template'` (`:80`).
   - The design's §4.2 row for `location` asks for "a room, an NPC, a container".
   - On main, `items.location` was on the generic form.
   - Failure, walked: `training_sword` shows "held by npc "aldous"" over an empty room field. The author cannot give the sword to `smith` or put it in a chest. The card also cannot make an item a template, or turn a template back into a placed item.
   - Fix: a holder picker of the right kind (room, npc or item) as a tested `card.ts` function. That also removes the blank field after a clear (`:98`, open item) and moves Entity's 15 untested rows out of React, as the E6a review required.
2. **Should-fix: Add hp writes an hp that cannot compile.** `minimal` (`kernel/ts/play/card.ts:297`), through `adder`, writes `minimum`, `maximum` and `start` as -2147483648.
   - The spec allows the schema's minimum or the sampler's value. The sampler's value is `resources.ex:16` (0/20/20/5).
   - Failure, walked: the file gets those values, and the compile fails at `chandler.json:55`, BODY_BELOW_ZERO (`resources.ex:246`). The refusal shows at the field. Attack stays hidden until hp exists, so adding combat to an NPC always starts with a broken file.
3. **Should-fix: the bespoke Combat numbers and Schedule blocks are missing.** Design §4.2 (line 83) and §4.3 (lines 93-94) mark `hp`, `attack`, `weapon`, `daily_schedule` and `schedule_cases` as bespoke, with numbers beside `GET /numbers` and a schedule shown as hours by room picker. §4.2 line 61 says a generic-first path stays in the baseline until it is replaced.
   - Entity renders these through the generic form and never calls `/numbers`. Yet `registry.json:94,112,117,122` mark these paths hand-built.
   - Failure: the gate now reports them as done, so nothing makes anyone build the blocks. The PR body's "they cover combat numbers, the schedule" is not backed.
   - Fix: put those paths back to `generic` in the registry and the baseline, or open a Beads follow-up and correct the body, as the E6e review accepted for Population.
4. **Nit, gates are coarser than the compiler.** Affects is offered without a slot, though `derived.ex:77` requires one. Bandage is offered on an item with a slot, edible or a container, which `bleed.ex:88-91` refuses. The refusal shows at the field.
5. **Nit (open item), `fields.tsx:47`:** the picker keys come from the last good compile. §11's "stale" label is not shown.
6. **Nit (open item), `card.ts:160` `pickKind`:** a field whose name is not a kind falls back to free text (`daily_schedule.8`, `arrest.to`). It never refuses a valid id, and the compiler still checks.
7. **Nit, PR claims:**
   - "Every card.ts row is red", "17 NO-TESTS" and "8 mapwire" do not match the run (2 equivalent survivors, 19 NO-TESTS, 7 mapwire).
   - The cites `card.ts:165 refusePick` and `:172 placed` are now at `:203` and `:252`.

Accepted, not findings:
- Selecting NPCs from the Hierarchy and not from the map (open item).
- One-step card Undo (open item; E4a behaviour).
- Page scroll is not a regression from this PR. The tollhouse room is 5661 px in a 900 px window on main and on this head. The NPC and item cards are 110 to 148 px taller than main's generic card (2887 to 3035 px, 2208 to 2318 px). The vertical overflow is pre-existing; it needs a bead of its own, which #654 did not cover.
- Composition (step 7) and Book UI (step 8): not applicable. This is panel code with no Book change.

Walk caveat: the Book iframe did not load (a port clash on `::1:19007` with another agent's server), so "Edit in Book" was not walked. Screenshots `e6b-dark-*.png` are in the session scratchpad.
