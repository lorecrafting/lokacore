# Review: NPC moods, PR #507 (loka-x6t.71)

- PR [#507](https://github.com/lorecrafting/lokacore/pull/507) `content/x6t71-moods` at `488c569df417e93fbad0c1265ccac1bb9e596364`, diff `origin/main...488c569df`.
- Governing: "Owner decision 2026-10-30", "BRIEF loka-x6t.71 MOODS" and PM rulings (a) name variants carry words, (2) dead compiler line deleted, (3) NpcPage Mood shows a goblin, in `br show loka-x6t.71`; [record](../decisions/owner-decision-moods-ambient-emotes-2026-10-30.md); [W6](../system/mechanics.md#entity-description-variants-toolbox-row-w6); [room sentence](../system/book-ui.md) 80-90; [contracts lessons](../lessons/contracts.md) 6-9; AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work.
- Verdict: **CHANGES REQUIRED** (two should-fix, both small: fixture rows and contract text).

## Must be true (written before reading the diff)

1. An NPC declaring `room_line_variants` is refused by the Elixir compiler (UNKNOWN_FIELD) and by the TS contract check (unknown_property), each with a test.
2. Item `room_line_variants` (items_sampler lantern, identify_sampler ring) still work.
3. Each of the 11 migrated NPCs keeps every `when`, in order, and its meaning now sits in a name or description variant the Book draws.
4. A name variant may carry `words`; the GameView carries the words of the name shown (base words for the base short, the variant's for a variant, none without); the compiler checks those text keys.
5. The Book groups by the shown name's plural; the walk's button text is real Book text.
6. Every `required` entry and bound of the new `NameVariants` def has a fixture that fails when removed.
7. Ruling 2: the dead `npc_fields.ex` line is gone and the remaining line is live. Ruling 3: the NpcPage Mood story shows a goblin.

Results: 1-5 and 7 hold; 6 fails (finding 1).

## Findings

1. **Should-fix, `protocol/entity.schema.json:843,846,848,849` (`NameVariants`; mirror `schemas/source/defs.schema.json:1643`).** A sweep that drops one bound at a time, run against `protocol/fixtures/invalid.json` and every example with `DEFS`+probe defs, leaves survivors: `required: ["description"]`, item `additionalProperties: false`, `minItems: 1`, `maxItems: 16` (also `type`, the `when`/`description` refs, and `ItemDefinition.name_variants` -> `TextVariants`). Only the `words` ref and the NPC ref are killed. `TextVariants` has min/max rows (invalid.json:21118, 21129), so this def is the gap. Failure: an edit that drops `required` passes CI, and a cartridge name variant with `{"words": {...}}` and no `description` then loads with no text key to show. Fix: one invalid row per bound (an empty list, 17 entries, a missing description, a stray key).
2. **Should-fix, `protocol/gameview.schema.json:528,682,2149,2170`** (EntityView, ContentView, CombatView, `active_opponents` `words`). These still say words are "absent while a name_variants entry holds". `kernel/ts/src/view/combat.ts:31-33` now copies the variant's words. Failure: a client built to the contract drops `words` during a mood, so two afraid goblins no longer collapse into "two cowering goblins". Fix: the description text, then regen.
3. **Nit, PR body "both compilers check its text keys".** Only `lib/loka/content/entities.ex:181-188` checks them; the TS side has no compiler or text-key check. Failure: the PM relies on a load-time refusal that does not exist.
4. **Nit, `kernel/ts/src/view/combat.ts:32`.** The words are found by matching the description key. Failure: two variants that share a description key but carry different `words` always give the first one's words.

## Evidence

- **(1)** Elixir: `test/loka/content_voices_test.exs` adds a sage `room_line_variants` case giving UNKNOWN_FIELD. TS: invalid.json:29014 `npc_room_line_variants_retired`. In the sweep, re-adding the property to `NpcDefinition` is killed.
- **(2)** `rule.ts:73` keeps item room-line variants. My hand mutant (`=== 'item'` -> `!==`) turns `play_items.test.ts` red.
- **(3)** `when` preserved, checked per NPC:
  - gift farmer: warm, cold.
  - rivals smith: gloating.
  - showcase cellar_goblin and den_goblin: afraid.
  - guard and watchman: wanted.
  - mark, warden and wat: dropped. Each already had a description variant with the same `when`: robbed; watchful; ash and chilled, in order.
  - variants maud: dropped; she already had bruised.
  - voices sage: scholar.
- **(4)** `combat.ts:31-33`. The `entities.ex` words mutant (`words_texts(v)` -> `[]`) turns `content_variants_test.exs` red.
- **(5)** `mobile/app/book/lines.tsx:185-205` groups by `p.text(words.plural)`, and :192 gives "two cowering goblins". The walk at `toolbox_showcase.walk.ts:290` matches, with the aria label "<name>, open". "A cowering goblin and goblin are here." follows the shared-article rule (book-ui.md:83-86), so it is not a finding.
- **(7)** Dropping `name_variants` from the `npc_fields.ex:36-44` Map.take turns `content_variants_test.exs` red, so the line is live. The developer's equivalent mutant (re-adding `room_line_variants`) is equivalent: `compiler.ex:250-275` validates before `expand`.
- **mutate_diff `origin/main`**, exit 1 (7 run, no TIMEBOX):
  - red-narrow: rule.ts:69 and :71, combat.ts:33 x2;
  - SURVIVED: rule.ts:73, combat.ts:32 x2.
  - My hand mutants killed all three survivors: rule.ts:73 by `play_items.test.ts`; combat.ts:32 #1 and #2 by `showcase_traps.test.ts`.
  - This matches the handback, which says rule.ts:73 is "red-full"; a named narrow test kills it.
- **PR claims rerun:**
  - "Re-adding the schema field turns the TS invalid fixtures red": confirmed.
  - "combat.ts:32 x2 red-narrow (hand, showcase_traps)": confirmed.
- `/code-review medium` is reported in the PR body.
- CI at `488c569df` (`gh run list --commit`): graph-diff, ci and book-e2e completed success.

## Re-check: fix round 1 at `c04f53cba847064cff62619674c2049ac7205746`

Scope: commit `c04f53cba` only, plus the callers of `named` (`view/combat.ts:40`, `view/view.ts:226`). Verdict: **APPROVE WITH NOTES**.

- **Finding 1, fixed.** `invalid.json` adds four `NameVariants` rows. I reran the schema sweep: removing `required`, `minItems` or `maxItems` now fails a fixture row. Removing `additionalProperties` still leaves the tests green, but that mutant is equivalent: `kernel/ts/src/foundation/validate.ts:95` already treats declared properties as closed, so the `room_line` row gets `unknown_property` either way. `TextVariants` behaves the same way. The `when`/`description` refs and `ItemDefinition.name_variants` -> `TextVariants` were outside finding 1 and stay as they were.
- **Finding 2, fixed.** `gameview.schema.json:528,682,2149,2170` now describe the words of the holding variant; `contracts.gen.ts` is regenerated to match.
- **Nit 3, fixed.** The PR body now says only the Elixir compiler checks the text keys (`entities.ex` `variant_texts`).
- **Nit 4, fixed.** `view/combat.ts:28-33`: `named` now takes the name and the words from the same holding variant. This is the selection `describeEntity` makes for `short`, which has no `dark_description`; the other short-name callers (`line.ts:20`, `knowledge.ts:99`, `view.ts:285`) agree with it. Hand mutants, all red-narrow on `showcase_traps.test.ts`/`play_items.test.ts`:
  - `v.words` -> `e.words`;
  - `find` -> `findLast`;
  - `{ target: id, steps }` -> `{ steps }`.
  The two-variants-one-key case still has no test; that was a nit.
- CI at `c04f53cba` (`gh run list --commit`): graph-diff, ci and book-e2e completed success.

## Second opinion

- Commit reviewed: `c04f53cba847064cff62619674c2049ac7205746` (head after fix round 1), diff `origin/main...c04f53cba`. The second reviewer wrote the list and findings below before reading the record above.
- Verdict: **APPROVE**. No blockers, should-fixes or nits. Fix round 1 closes first-review findings 1, 2 and 4. Finding 3 is fixed in the PR body (line 53 now names only the Elixir compiler).

### Must be true

1. Both kernels refuse an NPC `room_line_variants`, even `[]`, and an invalid row covers it.
2. Every `NameVariants`/`NameWords` rule fails a row when removed.
3. `gameview.schema.json` changes only in description text, with no structural change (the brief's STOP rule).
4. Hash and transcript re-pins appear only where content changed; no save or receipt behaviour changes.
5. Item `room_line_variants` still draw.
6. A name variant shows its own words, or none; dropping a mood `when` fails a test.

All hold.

### Evidence

- **(1, 2) Cross-kernel accept/refuse.** Hand-made variants_sampler NPC files were run through `mix loka.compile` and artifacts with recomputed hashes through `loadCartridge`. Both kernels agree on all ten shapes:
  - Accepted: words with `the`; item `room_line_variants`; a name variant without `when`.
  - UNKNOWN_FIELD: NPC `room_line_variants` (`[]` and non-empty); an extra key in words; an extra key in a name variant.
  - Refused by schema: article `An` (not_in_enum); words `{}` (missing bare).
  - Elixir only: a plural text key missing from the catalog (UNRESOLVED_REFERENCE). This is by design: TS has no text-key check.
- **(2) Schema mutants**, regenerated with `elixir bin/contracts.exs`, run against `validate.test.ts`:
  - Re-adding the NPC field: red.
  - Deleting `minItems`, `maxItems` or `required`: red.
  - Removing `additionalProperties:false`: the generator refuses it (`schema.ex:67`).
- **(3)** The diff touches only the four `words` descriptions.
- **(4) Re-pins.** All 37 changed transcripts and live `.sql` files equal `origin/main` once every 64-hex value is masked. One pair changes everywhere (content hash `76c00879…` -> `c29e4e12…`, 1406 hits). `delta_digest` values are unchanged, and the save rows differ only in that hash.
- **(5)** Hand mutant `rule.ts:73` (items' room-line variants -> `undefined`): red in `play_items.test.ts`.
- **(6)** Hand mutants on `combat.ts:31` (base words kept) and `:30` (`target` dropped): both red in `showcase_traps.test.ts`, traps 8 and the sandbox twins.
- **PR claims rerun:** "Re-adding the schema field turns the TS invalid fixtures red" and "deleting each NameVariants rule turns validate.test red": both confirmed.
- **Open, not a finding:** the mixed-mood sentence ("A cowering goblin and goblin are here.") waits on the owner question already logged at polish (handback 2).
- **CI** at `c04f53cba` (`gh run list --commit`): graph-diff, ci and book-e2e completed success.
