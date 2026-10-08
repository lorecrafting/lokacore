# E2 gate checklist

Milestone gate ([workflow](../../WORKFLOW.md#milestone-gate)) for E2, [slice plan](chapter-one-e2-slice-plan-2026-10-07.md) "Gate" and G.
Checked by one reviewer. Proof is in the merged slices, the [S5 evidence](../../evidence/2026-10-08-e2-r9c/README.md)
and the review records. Slices: S1 [#309](https://github.com/lorecrafting/lokacore/pull/309), S0
[#312](https://github.com/lorecrafting/lokacore/pull/312), S2 [#314](https://github.com/lorecrafting/lokacore/pull/314), S3
[#316](https://github.com/lorecrafting/lokacore/pull/316), S4 [#319](https://github.com/lorecrafting/lokacore/pull/319), S5
[#321](https://github.com/lorecrafting/lokacore/pull/321). `certification_verdict` stays null: E2 is not a certificate.

## Exit criteria

| # | Criterion | Proof |
|---|---|---|
| 1 | Admission | S1 #309 ([review](../../reviews/2026-10-08-e2-s1-synthetic-cartridge-review.md)); S0 #312 for the runner side ([review](../../reviews/2026-10-08-e2-s0-runner-candidate-review.md), [second opinion](../../reviews/2026-10-08-e2-s0-runner-candidate-second-opinion.md)) |
| 2 | Seven families, kernel and authority | S2 #314 ([review](../../reviews/2026-10-08-e2-s2-custody-terminal-review.md)), S3 #316 ([review](../../reviews/2026-10-08-e2-s3-elapsed-jobs-review.md)), S4 #319 ([review](../../reviews/2026-10-08-e2-s4-creatures-transport-review.md)) |
| 3 | Runner report | S5 #321: [report and coverage table](../../evidence/2026-10-08-e2-r9c/README.md) (sections 1, 2, 4) |
| 4 | Planted defect | S5 #321: found, `mechanics/policy.ts:44-48` ([section 3](../../evidence/2026-10-08-e2-r9c/README.md)) |
| 5 | Guard sensitivity | [table below](#criterion-5-guard-breaks) |
| 6 | Real SQLite faults | S5 #321: [section 3](../../evidence/2026-10-08-e2-r9c/README.md), rc1 to rc4 and both kill flips red |
| 7 | Browser rows | Named pending (owner answer (a)); Hermes and native pending: [section 6](../../evidence/2026-10-08-e2-r9c/README.md) |
| 8 | Standing corpus in CI | The `r9c_*` files run in the `typescript` job and `bin/check_all.sh`; exact-head CI on #321 is the merge condition |

Reviews of S5: [Opus](../../reviews/2026-10-08-e2-s5-closing-proof-review.md), [second opinion](../../reviews/2026-10-08-e2-s5-closing-proof-second-opinion.md).
Gate audit of S0-S4: [Fable, PASS WITH NOTES](../../reviews/2026-10-08-e2-gate-fable-audit.md).

## Criterion 5 guard breaks

| Break | Catching test | Status |
|---|---|---|
| Remove a source custody debit (`service/shared.ts:105`) | both S3 files red (S3 review M2) | E2 row |
| Memory adopted before a failed COMMIT (`save.ts`) | authority `r9c_custody_terminal.test.ts:323` (S2 M1); all four `r9c_faults.test.ts` rows (rc1) | E2 row |
| Export before the final acknowledgement (scene `on_end` at line 1, `scene/rule.ts:30`) | kernel `r9c_custody_terminal.test.ts:288`; authority `:308` (S2 M3) | E2 row |
| Mutually exclusive terminal change allowed (`policy.ts:39`) | green on r9c; `kernel/ts/test/missing_child_bell.test.ts:136` red (S2 M2) | linked to chapter/focused test |
| Omit provenance / cap | cap: existing cap tests fail under the cap mutant (S4 review); crow origin guard `crow/shared.ts:74-80` | cap linked to focused test; provenance known untested (loka-zfq, [#320](https://github.com/lorecrafting/lokacore/pull/320)) |

## Carries

Each is in a stage row or tracked; none blocks the gate.

- 11 commands no r9c scenario invokes (look, scan, sell, give, lock, unlock, remove, sit, sleep, close_choice, accept_quest): named pending, evidence section 4.
- Browser rows for families 1-7: pending, "no harness loads a non-bundled artifact" (owner answer (a)); Hermes, native SQLite, native lifecycle, accessibility: pending under the mobile pause.
- PATH_COVERAGE, INDEPENDENT_REVIEW, BROWSER_HUMAN, NATIVE gates and the 10,000-sequence run: release-candidate work.
- Crow origin guard untested: loka-zfq.
- Forged deadline conditions: loka-2gr, PR #320.
- Paired-job completion invariant: held by focused tests, not an E2 row ([evidence section 4](../../evidence/2026-10-08-e2-r9c/README.md)).
- World time advances during the ancestry screen (`runtime/world.ts:126-131`): loka-8mm, a polish-phase designer question.
- The recorder is v042-only by design and refuses r9c bytes ([e1-certification](../../system/e1-certification.md)); the coverage table is built by hand.

## Owner touch

Owner answer (b): a short report. The PM writes it after merge; the owner does not play E2.

## Docs tidy pass

Checked over the docs E2 changed (`system/cartridge.md`, `system/e1-certification.md`, the E2 brief and slice plan, `ROADMAP.md`, the chapter-one briefs index, the E2 evidence README), not archive, reviews or decisions:

- One fact, one place: the r9c content hash and the two runner candidates are stated in full in `cartridge.md` and abbreviated with a link in `e1-certification.md`; the ROADMAP no longer lists the E2 slices (this file does), so the PR list exists once.
- Stale text: the ROADMAP "E2 and E3 remain open" and "31 of 33" are fixed. The slice plan's owner questions are already marked answered.
- Lessons: `docs/lessons/*` hold nothing E2-specific to retire or to enforce by a check; the E2 lessons already live in `AGENTS.md` ("one test per break per layer") and `lessons/evidence.md`.
- Catch-all: `cartridge.md` gained one section (R9C, about 30 lines) and stays one topic. No doc grew a second purpose.
