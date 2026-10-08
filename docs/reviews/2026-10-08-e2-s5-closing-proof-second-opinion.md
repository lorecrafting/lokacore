# Second opinion: E2 S5 closing proof (PR #321, draft)

- PR #321, branch `e2/s5-closing-and-gate`, head `266fa6b20761f96b1841845c179cb7a312181db9`. Draft lane, no hosted CI. Second opinion (Fable), independent of the Opus primary.
- Angle: claim integrity of the whole E2 proof. Governing: [slice plan](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md) Goal, exit criteria 3-7, Gate; [E2 brief](../briefs/chapter-one/chapter-one-e2-r9c-interactions-brief-2026-10-05.md) acceptance 3-7, handoff :117; [evidence lessons](../lessons/evidence.md); [owner decision](../decisions/owner-decision-e2-plan-2026-10-07.md) (a), (b); `save.md` "Commit, fence, reconcile".

## Verdict: APPROVE WITH NOTES

## Must be true (written before the diff)
1. Claim limited to "applicable R9C headless interaction evidence"; nothing reads as chapter, native, browser or product proof.
2. Runner values recomputed from the retained `report.json`: exit 2, `pending`, null verdict, the literal id/version/hash, five receipts at 0, 100 sequences, four pending gates, clean `source_sha`.
3. Coverage table keyed by `applicability`; no locked-only capability counted; deer counted once (Oak) on the authority; C4 named as new detection; S3 candidate 2, route-cursor retry and crow pickup as "already caught"; browser and native rows named pending.
4. Planted defect reachable, focused suite green, one named r9c scenario red with a literal wrong result and invariant; restore clean.
5. F1-F4 rows with literal prior/next outcomes, deterministic kills, red controls recorded with restore 0.
6. Hashes verify, SHA256SUMS not self-listed, redaction grep empty, every count recomputed from a hashed file.

## Checked (detached worktree at `266fa6b2`, removed)
- `shasum -a 256 -c SHA256SUMS`: 36/36 OK; the two unlisted files are SHA256SUMS and its verify. Redaction grep over the folder: only hit is the retained grep's own command line.
- `report.json` recomputed: status, verdict, candidate, `source_sha` `7a734d92`, receipts `[0,0,0,0,0]`, `simulation` pending/100/no repro, pending gates exactly the four. 980 uses, 130 features, 36 `capability@1`, 47 `command.*`, 9 gates, no dependency rows. Every class count in README §4 (room 26 … reaction 24) recomputed and equal.
- `sqlite.log` 486 dots = 474 focused + 12 r9c; `kernel.log` 915 = 906 + 9. Focused file lists equal `find` minus `r9c_*` (kernel recursive 169; authority top-level 67, the runner's own `e1.ts:232` glob).
- Coverage rows: the 11 "pending" commands have zero press sites in the eight r9c files; `perform`, `talk`, `use_service`, `use_transport`, `expedition` are the payload types behind recipe, dialogue, service (`view/services.ts:36`), transport (`view/transports.ts:13`) and expedition keys that the cited tests press; `run_job` is built inside elapsed (`runtime/proposal.ts:270`). Haggle at K custody `:121`; both deer orders at K elapsed `:405-419`; Oak only at A elapsed `:297-305`.
- Planted defect: `mutant.diff` is `policy.ts:44-48`; the r9c cartridge gates `a_elspeth_rescue` on `escort_state: following` and the hound death reaches `separated` by legal play (A creatures `:262-306`). `red.log` shows exactly one failure at `:306` (`true !== false`); `restore.log` clean. I also ran the four `__tests__/*.test.ts` outside the runner glob under the mutant: 4/4 green, so the "focused suite misses it" claim holds for the whole authority tree. Note: `cartridges/ashmere_missing_child/dialogues/a_elspeth_rescue.json:30-32` uses the same policy, so the defect is reachable on the chapter too and still missed by its 906 + 473 tests; a real new detection.
- Fault rows: `r9c_faults.test.ts` run once at head, 4/4 green. I reapplied `rc1-memory-before-commit.diff` myself: 4/4 red at `:213`, `:242`, `:291`, `:324`, restore clean. "next" is the fault-free run on a byte copy, the pattern of `faults.test.ts:214` `reference(seed)`; the row's outcome is the literal `'prior' | 'next'`, and the two kill flips prove the outcomes are distinguishable. Duplicate retry asserts `replay`, stable revision and unchanged rows (`:193-200`).
- Five guard breaks, traced through merged records: memory before failed COMMIT, S2 M1 and S5 rc1; export before final acknowledgement, S2 M3 (kernel `:288`, authority `:308`); remove a source custody debit, S3 M2 (`service/shared.ts:105`, both S3 files red); mutually exclusive terminal change, S2 M2 is green on r9c and linked to `missing_child_bell.test.ts:136`; provenance/cap, S4 cap linked to existing cap tests, crow origin guard known untested (loka-zfq). Seven families: kernel 1, 2, 3, 4 (two tests), 5 (two tests); authority 1, 2, 3, 4, 5 (two), 6-7 (one test), plus D1.
- C2 comment and the brief index line are the only non-evidence edits; no source, cartridge or runner change.

## Findings
1. **nit** `docs/evidence/2026-10-08-e2-r9c/README.md:55-57`: "one generic `row()` checks every fault: fenced calls answer `pending`" reads as if every row exercises the fence. Only the `failed` and `lost` rows do (`r9c_faults.test.ts:168-172`: F1 `:234-235`, F3 `:317`, F4 `:335`); F2 has no fenced row, because its COMMIT failure is reconciled in the call and the kills end the process. Say "the failed and lost rows" so the lifted gate report does not overstate.
2. **nit** `README.md:137-140` "Feature gates (9)": listing evidence under each gate name can be read as the gates being met, while the report's own status is pending. Label the paragraph as "evidence that touches each gate; disposition pending".
3. **Open item for G, not S5** (criterion 5 is outside S5's brief): the README has no criterion-5 row, and the five breaks are traceable only through the S2/S3/S4 review tables as listed above. The gate checklist should carry that table, with the terminal-exclusivity and cap rows marked "linked to chapter tests" and provenance "known untested".

No blocker. The claim statement (`README.md:6-8`) is exactly the brief's handoff claim.
