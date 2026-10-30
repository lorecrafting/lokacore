# Review: batch C3 final head (loka-ivjq.4 F4 one step and one check vocabulary)

- PR #495, branch `simplify/c3-steps`, reviewed head `684787658d10012553e5ff5e7f62e276bdd3e247` against `main` (merge base `f24b591f8`; 924 files, +9,964/−9,243).
- Governing: `br show loka-ivjq.4` (F4: one Step and one Check for reactions, scripted actions, dialogue choices, service benefits; recipe becomes scripted action; `event.emit` joins reaction steps), the C3 plan decisions D1–D11, AGENTS.md, [WORKFLOW review stance](../WORKFLOW.md), [two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md), [cartridge](../system/cartridge.md#steps-and-checks), [architecture: composition](../system/architecture.md#building-mechanics-by-composition).
- Reviewer: anthropic/claude-fable-5-1, independent, authored none of the work; the slice records (P, R, A, B, C, V, Z) were read after the must-be-true list.
- CI on the head (`gh run list --commit 68478765…`): graph-diff success (40994138729), ci success (40994134118), book-e2e success (40994134086).
- Verdict: **APPROVE WITH NOTES** (no code change made; follow-ups below for the PM).

## Must be true (written before reading the diff)

1. Merge gate: every shape main's per-context schemas refused is still refused at compile on the head, at the same path kind (op outside the context's subset, field outside the op's allowed set, `failure` or `rating` on an action or choice check, unknown op). Nothing main refused is accepted.
2. Rule order and event positions are unchanged (D7): transcripts, live saves and story views differ from main only by hashes and the renamed keys (`kind`→`op`, `recipe`→`scripted_action`, `effects`/`benefit` field names).
3. `COMPOSES.reaction` gaining `scripted_action` changes admission only; no decide path reads it.
4. No save field changed; GameView changes only `ServiceOffer.benefit.kind`→`.op`; command, delta, event schemas unchanged in shape.
5. Each kernel applier that fails closed on a step or check the compiler should have refused throws `KernelError('precondition_failed')` and has a test that goes red when the throw is removed.
6. `steps.ex` runs all three of `missing`, `unrun`, `refs` on every step list; an unknown op is refused, not skipped.
7. `docs/system/cartridge.md` op table equals `steps.ex` `@ops` row for row (contexts and allowed fields).
8. No stale fixture (regen is a no-op), no dead per-context check code, no test that asserts nothing.

## Evidence

1. 46 compile probes (the 9 P-review finding-1 shapes plus ≥6 per context: reaction, action, choice, service) run through `Loka.Content.compile` on a detached head worktree and on main: identical accept/refuse status for all 46. Head refuses the 9 P shapes with SCHEMA_VIOLATION at `steps[0].op`, `steps[0].npc`, `check.failure`, `check.rating`. Only `a_event_emit_unknown`, `r_empty_steps` and the control compile on both. Head adds one refusal main lacked: service `build` without `site` → SCHEMA_VIOLATION missing_property at `benefit.site` (documented in cartridge.md). Holds.
2. 43 changed or renamed transcripts are byte-identical to main after normalising 64-hex hashes and the renamed keys. Live saves differ only in `capability_lock` key order (sort position of `scripted_action`). Story views `item-container.json`, `item-too-heavy.json`, `npc-services.json` differ only by `kind`→`op`. Holds.
3. `kernel/ts/src/runtime/decision.ts:218-235` `COMPOSES` is read by `runtime/proposal_admit.ts:15` `admit()` and the `Composed` type only (`mix xref`-equivalent: grep over `kernel/ts/src`). Diff vs main: rename `action_recipe`→`scripted_action`, the reaction row addition, comments. Holds.
4. `protocol/gameview.schema.json` diff: `ServiceBenefit` replaced by a `$ref` to `step.schema.json#/$defs/Step`, example `kind`→`op`, enum reformat, wording. `command`, `delta`, `event` schemas: description text only. No save schema field changed. Holds.
5. Five guards: `mechanics/reaction.ts:329-330` (op outside reaction subset), `mechanics/scripted_action/rule.ts:275-276` (op outside the applier's subset), `mechanics/dialogue/sequence.ts:73-74` (default step), `sequence.ts:99-101` (check not opposed or no `failure`), `mechanics/service/shared.ts:104` (benefit op not meal/drink). Each goes red under a hand mutant (below). Holds.
6. `lib/loka/content/steps.ex:74` unknown op → `[invalid(rel, path ++ ["op"])]`; `:77-78` `missing(...) ++ unrun(...) ++ refs(...)`. Hand mutants on `:74` and the action `fact.assign` field set go red. Holds.
7. `docs/system/cartridge.md:245-269` table vs `steps.ex:14-51` `@ops` and `@required`: every op, context and field list matches, including service `build` needs `site`. Holds.
8. `bin/regen.sh` on the head exits 0 with a clean tree. No `choice_checks.ex`; `scripted_actions.ex` delegates to `steps.ex`/`check_kinds.ex` with no per-context duplicate. `ServiceBenefit|RecipeStep|ActionRecipe|action_recipe` has 0 hits in `lib`, `kernel/ts/src`, `protocol`, `schemas/source`. Assert count −36/+71; the four test files whose remaining asserts look thin (attributes, quests, schedule, trial) are rename-only diffs, pre-existing at main. Holds.

Record claims rerun: (a) `kernel/ts/test/scripted_actions.test.ts:208` cites `world.ts:147` for "a KernelError while deciding is an `evaluator_error` fault with the world unchanged": `kernel/ts/src/runtime/world.ts:146-147` says so and the test observes it. (b) cartridge.md "service `build` needs `site` (SCHEMA_VIOLATION missing_property)": probe `s_build_no_site` reproduces it at `services/stew.benefit.site`. Both hold.

## Tests of the tests

- `bin/mutate_diff.sh origin/main` (niced, one sweep): 509 mutants, 428 runnable. Stopped at the PM's order at the timebox after ~130 rows: 84 red-narrow; 37 SURVIVED, all in carried-over logic (31 in `scripted_action/rule.ts`, whose whole file counted as new after the rename: cast target, DRAWS, budget codes, fact tip; 3 in `fact.ts` `b.op === 'deposit'|'withdraw'` renamed key; 1 `reaction.ts` replenish `then` arg; 1 `cartridge_position.ts` entitlement tip, already loka-kl1u; 1 `cartridge_scoped_facts.ts` repair key); 0 survived in new logic. 307 rows unrun, including every new-logic file: `scripted_action/shared.ts` 68, `service/shared.ts` 53, `resolve.ex` 43, `rule.ts` 24, `check_kinds.ex` 18, `scripted_actions.ex` 12, `service/build.ts` 11, `steps.ex` 2.
- Hand mutants on the new logic the sweep did not reach, in a detached worktree at the head, each restored (all red-narrow):
  - M1 `steps.ex` action `fact.assign` fields `~w(fact value)`→`:any`: content steps/scripted_actions/choice_checks tests red.
  - M2 `check_kinds.ex:53` drop `failure` from the action forbidden list: red.
  - M3 `steps.ex:74` unknown op → `[]`: red.
  - M4 `reaction.ts:330` throw → `return undefined`: `reactions.test.ts` red.
  - M5 `scripted_action/rule.ts:276` throw → `return r`: `scripted_actions.test.ts` red.
  - M6 `dialogue/sequence.ts:74` throw → `return run`: `dialogue_checks.test.ts` red.
  - M7 `dialogue/sequence.ts:99` guard → `if (false)`: red.
  - M8 `service/shared.ts:104` guard deleted: `service.test.ts` red.

## Findings

1. **Should-fix (follow-up, not C3's logic).** `kernel/ts/src/mechanics/scripted_action/rule.ts` carried-over logic: 31 sweep survivors (cast target choice, DRAWS table, budget refusal codes, fact tip). Scenario: swapping the cast target or a budget code changes which actor a scripted action hits or which refusal the Book shows, and no kernel test notices. Pre-existing at main under `action_recipe/`; file one issue listing the survivor lines from the sweep output.
2. **Should-fix (pre-existing).** `kernel/ts/src/mechanics/dialogue/sequence.ts:99-101`: the `check.kind !== 'opposed'` half is covered only jointly with the `failure === undefined` half (`dialogue_checks.test.ts:171-184` plants a luck check with no failure). Scenario: a future edit that keeps the failure half but drops the kind half stays green. One case with `kind: luck` plus a `failure` closes it (C review noted, `mutate-skip` comment present).
3. **Should-fix (B follow-ups, carried).** `lib/loka/content/construction.ex:81` and `lib/loka/content/leaf_refs.ex:52`: a bad `build.structure` reports SCHEMA_VIOLATION and UNRESOLVED_REFERENCE at the same path; `steps.ex:75-78` reference-checks a field it already refused. Scenario: one typo yields two findings; authors fix the first and are surprised by the second. Dedupe or order the passes.
4. **Nit.** PR #495 body reports no `/code-review` result and its slice checklist is stale (only R ticked; all seven slices merged). Note it on the PR at merge.
5. **Nit.** `bin/mutate_diff.sh` counts a renamed file (`action_recipe/`→`scripted_action/`) as wholly new: 24+68 rows of carried-over logic queued ahead of the batch's new checks, so a 45-minute sweep never reached `steps.ex` or `check_kinds.ex`. Add `--find-renames` awareness or order new-file rows after changed-line rows (same family as the C2 final nit 4).

## Follow-ups for the PM

- Finding 1: file the `scripted_action/rule.ts` survivor list (cast/DRAWS/budget) as a test-gap issue.
- Finding 2: `sequence.ts:101` kind-half case in `dialogue_checks.test.ts`.
- Finding 3: B follow-ups 1–2 (duplicate finding on bad `build.structure`; refused field still reference-checked).
- Finding 5: mutate_diff rename ordering; fold into the C1 final two-hop follow-up.
- P's routed survivors M3/M5/M7 are covered by P's in-place fixes; my sweep did not reach them, hand mutants M1–M3 cover the same `steps.ex`/`check_kinds.ex` logic.
- loka-kl1u: `cartridge_position.ts` entitlement tip survivor stays as recorded.
