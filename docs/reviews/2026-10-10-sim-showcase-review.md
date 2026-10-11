# Review: simulator plays the toolbox showcase; stable seeds (PR #373, loka-y6yg.5, loka-seqb)

- PR #373, branch `toolbox/sim-showcase`, head `3e345dbbe83166c37aad4edd267bf7f4f0884d99`, base `origin/main` `318cb8ae`.
- Governing: [architecture simulator paragraph](../system/architecture.md) (amended here), [acceptance envelope §3](../archive/spec/r1-acceptance-envelope.md#3-corpus-command-mix-and-sampling), [SHOWCASE.md](../SHOWCASE.md).
- Hosted CI on the head: ci, book-e2e, graph-diff, all success (`gh run list --commit`).
- Verdict: **APPROVE WITH NOTES**: no blocker, no should-fix, two nits.

## Must be true

1. Every existing corpus seed generates the same sequence; GENERATOR stays 17 only if so.
2. A new `*_hash.json` fixture moves no corpus seed.
3. The showcase pass checks every invariant per step and fails when a district's inner room or a showcase verb goes unreached.
4. A pin leaves out only seeds that fail as the named bug does, and a stale pin fails the test.
5. No frozen fixture answer changes.

## Proof

- (1) `node kernel/ts/test/sim.ts 1..300` with main's `sim.ts` and with the head's: output byte-identical (`cmp`), 19 cartridges reached.
- (2) `CARTRIDGES` (`kernel/ts/test/sim.ts:77`) is an explicit list; no glob remains in sim.ts.
- (5) `protocol/fixtures/toolbox_showcase_hash.json`: only `description` changed; `canonical` and `sha256` unchanged.
- (3, 4) Mutants, each run on `sim.test.ts` showcase test only, all red: end room read from `o.start` (`sim_batch.ts:38`): six inner rooms missing; skip off by one (`sim_batch.ts:29`): seed 83 fails the pass; `sleep` dropped from `seen` in the summary: `['sleep']` missing; `PINNED = [83, 84]` (`sim.test.ts:207`): stale-pin assert at `:229` fails. Head itself: showcase test passes locally (32 s); `npm run typecheck` exit 0.
- Claims rerun: "seeds 1-300 byte-identical digests (cmp)": backed. "Hosted about +35 s": not backed, see nit 1.

## Findings

1. nit, PR body "Runs": hosted showcase test took 51.9 s, not about 35 s (ci run 38105317488, sim job); the sim step went from 3m47s (main, run 38094452732) to 6m06s, partly runner variance (the unchanged 10k test went from 210 s to 295 s). Correct the figure in the PR body.
2. nit, `kernel/ts/test/sim.test.ts:207`: the pin is fragile by design: a generator mutant that drops `sleep` from the offered actions turned red through loka-th7x on another seed (`gameview_agrees_with_admission` at step 27), not through the coverage assert. Any generator or showcase content change before loka-th7x is fixed will need a re-pin. The comment at `:203-205` says this; no action needed beyond fixing loka-th7x first.

## Disposition

- Record not pushed by the reviewer ([Git hygiene](../WORKFLOW.md#git-hygiene)): kept as local branch `review-373`.
