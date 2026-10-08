# Review: E1 batch E dispositions for unreachable v042 paths — 2026-10-07

- Scope: local branch `e1/batch-e-dispositions` (not pushed), `git diff b9b9326f f17c0ff5`. The spec commit is `c5241ffc`. Beads `loka-e1-r9-certification-2rz.10`, for draft PR #288.
- Reviewed exact head: `f17c0ff5`.
- Governing rules:
  - [E1 policy branch evidence](../system/architecture.md#e1-policy-branch-evidence) (`:386-401`, including the new family-gap sentence);
  - [PM decision, batch E](../decisions/pm-decision-e1-batch-e-dispositions-2026-10-07.md);
  - [owner decision, E1 branch evidence](../decisions/owner-decision-e1-branch-evidence-2026-10-07.md);
  - [review stance](../WORKFLOW.md#review-stance).
- Precedent: [E1 guard refusals review](2026-10-07-e1-guard-refusals-review.md) (E1-D1..D5).
- **Verdict: CHANGES REQUIRED** (one blocker: a test gap). All 19 rows are correct.

## Must be true (written before reading the diff)

1. Exactly the 19 paths in the brief get rows `{path, reason, evidence, review}`. No row has `refusal`. Each `review` names this record.
2. No lawful v042 execution witnesses any of the 19 paths.
3. A disposition never adds to the witnessed set. The run still fails on an unknown, duplicate or witnessed row.
4. `gaps()` drops a dialogue or choice from its family list only when that exact dialogue or choice path is dispositioned. A row for a sibling, or for a descendant such as a policy leaf or a sequence step, does not close the family entry.
5. The new test's expected values are hand-checked literals. It fails when `gaps()` ignores the rows.
6. The recorder literals hold, and all earlier cases are byte-identical apart from the source identity fields.

## Results

- Artifact rebuilt with the brief's one-liner: sha256 `1c53bcd8…1115`, 298,815 bytes.
- Recorder at `f17c0ff5`: exit 2, 37 cases, `failure: null`.
  - Pending 13: the 14 batch F paths minus `ma`.
  - Dispositioned 34. Witnessed 601, identical to the list at `b9b9326f`.
  - Families: rooms, quests, dialogues, choices and scenes are all 0. At `b9b9326f` they were dialogues 1 and choices 2.
- Set-diff against `b9b9326f`: exactly the 19 paths moved from pending to dispositioned. None was added, and all 15 old rows remain.
- Byte identity: 37 journals, 3,759 lines compared field by field. Only `source` and `kernel_version` differ, and both come from the commit. The 37 report receipts are identical.
- `node --test test/e1*.test.ts`: 51/51 pass. `npm run typecheck`: exit 0. `elixir bin/check_docs.exs`: exit 0.
- `gaps()` and the disposition table are TS-test-only. No Elixir counterpart exists, so there is no cross-kernel case.

### Re-derivation of each row at head

- **1-4 `a_elspeth_lost`: holds.**
  - Policies: `a0_d9_elspeth_lost_prior` is `all[lost, prior]` and `a_elspeth_lost` is `lost`. Both have npc `elspeth`, so `spokenBy` opens `a0_` first (`selection.ts:22-30,40-51`).
  - Every reference in the cartridge to `chapel_bell_rung`, `chapel_allegiance` or `village_child_status` was walked, in any field. The only writers are:
    - `ring_bell` success: bell rung, then allegiance `prior`;
    - `silence_bell`: allegiance `fox`;
    - `b_lost_before_meeting` apply[1]: `lost`;
    - the dialogue choices that set `rescued` or `stays`.
  - No scene rest credit, patrol fact, death credit or deadline fact names any of the three facts.
  - Both bell recipes need allegiance `unknown`.
  - Keyed talk: `step()` takes a raw `Command`, but `action_input.ts:51-52` refuses a keyed talk unless an offered action carries the same `dialogue`. Unlabelled `a_elspeth_lost` has none. See nit N1.
- **5-11 `objectives_complete`: holds.**
  - Writers: the earn (`proposal.ts:182-193`, only `post_activation_event`), `resolution()` (`lifecycle.ts:191-196`, one op list) and the two `to: 'failed'` writers. This list is complete: a grep of `kernel/ts/src` found no other writer.
  - All five quests are `current_state`.
  - `quest_state` reads the stored state (`policy.ts:46-47`).
  - Wick: the exchange choice resolves through `resolution()` in the same `accepted` op list (`dialogue/rule.ts:170,196-208`). A repeat activation creates a new `active` instance (`compose_quest.ts:24-37`).
- **12-14 `failed`: holds.** The only writers are `reaction.ts:159-168` and `schedule/rule.ts:120-131`. v042 has one `quest.fail` (on `missing_child`) and one deadline (on `chandlers_debt`).
- **15-17 `abandoned`: holds.** No kernel code transitions to `abandoned`. It appears only in the two legality tables.
- **18 `seek_wisp` failure: holds.**
  - The check is `per >= 5`. `per` starts at 5, and only `fen_born` modifies it (+1).
  - `character.select` is written once (`attributes/rule.ts:11`), and `world.ts:124-129` blocks every command before it. So `per` is 5 or 6.
- **19 `ma`: holds.**
  - The only reference to `ma` in the cartridge is its own definition. No `resourceRef(…,'ma')` call site exists.
  - `ma` has no `regen`, so `recoveryAdjustments` and `recoveryFault` skip it. Death restores only `hp` and `mv`.
  - `current()` clamps gain at the maximum of 100 (`foundation/resource.ts:66`).
  - It composes with batch F: F's gain clause requires `next > old` (`e1_world_witness.ts:181` on `e1/batch-f-world-witness`). `ma` never rises, so F cannot credit it, and the merged run will not fail with `witnessed disposition`.

### Mutants and red controls (throwaway worktree, never committed)

- The red controls ran through `checkDispositions` and `obligationReport`, with the head witnessed set:
  - (a) Row 9's path changed to `a_wisp_offer/policy/root`: `witnessed disposition`. Caught.
  - (b) Last row duplicated: `duplicate disposition`. Caught.
  - (c) Row 9's path misspelled: `invalid disposition`. Caught.
- `gaps()` mutants, run against `test/e1_obligations.test.ts`:
  - d1, dialogue filter removed: the new test fails. Caught.
  - d2, choice filter removed: the new test fails. Caught.
  - d3, a dialogue row closes all its choices: the new test fails. Caught.
  - d6, both filters removed: the new test fails. Caught.
  - d4, the dialogue closes when any disposed path starts with `/dialogues/<ref>`: 13/13 pass. **Missed.**
  - d5, the choice closes when any disposed path starts with `/dialogues/<ref>/choices/<c>`: 13/13 pass. **Missed.** This mutant is not equivalent: 22 authored `choices/<c>/sequence/<n>` paths exist.

## Findings

- **E1-E1 blocker** at `kernel/ts/test/e1_obligations.test.ts:359-371` (the rule is at `kernel/ts/test/e1_cases.ts:227,233`).
  - The fault: prefix matching (d4, d5) survives the suite. The PR states that rows are "matched exactly, never by prefix", and must-be-true item 4 requires it. Nothing tests it.
  - Failure scenario: a dialogue that no case opens gets a disposition for one of its negated leaves, as in rows 6-17. Under d4, `gaps.dialogues` drops that dialogue, and the recorder reports families 0 for a dialogue that never opened. Rows on choice `sequence/<n>` steps do the same to `gaps.choices` under d5.
  - The output at head is not wrong: every other dialogue and choice is seen, so the gap is latent.
  - Fix: add two rows to the existing test and two hand-literal assertions:
    - `maud_offer/policy/root/item/items/1` → `gaps.dialogues` still includes `maud_offer`;
    - `a_aldric_debt/choices/late/sequence/0` → `gaps.choices` still includes `a_aldric_debt/late`.
- **N1 nit** at `kernel/ts/test/e1_dispositions.json:155` (and rows 2-4).
  - The fault: the evidence says keyed selection is impossible because `invocation.ts:109-110` forwards only labelled dialogues. But `step()` (`world.ts:115`) accepts a raw `Command`. The guard that actually blocks a keyed talk to an unlabelled dialogue is `commands/action_input.ts:51-52`.
  - Failure scenario: a later change relaxes that guard. The cited lines still read true, so the row silently goes stale.
  - Fix: add `kernel/ts/src/commands/action_input.ts:51-52` to the evidence.
- **N2 nit** at `kernel/ts/test/e1_dispositions.json:263`.
  - The fault: "Kernel-named pools are hp and mv only" is true of the `resourceRef` call sites. But `mechanics/resource.ts:23` says "the engine pools are hp, ma and mv", and `view/resources.ts:28-36` reads every pool for display.
  - Neither path writes `ma`, so the argument stands. Saying "no kernel op names ma" would be more exact.

Over-engineering: none. The `gaps()` change is +6/-3 lines and reuses `disposed`. The decision record and spec sentence are accurate, minimal and cited. The authoring smells are reported, not changed.
