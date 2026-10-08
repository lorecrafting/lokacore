# E2 gate audit (Fable): `origin/main` at `deec9c68`

Milestone-gate audit ([workflow](../WORKFLOW.md#milestone-gate)) of the E2 stage's riskiest code
named in the [E2 slice plan](../briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md#risks-riskiest-code-named),
on `origin/main` `deec9c68b1a4e0fd4a33ceed59b2668965e7170a` (S0–S4: #309 #312 #314 #316 #319).
Record committed on draft S5 `e2/s5-closing-and-gate` at `266fa6b2`; S5's own code is not audited here.
Independent; authored none of the work. Governing: [E1 candidate policy](../system/e1-certification.md#e1-exact-candidate-proof-policy),
[protocol step 6–7](../system/protocol.md) (`:84-100`), [commit, fence, reconcile](../system/save.md#commit-fence-reconcile),
[story points](../system/save.md#story-points), [durable elapsed sessions](../system/save.md#durable-elapsed-sessions).

**Verdict: PASS WITH NOTES.** No reachable defect found in the named code; every planted break in it is red in
a same-layer test on `main`. One nit, one question; nothing for the gate PR to fix in code.

## Must-be-true list (written before reading the code)

1. Candidate gate: admitted only on exact id, version and loader-recomputed hash from a literal table; no row,
   wrong version or wrong hash refuses; the table is outside the policy digest.
2. `step`: due jobs run in `(due_time, job_id)` order against the hydrated prefix; only the spec's pairs
   (population resume/regular, bleed/round, sight handoff) share a writer group.
3. Authority: head, changed rows, reports and receipt commit in one transaction; an unknown COMMIT fences every
   call until reconcile; memory adopts only a store-confirmed head; a known invocation replays without deciding
   and adds no report.
4. No player path moves the clock past the elapsed checkpoint target (reopen would be `save_corrupt`).

## Planted breaks (throwaway worktree at `deec9c68`, each reverted; logs in the session scratchpad)

| Break | Where | Red in |
|---|---|---|
| drop the hash comparison | `kernel/ts/test/e1_policy.ts:94` | `e1.test.ts` "refuses a different admitted candidate", "refuses a changed r9c candidate" |
| replay disabled (known invocation decided again) | `mobile/authority/local-story/invocation.ts:60` | A `r9c_custody_terminal.test.ts` family 2 (`UNIQUE receipt.scope, command_id`) |
| memory adopted on an unknown COMMIT | `mobile/authority/local-story/save.ts:59` | A `r9c_custody_terminal.test.ts` family 2 (facts changed after a failed COMMIT) |
| report rows committed in their own transaction before the gameplay COMMIT | `mobile/authority/local-story/commit.ts:35-42` | A `r9c_custody_terminal.test.ts` family 2 (`reports()` 1, expected 0 after the failed COMMIT) |
| due-job pairing removed (every job its own group) | `kernel/ts/src/runtime/proposal.ts:278-279` | **green** in K `r9c_*.test.ts`; red in `bleed_composition`, `c5_bleed_early_expiry`, `job_completion_invariant`, `deer`, `deer_contracts` |
| due job status read from the root world, not the hydrated prefix | `proposal.ts:260` | **green** in K `r9c_*.test.ts`; red in `deer`, `deer_contracts` |
| due jobs sorted by `job_id` before `due_time` | `proposal.ts:253` | **green** in K `r9c_*.test.ts`; red in `schedule` "due jobs run in due-time order", `deer`, `deer_contracts` |

Baseline: the three K and three A `r9c_*` files and `e1.test.ts` green at `deec9c68` before any break.

## Checked and held

- Item 4: the loader refuses a recipe `duration` and the `wait` verb under `time_policy`
  (`kernel/ts/src/content/cartridge.ts:178,181`); the schedule rule is the only other `time.advance` writer.
  So the `readElapsed` `target < head` refusal (`elapsed-store.ts:29`) cannot be reached by a player command;
  `elapsed-host.test.ts:14` strips durations from the ferry fixture for the same reason.
- Reconcile reads the receipt after a confirmed ROLLBACK (`transaction.ts:10-13`) and reloads the whole save
  through `load` (`save.ts:110-116`), so an adopted head is always the store's.
- Elapsed receipts replay by deterministic `(run, context, from, until)` id (`delivery.ts:32-55`); the managed
  driver stops each window at the earliest pending job (`elapsed.ts:59-67`), so in a managed session an advance
  never holds two due times.

## Findings

- **Nit** (`docs/briefs/chapter-one/chapter-one-e2-slice-plan-2026-10-07.md` S3 acceptance "equal-time
  continuations keep the paired-job completion invariant"): no E2 row exercises a shared writer group or a
  job cancelled by an earlier job in the same advance; the three `proposal.ts` breaks above stay green in every
  `r9c_*` file. The invariant is held by the focused tests listed, which is what AGENTS.md "one test per break
  per layer" asks, so nothing is missing; the gate's coverage table should cite those focused tests, not an E2 row.
- **Question** (`kernel/ts/src/runtime/world.ts:126-131`, `:167-179`): `stepElapsed` skips `step`'s
  ancestry gate, so a managed session advances world time (schedules, populations) while the player is still on
  the ancestry screen (two minutes there is 6000 units at rate 50). D11 forbids only "ordinary gameplay"
  before the choice, so no spec breach; the PM may want a designer view.

## Disposition

Nothing open. S5 remains subject to its own slice review and second opinion; this audit does not stand in for them.
