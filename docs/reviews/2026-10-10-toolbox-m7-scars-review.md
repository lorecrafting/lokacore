# Review: toolbox row W8, permanent statuses (loka-kgd.67)

- Local branch `toolbox/m7-scars`, head `05b07c68c16a5e00c147d1ec6c22598e94e66512`; base `toolbox/batch-m7` at `bd11228f` (40 files). No PR (batch M7 draft later). Includes the PM commit `05b07c68` (narrows the opened story once in `mobile/authority/local-story/scars.test.ts` for the kernel typecheck; no behavior change). Contract slice (`StatusDefinition.duration`, `StatusRow`, `ConditionView`, both `status.transition` composers), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row 1](../system/mechanics.md#status-effects-over-time-toolbox-row-1), [row G3](../system/mechanics.md#statuses-on-npcs-and-things-toolbox-row-g3), [row 2c](../system/mechanics.md#status-modifiers-toolbox-row-2c), [row W25 drains](../system/mechanics.md#hunger-thirst-and-dry-days-toolbox-rows-g13-and-w25-dry), [status composition](../system/protocol.md#status-composition), [status recovery](../system/save.md#status-recovery), toolbox row W8, brief and PM ruling in Beads `loka-kgd.67`, `loka-kgd.50`.
- Hosted CI on the head: ci and book-e2e green (PM).
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, two nits).

## Must be true

1. A permanent row is `{active: true, generation}`: no end, tick or job; it never expires or ticks.
2. Re-applying while active writes nothing and says nothing.
3. The player's same-body return keeps it; an NPC's death clears it; only `cures` ends it.
4. Both kernels refuse `per_tick` on a permanent status, a permanent modifier on an hp-maximum term attribute (loka-kgd.50), and `kernel_api` below 1.48.
5. Both composers accept the new shape exactly, never turn timed into permanent or back while active, and agree on literal fixtures added, none edited.
6. Save: a permanent row persists and reopens; a forged or partial row does not load silently.
7. G3 writer groups and W25 refresh still hold when a permanent and a timed status share a holder.
8. Book: the status line shows the label alone. Chapter 1 bytes unchanged.

## Proof

- Focused runs at head, exit 0: TS `scars`, `status_composition`, `status`, `npc_status`, `exposure`, `death`, `variants`, `buffs`; mobile `local-story/scars.test.ts` (SQLite reopen); Elixir `content_scars_test`, `core/status_test` (fixture parity), `content_missing_child_test` and `content_chapters_test` (Chapter 1 hash pins, 15 tests). Diff touches no Chapter 1 cartridge.
- Fixtures: `status_composition.json` gains 5 `permanent-*`/`timed-to-permanent` cases (Beads claim "5 cases" rerun: confirmed); only the file's `description` string changed; no case edited.
- Mutants killed: TS composer drop the timed-prior guard (`compose_status.ts:18`); Elixir composer drop `prior["job_id"] == nil` (`compose_status.ex:20`); return clears permanent (`death/sequence.ts:205`, Beads claim "kept by same-body return" rerun); Elixir hp_max check off (`status.ex:120`); loader floor 1.46 (`cartridge_status.ts:29`).
- Mutant survived: finding 1.
- Parity: TS `!(prior?.active && prior.job_id)` and Elixir `prior["job_id"] == nil` agree on every lawful prior (an inactive row has no `job_id`); permanent-to-timed fails on `ends_at >= undefined` (TS) and `is_integer(prior["ends_at"])` (Elixir).
- Save probe (throwaway test, status sampler, real SQLite): after one move (poison active), overwriting the status `state_row` with `{active: true, generation: 1}` or `{active: true, generation: 1, ends_at: 300}` gives `save_corrupt` at reopen; writing the same row back reopens `open`. An old save cannot hold a permanent row for a definition: changing `duration` changes the content hash the save pins.
- G3/W25 by reading: a permanent apply joins the holder's group only when it writes (`reaction.ts:195`); the narration test keys on `expected` not active (`reaction.ts:198`), which matches the old `job.schedule` test for timed rows; a permanent and a timed status are different target keys, and the timed one's tick, refresh and expiry are unchanged (`exposure` green).
- Book: `conditionLine` (`mobile/app/book/model.ts:22-29`) omits the time part; story `Conditions` pins "scarred". The text player renders no conditions. Wording is with the designer (`loka-x6t.14`).

## Findings

1. **blocker**, `kernel/ts/src/mechanics/status/shared.ts:157` (NPC path `death/sequence.ts:78`): nothing tests that an NPC's death clears a permanent status. Mutant `.filter(({ spec }) => spec.duration !== 'permanent')` (always keep permanent) stays green across `scars`, `npc_status`, `status`, `death`, `variants`. Failure: a scarred wolf dies and its scar row stays active, so `status_active` still holds on the dead NPC, against the brief and mechanics.md (Permanent statuses, Ends). The sampler wolf never dies. Fix: one assertion that the row is inactive after a scarred NPC dies (patch the wolf's hp in the test world, or call `deathSequence`).
2. **should-fix**, `docs/MECHANICS-TOOLBOX.md:132`: the acceptance column still reads "a hit below 5 HP leaves a scar ... and an NPC line mentions". The PM ruling (Beads `loka-kgd.67`) replaces it with the brief's proof (every hit scars; the scar survives the return; the salve cures; the wolf's W6 variant). Fix in the fix round or at merge.
3. **nit**, `kernel/ts/test/scars.test.ts:101`: the after-return `SCARRED` check passes even when the return clears the scar, because the killing bite's reaction re-scars the returned body (mutant run: generation 2). Only line 107's tombstone generation catches it. Assert the generation right after the return, or say so in the comment.
4. **nit**: the handoff does not report the developer's `/code-review` result.

## Re-check, fix round 1 (head `030fac37578f64bd1ff3574407b112632bf4a36c`)

- Scope: `f030ac27`, `030fac37` and merge `8d665776` of `toolbox/batch-m7` `00a305cd`. Hosted ci and book-e2e green (PM).
- Verdict: **APPROVE**.
- Finding 1 (blocker): fixed. `kernel/ts/test/scars.test.ts` "the wolf's death clears its scar" sets the scarred wolf to hp 1 and kills it, then checks that the row is `{active: false, generation: 1}` and that `currentStatus` (status_active's reader) is undefined. Rerun mutant (keep permanent statuses at every death, `shared.ts:157`): red at `scars.test.ts:180`.
- Finding 2 (should-fix): fixed. The acceptance column at `docs/MECHANICS-TOOLBOX.md:132` now gives the brief's proof (a bite scars; the scar survives death and the return; "a scarred wolf"; the salve cures).
- Finding 3 (nit): fixed. `scars.test.ts:113` checks generation 1 right after the return. Rerun mutant (the return clears permanent statuses, `death/sequence.ts:205`): red at `scars.test.ts:113` (generation 2).
- Finding 4 (nit): open (`/code-review` result not in the handoff).
- Merge: the diff of the head against `00a305cd` is this slice alone (42 files). The view change moved into `conditionViews` (`kernel/ts/src/view/resources.ts:49-53`) unchanged. In the docs, the only lines removed relative to the batch are the four W8 lines the slice rewrites.
- Focused runs at head, exit 0: TS `scars`, `status_composition`, `status`, `npc_status`, `exposure`, `death`, `variants`, `buffs`; mobile `local-story/scars.test.ts`; Elixir `content_scars_test`, `core/status_test`.
