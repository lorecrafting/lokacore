# Review: toolbox row 12, traps (loka-kgd.73)

- Branch `toolbox/m8-traps`, head `16844e5590257aa3b82218b0dfb76a22062d04e2`, base `origin/toolbox/batch-m8` `52790db9` (21 files: cartridge, docs, one test; no engine file). No PR (batch model).
- Governing: [Traps](../system/mechanics.md#traps-trigger-disarm-and-reset-toolbox-row-12), [trap declarations](../system/cartridge.md#trap-declarations), [reaction@1 subject table](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), archived [C2-M03](../archive/LATER-MECHANICS.md), toolbox row 12, Beads `loka-kgd.73`.
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **APPROVE WITH NOTES** (one should-fix, two nits).

## Must be true

1. A one-shot plate fires on the first crossing only; the return crossing and later crossings fire zero times, including after reopen (C2-M03); removing the spent write fails a test.
2. One legal avoidance path: the trap is revealed (search) before a disarm by opposed check against an authored rating; a disarmed plate never fires.
3. Reset policy is authored content (a reaction), never inferred; with none the trap is one-shot.
4. Content only: no engine change; every binding used (status subject on `entity_entered_room` and `check_failed`, `clock_hour`) is a base contract, not accidental behaviour.

## Proof

- Diff: only `cartridges/traps_sampler`, docs, generated indexes and `kernel/ts/test/traps_sampler.test.ts`.
- Actor binding is base contract: the "a failed disarm poisons the actor" line (`mechanics.md:611`) and the `check_failed` subject row (`:593`) are already on `origin/toolbox/batch-m8`.
- Step order: swapping `status.apply` and `fact.assign` in `reactions/plate.json` stays green (`when` read once per delivery); no reliance on step order.
- Claim reruns: dropping the spent write (`reactions/plate.json` second step) fails, `ends_at` 420 vs 300 (developer's red control, confirmed); `at_least` 1.45 gives `KERNEL_API_RANGE_INVALID` (the 1.46 `clock_hour` floor, confirmed).
- Reviewer red control: the `check_failed` filter naming `search_floor` fails "the failed disarm poisons" (actual undefined).
- Reopen (C2-M03): throwaway real-SQLite probe through `elapsedHost` (cross north, south, close, reopen at 600, cross north: no condition) passes; with the spent write dropped it fails (`['condition.poisoned']`). Not committed. Accepted without a new test: its only distinct break beyond the kernel test is instance-fact persistence (fact@1) and the calendar job across reopen, which `mobile/authority/local-story/exposure.test.ts` already covers.

## Findings

1. **should-fix**, `cartridges/traps_sampler/reactions/disarm_failed.json:6-12` (spec `mechanics.md:1959`, "a failed disarm of an armed trap"): mutant "delete the `when`" stays green. Failure: after the plate is sprung, a failed disarm still poisons the doer, against the spec bullet the self-review commit added. Fix: one failed disarm after a crossing (spent), asserting no new status. Not a blocker, unlike the M7 precedent: the mutant breaks sampler content, not an engine rule; W1 owns `when` evaluation on `check_failed`.
2. **nit**, `cartridges/traps_sampler/recipes/disarm_plate.json:22-26`: mutant "drop the `plate_disarmed` policy item" stays green; the Book bullet (`mechanics.md:1963`) says the disarm is unavailable after disarming. One refused disarm after the success in the second test would pin it.
3. **nit**: the handoff (Beads comment) does not report the developer's `/code-review` result.
