# Review: toolbox row 6a, combat target choice in the same room (loka-kgd.63)

- Local branch `toolbox/m7-targets`, head `7099c6406471d0a13075bd40dc36b51fc4fb87cd`; merge-base with `origin/main` `f3d561e6` (40 files). No PR yet (batch M7 draft later). Includes the PM commits `cec32109` (state-sections regen) and `7099c640` (retarget split). Contract slice (new delta op `encounter.target`), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [C4 pack contract](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract), [C4 composition](../system/protocol.md#c4-pack-encounter-and-flight-composition) ("both portable twins, independent literal fixtures, then differential proof"), [toolbox slice process](../MECHANICS-TOOLBOX.md#toolbox-slice-process), [contract lessons](../lessons/contracts.md) (a guard in both kernels needs a red control in each suite), brief in Beads `loka-kgd.63`.
- Hosted CI on the head: ci and book-e2e green (PM).
- Verdict: **CHANGES REQUIRED** (one blocker, one should-fix, two nits).

## Must be true

1. Attack on another active roster member while engaged changes only the primary; the next round's player blow lands on it, the other member is untouched; no draw, job or round move.
2. Opt-in by a cartridge field with a `kernel_api` floor in compiler and loader; Chapter 1 (fen hound pack) and the corpus keep bytes, hash and receipts.
3. The new op composes only on an open roster row with the current job, exact `expected`, and an `npc_id` that is a present active member other than the primary, in both composers and both invariant twins, each guard pinned by a literal fixture.
4. The offer matches the rule: roster of two or more and opt-in only; a single-foe fight keeps today's ActionSet.
5. No new save row kind or host consumer; reopened save and receipt replay carry the row unchanged in shape.
6. The target model stays general for 6b/6c without widening loka-x2gv or loka-kgd.43.

## Proof

- Focused runs at head, exit 0: Elixir `content_missing_child_test` (Chapter 1 v042 hash pin), `content_targets_test`, `c4_pack_composition_test`, `encounter_composition_test`, `compose_test` (32 tests); TS `targets`, `c4_pack`, `c4_pack_composition`, `c4_pack_flight`, `c4_schema_contracts`, `hounds`, `e1_creatures`, `e1`, `validate`. Diff touches no Chapter 1 or corpus cartridge; `cec32109` adds only `ops["encounter.target"] = "encounters"`; `7099c640` is a pure move.
- Fixtures: `c4_pack_composition.json` +8 `target-*` cases, each with a counterfeit; `invalid.json` +2 rows; no line removed from any fixture.
- Mutants killed: TS composer drop `present` (`compose_encounter.ts:192`); Elixir invariant drop `!= row["npc_id"]`; TS invariant drop `memberInitiallyPresent`; Elixir invariant drop `member_initially_present?`; rule skip `switched` (`rule.ts:23`).
- Mutants survived: see findings 1 and 2; `shared.ts:58` opt-in dropped (claimed equivalent, below).
- Parity: both composers check presence through `packMemberRemains`/`ComposePack.remains?`, which require initial presence plus current presence; both invariants use initial presence. A member moved in or out earlier in the same delta is refused by both composers, so no composer success an invariant rejects. Literal cases pass in each kernel against independent answers; replaying them through the peer adds nothing. Handoff claim (3) rerun: the randomized pool (`compose_test.exs:298-303`, 129 base/pools ops plus patrol, knowledge, expedition) has zero encounter ops; the simulator differential never emits this op either (Chapter 1 does not opt in). Answer: no randomized differential case needed for this op; 6b/6c, which widen the guard, should add one.
- Equivalent mutant (handoff claim 4) rerun: dropping the opt-in in `retarget` keeps `targets`, `c4_pack`, `c6_expedition`, `hounds` green. Accepted: `resolved` (`actions.ts:162-174`) drops Attack while fighting without the opt-in, GameView rows come from that set (`action_lists.ts:205`), and the only other `attackRefused` caller, `expedition/sequence.ts:112`, also requires `admission`, which excludes engaged members.
- Known limit: `round.ts:74-75` throws `precondition_failed` when the job's NPC ref differs from the primary's, which would fault every later settlement. Safe now: a roster is one plan (`packMember` requires the same `by`), one plan has one bundle, one bundle one NPC definition. 6c (one plan) inherits safety; 6b must re-point the job on a switch (or check dispatch against the roster) and keep allies out of `retarget`.
- Save/replay: no new MutationTarget kind or section; the row shape is unchanged. The only host op-name reader, `mobile/authority/local-story/narration.ts:72`, routes `primary_changed` through `packKeys`. No `lib/` caller recomposes mobile receipts.

## Findings

1. **blocker**, `protocol/fixtures/c4_pack_composition.json:1655` with `compose_encounter.ts:191`, `compose_encounter.ex:139`, `invariants_encounter.ts:114`, `invariants_encounter.ex:120`: the active-member guard cannot fail in any of the four sites. Each mutant that drops the membership conjunct stays green. `target-must-be-active-member` names `00000009`, an unknown entity that the presence check already refuses. Failure scenario: a roster pruned to `[3]` after hound 4 fled and later wandered back; hound 4 is a present slot member, not active. With the TS composer conjunct dropped, `encounter.target npc_id=4` composes and makes a non-roster hound the primary (probe run). Fix: point that case at a present non-roster member of the same plan (roster `[3]`, target 4), with its counterfeit. This one case kills all four mutants.
2. **should-fix**, `kernel/ts/src/commands/actions.ts:165`: `> 1` changed to `> 0` survives. Spec (`mechanics.md:2041`): a single-foe fight keeps today's ActionSet. Failure scenario: an opted-in roster shrunk to one member offers Attack rows (all unavailable) beside Flee, and the GameView changes. Fix: add one assert to `targets.test.ts` (kill one goblin, or admit a roster of one; Attack is not offered).
3. nit, `docs/system/book-ui.md`: no Book rule for the new in-fight Attack choice; it is tracked as designer wording in `loka-x6t.14`. Land it with the batch, or record the deferral in the row's status.
4. nit, handoff: the developer's `/code-review medium` result is not reported. Put it in the batch PR body.

Open (not findings): INSTALLED 1.48 skips 1.47 (merge note vs M6); 6b/6c obligations above.

## Re-check: fix round 1 (`2a522475`)

Scope: commit `2a522475` only (record cherry-picked as `68bbc081`). Hosted ci and book-e2e green (PM). Verdict: **APPROVE WITH NOTES**.

- Finding 1 resolved. New state `target_pruned` (roster `[3]`, primary 3); `target-must-be-active-member` now targets present same-plan hound 4, and its counterfeit was updated. A semantic diff against `7099c640` shows only the new state and that one case changed; that case's `expected` (the fault) is unchanged, and every other case is byte-equal. The four membership mutants are now killed: Elixir composer (`c4_pack_composition_test.exs`, exit 2), TS composer and TS invariant (`c4_pack_composition.test.ts`, exit 1), Elixir invariant (exit 2, `mix test --force`).
- Finding 2 resolved. `targets.test.ts:99-102` asserts that a roster of one offers no Attack; mutant `actions.ts:165` `> 1` to `> 0` killed (exit 1).
- At head: `targets.test.ts`, `c4_pack_composition.test.ts` and `c4_pack_composition_test.exs` pass.
- Nits 3 (Book rule, `loka-x6t.14`) and 4 (`/code-review` result in the batch PR body) remain open for the batch.
- PM rulings recorded: a stale roster count between rounds after a death is accepted for 6a and carried to 6c; the duplicate Elixir floor diagnostic is harmless (`loka-2bt2`).
