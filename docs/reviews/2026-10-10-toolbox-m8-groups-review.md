# Review: a round joins all its rows' writer groups; sight handoff check scoped (loka-x2gv, loka-kgd.43, toolbox M8)

- Branch `toolbox/m8-groups` (no PR), head `88f0422cc6bcedd05b63e13f195612deeeabadc9`, base `origin/toolbox/batch-m8` (merge base `15c5af9f`, 8 files). Kernel proposal contract (writer groups) and protocol.md amendment, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [mechanics.md](../system/mechanics.md) job writer-group rule (`job_complete_owned_by_run` paragraph) and row 6b "Writer groups"; [protocol.md](../system/protocol.md) D7 round-to-sight handoff and C5 bleed pair clause; Beads `loka-x2gv`, `loka-kgd.43`.
- Hosted CI on the head: ci and book-e2e, both success.
- Verdict: **APPROVE WITH NOTES** (one should-fix, two nits, no blocker).

## Must be true

1. A round whose body, roster members and bleed pair already hold different groups writes all of them in one group; every earlier write in the merged groups takes that number, and no unmerged group can still write those rows (`conflicting_write` for a third writer stays).
2. Merging is deterministic and changes no committed rows; persisted receipt groups stay valid for save recovery and Chapter 1 receipts are unchanged; per-target single-group (`no_last_writer_wins`, both kernels) still holds.
3. After a sight completion, only the handoff pair may write the sighted member's encounter in an older group; status-holder and fact-row joins follow ordinary conflicts, and the compose check and the independent invariant agree.
4. Group 0 and job ownership (`writer_group > 0`) are untouched.

## Proof

- (1) `job.ts:194-198` keeps the min of body, member and paired groups and re-points every body; `merge` (`job.ts:204-208`) relabels `p.ops` and the holder, `groups` and `bleedPairs` maps. No other map carries a group: `Queued` has none (`proposal.ts:40`), the choice map is rebuilt from `p.ops` (`proposal.ts:111`), and `sightHandoff` reads the advance op's current group (`proposal_sight.ts:32`).
- (2) Merge uses `Math.min` over a set; ops are relabelled in place, order unchanged, so the composed rows (`compose.ts:80`) and the hydrated prefix do not move. Groups are persisted: the receipt stores the response with `delta.ops` (`mobile/authority/local-story/commit.ts:54`). Merge only coarsens the partition and never touches group 0; save recovery tests group equality or `=== 0` only (`deer-save.ts:57-112`, `expedition-receipt.ts:106-208`, `commerce-save.ts:228-233`, `dialogue-receipt.ts:101,137`), which coarsening preserves. A proposal accepted on base whose later job now joins a lone bleed's body group gets new numbers. Pre-production allows that; reopen re-decides. Base `15c5af9f` and head give the same groups for C5 attack-then-wait probes (`fixture(100|0)`, waits to 65050/65150/65300). CI transcripts and chapters pins are green on the head. Elixir `compose.ex:83-92` and both `no_last_writer_wins` checks compare groups per target only, so a merged delta is still a valid ordinary delta for them. Elixir has no `statusGroup`, merge or sight handoff, so the TS-only claim holds. Holders never hold 0 (they are set only by reactions and due jobs, which are `>= 1`).
- (4) `job_complete_owned_by_run` holds: merged groups are all `>= 1`.
- Mutants (writer_groups + targets tests): merge no-op red (targets two-group test); lone bleed holder removed red; compose check unscoped red; invariant without `ordinary` red. Survived: `paired` dropped (also green on 7 bleed/status files, finding 2), and `Math.max` for `Math.min`. Group order matters only to the sight checks (`compose_sight.ts:22`, `invariants_sight.ts:19`), so the spec's "lowest is kept" goes untested with a sight in the advance. That is loka-95rs ground, so it is no separate finding.
- Claims rerun: "red controls fail when reverted" holds for 3 of 3 named fixes; Beads `loka-kgd.43` "both checks count only writes to a sight member's encounter" does not hold for the invariant (finding 1).
- Disputed self-review items: transfer/slot writes still refused (`sightClosureValid`/`sightScheduleValid`): accepted, the spec binds them to the sight group. Merge folds unrelated writes: accepted; ops keep their order and the committed state equals the sequential order, as the amended mechanics.md text says.

