# E2 S0 runner second candidate: second opinion

- PR #312, branch `e2/s0-runner-second-candidate`, reviewed head `2f1bcd70b38710c9ff7fc673382062c7add6efeb`, base main `c44a44c3`.
- Reviewer: Opus second opinion, independent of the main reviewer. Angle: certification integrity.
- Governing: [E1 exact candidate proof policy](../system/e1-certification.md#e1-exact-candidate-proof-policy); brief E2 S0.
- **Verdict: APPROVE WITH NOTES.**

## Must be true (written before the diff)

1. Only the two literal rows admit; a missed id, another version or another content hash refuses.
2. The row is chosen by the admitted id; compile source, content test and report `candidate` all come from that row.
3. No r9c run yields a report or recorder pass that reads as chapter evidence.
4. `POLICY_HASH` is unchanged; the v042 candidate block is unchanged.
5. The E1 receipt `docs/evidence/2026-10-07-e1-coverage-complete` still resolves.

## Results

- 1, 2: `e1_policy.ts:93-95` selects by id, then requires version and hash of that row. `e1.ts:159,220-221,252-254` use `loaded.row`. `sourceMatches` (`e1.ts:164`) recompiles the selected row's source, so a crossed source fails, never passes.
- 3: Recorder on r9c bytes at this head: exit 1, `invalid disposition /dialogues/ashmere_missing_child@0.0.42:…`, no output dir. Runner `status` is only `fail`/`pending` (`e1.ts:248`). Repro binds `content_hash` (`e1_repro.ts:77`).
- 4, 5: At this head `POLICY_HASH` = `02d71791…`, v042 admission gives `5d8b0e3a…` and artifact `1c53bcd8…`, equal to the receipt's `report.json`; `shasum -a 256 -c SHA256SUMS` exit 0.

## Mutants (`e1.test.ts`, detached worktree, removed)

| Mutant | Result |
|---|---|
| drop hash compare | red (2) |
| `if (row && (…))` | red (1) |
| miss falls back to row 0 | green; equivalent (hash still refuses) |
| drop version compare | green; equivalent (content hash covers manifest, test B) |
| report `candidate.id` hard-coded to v042 | **green** (N1) |
| compile source hard-coded to v042 | green; safe direction (r9c report fails) |

## Findings

- N1 (nit) `kernel/ts/test/e1.ts:252-254`: no test pins the report `candidate` block to the selected row; the hard-coded-id mutant stays green and an r9c report would name `ashmere_missing_child` beside r9c's hash. The brief chose a manual receipt here (PR body receipt 1 shows `candidate.id` `r9c_interactions`). Ask S5 to assert `candidate.id` on its retained report.
- N2 (nit) `kernel/ts/test/e1.ts:276`: `INDEPENDENT_REVIEW` reason "final published A-D plus fixes candidate" is chapter wording on an r9c report; same class as the known `deployment.reason` item, fold into that fix.

## Fix round 1 at `ac2ca37e`

Scoped to the dispositions and their direct callers (`reportOf`: `certify` and `e1.test.ts` only).

- N1 fixed: `reportOf` exported (`e1.ts:237`); test A asserts the r9c report `candidate.id` and `content_hash`. Re-ran mutants: hard-coded chapter id: only A red (exit 1); hard-coded chapter content hash: only A red.
- N2 fixed: `e1.ts:276` reason is candidate-neutral. Also `e1.ts:263` `deployment.reason` is "private candidate; no deployment identity", which matches the spec's "no deployment identity; record the reason".
- Spec `:19` wording ("the admitted candidate's forms") keeps the meaning.
- **Verdict: APPROVE.** Nothing open.
