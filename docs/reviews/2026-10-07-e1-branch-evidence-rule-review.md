# E1 branch evidence rule (`any`/`not` policy descendants) — independent review, 2026-10-07

- Branch: local `e1/branch-evidence-rule` (not pushed), for draft PR #288.
- Reviewed head: `babf34c31686d4260ab1b2f39cbbac7d02f98755` (spec `4850b71e`, code `204dbe8c`, merged with #288 head `c04aef98`). Slice diff: `git diff c04aef98 babf34c3`.
- Governing: [owner decision](../decisions/owner-decision-e1-branch-evidence-2026-10-07.md), [architecture.md#e1-policy-branch-evidence](../system/architecture.md#e1-policy-branch-evidence), [E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md), AGENTS.md Writing tests.
- **Verdict: APPROVE WITH NOTES.**

## Requirements written before reading the diff

1. An `any` child is credited only if it evaluates true itself, at the state the runtime judged at the accepted action (owner (a)).
2. A node under odd `not` depth is never credited; `not(not X)` credits only X when true (owner (b)).
3. The rule is defined once; talk, perform, quest objective and journal link to it.
4. Credits are recomputed in replay and accepted only when the retained step receipt also records them.
5. Dispositions are `{path, reason, evidence, review}` rows, reported apart from witnessed paths, and never counted as witnessed. No refusal credit.

The diff meets all five. The rule is defined once, and all four witness clauses link to it. `e1_policy.ts` is not in the diff. Replay (`e1_cases.ts:108-109`) intersects the recomputed paths with `e1.obligations`.

## Evidence

- `node --test kernel/ts/test/e1*.test.ts`: 42/42 pass. `npm run typecheck`: exit 0.
- `e1_cases.ts` on the v042 artifact: exit 2, 23 cases pass, 129 pending, 0 dispositioned, 519 witnessed. Against `pending-ff63b598.txt`: 157 − 129 = 28 = the 6 debt paths (`a_aldric_debt/choices/late` + 2 sequence steps, `a_peg_debt/choices/accept_late` + 1 step, `a_peg_debt/choices/elapsed`) + exactly the 22 named paths. No path was added.
- Polarity audit of all 218 witnessed policy paths against the v042 trees: 0 sit at negative polarity.
- An invalid row (`/nope`) gives exit 1, `invalid disposition /nope` on stderr, and no `report.json` or `SHA256SUMS`. I judge this sound: the spec says such a row "fails the run". A config error does not become a candidate report, and the output directory is visibly incomplete.

## Mutants (throwaway worktree, since removed)

| Mutant | Failing test |
|---|---|
| credit `any` children without evaluating them | only the true child of an any objective; bell assignments |
| credit negative polarity | negated guard; double not; not(all) |
| drop the polarity flip | double not; not(all) |
| `not` child keeps the parent's value | double not; not(all) |
| root not checked | only the true child of an any objective |
| objective always judged after / always before | dialogue-resolved objective / bell assignments |
| perform judged on the after state | study_tracks recipe |
| disposition merged into witnessed / left pending / witnessed check, field check or duplicate check removed | disposition reported apart |

Survivors: talk judged on the after state, and perform without a target. Both leave the recorder at 129. They are equivalent on v042: no v042 policy uses `target_present`. Recorder mutant runs bypassed the dirty-tree guard and are not evidence.

## Findings

1. **should-fix**, `kernel/ts/test/e1_obligations.ts:43`, and the matching sentence in `architecture.md` ("the state before the command when the root held there, else the committed resulting state"). This picks a state by inference. It is not the state the runtime judged.
   - Reaction resolution (`mechanics/reaction.ts:156`) and scene, patrol and expedition resolution judge the objective mid-command, after effects.
   - Failure case: an objective `any(A, B)` is resolved by a reaction, and A held before the command. The command makes A false and B true. The code then credits A, which was false at resolution, and leaves B pending. This breaks (a).
   - "Committed resulting state" can also differ from the reaction's evaluation point if a later reaction step in the same command changes a fact the objective reads.
   - No effect on v042, verified: the bell is the only reaction-resolved `current_state` objective. Ring and silence both require `chapel_allegiance = unknown`, so the bell root cannot hold before the command that resolves it. Dialogue resolution (`dialogue/rule.ts:233`) judges the pre-choice state.
   - Fix: choose the state by resolver kind, or, when the root holds in both states, credit only the paths credited in both.
2. **nit**, `kernel/ts/test/e1_cases.ts:272`: merging `dispositioned_obligations` into `witnessed_obligations` in the report passes every test. The disposition test covers `gaps()` only, and the table is empty. Pin this when the first row lands.
3. **nit**, `kernel/ts/test/e1_cases.ts:259`: the row checks run only after all 23 cases. The unknown-path, field and duplicate checks could run before any case.

No over-engineering: one walker replaces `requiredPolicyPaths`, and the table is a JSON file bound into the `check_hash` source identity (`e1.ts:48`).

## Fix round 1: head `47dd57c3` (fix `5c5370ff`, then merge of #288 head `d640c318`)

**Verdict: APPROVE.** Every disposition below is verified.

- **Finding 1 closed.** `objectivePaths` (`e1_obligations.ts:369-379`) credits only the paths credited in both states when the root holds in both, and uses the single state where the root holds otherwise. The spec sentence in `architecture.md` now says the same.
  - The plant `before = prior`, `after = fox` over the bell root expects `['r']`.
  - These mutants fail that test: prefer-before (equivalent to the old code), prefer-after, and union.
- **Finding 2 closed.** The report is now built by `obligationReport` (`e1_cases.ts:151`). These mutants each fail "E1 reports a disposition apart…":
  - dispositions merged into `witnessed_obligations`;
  - dispositions left in pending;
  - the witnessed-row check removed;
  - the known-path check removed.
- **Finding 3 closed.** `checkDispositions` runs before the output directory is created (`e1_cases.ts:206`). With an invalid row the recorder exits 1 in under 1 s and creates no output directory.
- **Merge, `e1.ts` `CHECK_FILES`.** Keeping `e1_dispositions.json` in it is correct: the table changes the report, so it must change `check_hash`. The import-walk test only requires imported modules to be a subset of `CHECK_FILES`, so a JSON entry passes, and it does pass.
- **Merge, creatures reaction paragraph.** It is kept, with one added sentence linking to the rule. `e1_creatures.ts:200` credits only `/when/root`. Per the PM decision, extending the rule below reaction roots is not a finding.
- **Reruns.**
  - `node --test kernel/ts/test/e1*.test.ts`: 47/47 pass. Typecheck: exit 0.
  - `e1_cases.ts`: exit 2, 25 cases pass, 95 pending, 553 witnessed, 0 dispositioned.
  - Polarity audit: 0 of 219 credited policy paths sit at negative polarity.
- **Question (residual, not reachable in v042).** When the root holds only before the command, the before state is used. Suppose a reaction resolves mid-command and a later step in the same command then makes the root false. A branch false at resolution could then be credited. The retained step receipt has no mid-command state, so this is the closest replay-derivable rule.

The mutant worktree was removed, and its runs are not evidence.