## Findings

1. should-fix, `kernel/ts/src/runtime/invariants_sight.ts:6-10,19`: the invariant exempts an op-kind list, while compose (`compose_sight.ts:22`) exempts every write outside the sighted member's encounter. They disagree. Example: a round on another NPC that joins the player's holder group (set by an earlier round, status tick or, new here, a bleed tick) after a sight completion writes `encounter.advance` and round `job.*` in an older group. Compose accepts that advance and the invariant (sim, differential) reports it as a violation. Probe: state with sight job `s` and open encounter `e2` (goblin), ops `[complete r0 g1, complete s g2, encounter.advance e2 g1, complete r g1]`: `sightHandoffValid` true, `sightHandoffHolds` false. That evidence is a hand-built ops list, not a reproduced play fault (a fatal synthetic status tick faulted `evaluator_error` even step by step, so it could not be used). Scope the invariant by the member's encounter as protocol.md:1218 says, or narrow that clause to the listed kinds.
2. nit, `kernel/ts/src/mechanics/status/job.ts:186,194` and `proposal.ts:291,298`: `paired` changes nothing now that a lone bleed tick registers its body (`job.ts:191`). The pair always shares the body holder, so the mutant that drops it stays green on writer_groups, targets and 7 bleed/status files. Delete it, or add the case where it differs.
3. nit: the handoff reports no `/code-review` result; run it in the fix round.

Question: merge also relabels `encounter.*` writes, and `packMemberRemains`/`deathProven` (`compose_pack.ts:22-43`) depend on the writer group. A pack member's status death in group B, merged into round group A, now reads as a same-group death. That looks intended but is untested.

## Disposition

Mergeable into the M8 batch after finding 1. The nits can ride the fix round.

## Fix re-check (head `0aeb8567735f0ec1eeca0a2fe5257ae42c8f0ddb`, commits `4c00a495`, `14a0042e`, `0aeb8567`)

Hosted ci and book-e2e green on the head. Verdict: **APPROVE**.

- Finding 1, closed. `invariants_sight.ts` `olderAfterSight` counts only writes to an encounter that lists the sighted member (prior state or result), after the completion, in an older group; it is independent of compose's ops-scan (`compose_sight.ts`). The new test `writer_groups.test.ts` (other-NPC round accepted by both checks, deer round refused by both) is my probe. Mutant: drop the encounter scoping: red (that test and the sight/fact-row test).
- Finding 2, closed, wider than asked: `paired`, the `bleedPairs` map and `runtime/proposal_bleed.ts` are deleted. Pairing now comes from a round and a bleed tick each joining their body's holder group. The deleted binding checks only chose the group; each delivery still validates itself: `runBleed` (`bleed/job.ts:117-125`) checks row, job id, generation and effect and otherwise writes only `job.complete`. No other caller: no `bleedRoundPair`/`proposal_bleed` reference left in `kernel/ts`, `lib/`, `test/` or invariants; Elixir never had the pairing. Mutants: generation check removed: red (stale-bleed test); bleed tick registers no holder: red (4 tests incl. `c5_bleed` "Flee and re-engagement pair the exact same-due round and bleed tick").
- protocol.md:1226 wording matches the code. Dropping "another body's bleed never joins" is correct under the holder rule; it is unreachable today because C5 applies bleeding only to the player body. mechanics.md:679 parses.
- Finding 3: not verified here (no PR description on this branch); the PM checks the handoff.
- nit, `invariants_sight.ts` `olderAfterSight` (`done.writer_group > row.writer_group`): changing it to `>=` stays green on writer_groups, targets, bleed, `deer` and `deer_contracts`. Under it, a sight-first closure written in the sight's own group after its `job.complete` would be miscounted; no test runs the invariant on that path. Optional.
