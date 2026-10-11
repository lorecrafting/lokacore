# Review: population successor across a multi-hour advance (loka-6ql4)

- Branch `toolbox/m8-pop`, head `879fe86665c4272cd7b4539f2d19a9279cb5fe36`, base merge-base with `origin/toolbox/batch-m8` `b7a602a4` (5 files: `population/shared.ts`, `settle.ts`, `schedule/rule.ts`, `mechanics.md`, one new test). No PR (batch model); the `/code-review medium` result is in the loka-6ql4 Beads notes.
- Governing: [population plan successor](../system/mechanics.md) (`mechanics.md:1275-1288`), [schedule@1 crossed hours, loka-qi0r](../system/mechanics.md#schedule1-behavior1-calendar1-mechanicsschedulerulets-kerneltssrcmechanicsschedulebehaviorts), [D9 contract](../system/protocol.md) (`protocol.md:1165-1179`).
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **CHANGES REQUIRED** (one blocker: the new derivation is not pinned by any test).

## Must be true

1. One elapsed advance over N hours commits and leaves the same plan state as hour-by-hour play: slots, generations, member rooms, `next_wander_due`, next plan job due. Minted ids may differ (qi0r ruling).
2. Each crossed run reads its own hour: births, wanders, the target and the night boundary. A wander happens only at a wander boundary that hour-by-hour play would hold, including when a birth or a death replacement adds a run that is not on an hour.
3. Plan control is written once per advance, and the successor is strictly later than the target. A run that crosses nothing keeps its ops and minting order, so Chapter 1 bytes do not change.
4. TS and Elixir agree on the `population.control` write rule.

## Proof

- New test green; the related files (c4_pack*, d9, crow, hidden_passage_npc, schedule*) pass 63/63. transcripts, e1_*, chapters and the mobile bell_receipts/chapters tests pass 70/70 (claim 3).
- Mutants against the related files: `next <= clock` changed to `<` fails; `alignedAfter(at - 1)` changed to `alignedAfter(at)` fails. **M1: the derived wander boundary replaced by `at` (`shared.ts:192-193`) stays green.**
- Births and deaths mid-advance (claim 2), scratch probe: kill slot 2 at 66000 (`deathSequence` + `apply`, as in `d9_suppression.test.ts:117`); replacement due 152400 (not on the hour). One 25 h or 30 h advance equals stepping to each next due (host style, `elapsed.ts:67`). Under M1 both runs differ: the member rooms flip because there is an extra wander at 152400.
- Elixir `invariants_population.ex:94-101` and `compose_population.ex:42-45` use the same monotone rule as TS `compose_population.ts:24-33`. A multi-interval jump is legal in both, so the two do not diverge.
- No RNG in population (`shared.ts` and `settle.ts` draw none). Population emits no events. Apart from minted ids, a single advance differs only in its receipt shape: all sub-steps share one writer group, and there are no intermediate completed plan job rows.
- Cite reruns: `rule.ts:69` passes `at` (confirmed). The job-id rule is at `compose_population.ts:30`; the brief cites `:29`.
- loka-dto9 probe: ring at 64800 or at 66600, then one advance to `ends_at + 3h`. HEAD gives `conflicting_write` on `population_plan`; the merge-base gives `nonfuture_job`. Both are atomic. The host clamps every elapsed step at the next due job (`mobile/authority/local-story/elapsed.ts:67`), and only Ashmere cartridges carry `ring_bell` (not `toolbox_showcase`). No test pins either code.

## Findings

1. **blocker**, `kernel/ts/test/c4_pack_elapsed.test.ts:72`: the fixture's `wander_interval` is 3600, so every sub-step is a wander boundary and `alignedAfter(at - 1)` equals `at`. Mutant M1 (`shared.ts:192-193`) passes the suite. Failure scenario: a hound dies off the hour (replacement at 152400) and one advance crosses that hour. M1 then wanders the pack at 152400, which hour-by-hour play does not, and the rooms diverge (scratch probe above). Fix: add one equality case in which a run crosses at a time that is not a wander boundary after `control.next_wander_due`. Either an off-hour death followed by a 25 h advance compared to stepped play, or `wander_interval` 10800 with a 27 h advance (which also fails M1). Show it red under M1.
2. **nit**, Beads loka-6ql4 notes / developer summary: the "compose_population.ts:29" cite should be `:30`.

## loka-dto9 recommendation

Widen `protocol.md:1175`; do not make a narrow code change. With an off-hour ring (66600, `ends_at` 239400) no plan sub-step lands on `ends_at`. Exact-deadline pairing, even extended to crossed sub-steps, therefore leaves that case faulting. Adding `ends_at` to the successor would change hour-by-hour save bytes. The clause needs to say that the plan's current job, including its crossed sub-steps, and that plan's resume share one writer group when one advance runs both. This is not urgent: no shipping path reaches it, so keep it at P2 until a cartridge offers an uncapped wait across a bell deadline.

## Fix re-check at `5098ee4091d58c37581861336348a65e858b2abb`

- Scope: `5098ee40` only (`c4_pack_elapsed.test.ts:84-93`, `c4_pack_fixture.ts:17,25`). Hosted ci and book-e2e green (PM).
- Finding 1 (blocker): **resolved**. The new test, 3 h interval and one 27 h advance from 18:00, passes on the head. Under M1 (`shared.ts:192-193`, derived boundary replaced by `at`) it fails at the `deepEqual` with hourly play (`:91`), not only at the pin, while the first test stays green. The pin `next_wander_due` 172800 is independent of the code: the last wander is at 162000 (21:00 day 2, on the 10800 grid), so the next is 172800.
- `fixture()` defaults are unchanged (`wander_interval` spreads only when given).
- Finding 2 (nit): not addressed; it is in the Beads notes, not the branch, so no action is needed.
- Verdict: **APPROVE**.
