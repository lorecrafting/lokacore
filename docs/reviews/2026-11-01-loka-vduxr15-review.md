# Review: sleeper at hp floor wakes, mutate.sh per-mutant limit, PR #567 (loka-vduxr.15, kernel_api 1.142)

- PR [#567](https://github.com/lorecrafting/lokacore/pull/567) `engine/fault-followups` at `c0cd29bca3a9dbbd3e2a7b3c3339e592704d1a91`.
- Governing: [mechanics.md combat rounds](../system/mechanics.md#combat1--first-live-encounter-m6-a) ("Positive damage to a sleeping player ... wakes a survivor"), `bin/mutate.sh` header, [contracts lessons](../lessons/contracts.md).
- Reviewer: independent; authored none of the work.
- **Verdict: APPROVE WITH NOTES.**
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.

## Must be true

1. A blow clamped to 0 at the hp floor wakes the sleeper; a miss or prevented hit does not.
2. No sampler, showcase or transcript output changes; only the `kernel_api` pin moves in live saves.
3. A mutant timeout kills the command's whole process group, also on interrupt, and signals nothing else.
4. `kernel_api` is main+1 at merge.

## Checks run

- combat, sleep, transcripts (all example transcripts replay), 12 showcase files, live, sim showcase: pass; no transcript, fixture or hash file in the diff, so output equals the merge base.
- mutate.sh: timeout leaves no orphan (nested background child too); TERM to the process group exits 130, restores the file, prints no result line; the kill targets only `-$child`, a group the child leads. `integration_red_controls.sh` passes.
- Mutants on `round_attack.ts:92`: removing the wake survives nothing (test fails); dropping `hit` survives combat, sleep, transcripts, showcase_combat, showcase_world; dropping `sleeping` survives too.

## Findings

1. **should-fix** `round_attack.ts:92`, `combat.test.ts:121`: nothing fails when the wake fires on a miss (`!loss && sleeping`) or on a standing target. A missed or defended blow at a sleeper then wakes it, against "Stop after an accuracy miss ... no wake". Add one miss-at-floor assertion (sleeper stays asleep).
2. **question** `round_attack.ts:92`: the spec says positive damage wakes. A hit resisted or authored to 0 damage, not at the floor, now also wakes (the PR disputes this). No docs/system text changed; state the choice in mechanics.md or narrow to `damage > 0`.
3. **nit** `integration_red_controls.sh` `pgrep -f 'sleep 1234'` matches any process on the host; use the exact PID.
4. kernel_api: 1.142 is main+1 only while main is 1.141; if main has bumped, the fix needs main+1 (rerun `bin/regen.sh`).
