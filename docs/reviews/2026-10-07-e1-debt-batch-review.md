# E1 debt dialogues batch (Aldric, Peg) review

- Branch: local `e1/debt-dialogues` (not pushed), for draft PR #288.
- Exact head reviewed: `d9df38c371973b996b566aafe26334ea7e873b4e` (developer `636781e0` merged with #288 head `cda2d2f3`). Batch diff: `git diff cda2d2f3 d9df38c3` (`kernel/ts/test/e1_{cases,debt}.ts`, `e1_debt.test.ts`).
- Brief: Beads `loka-e1-r9-certification-2rz.1`.
- Reviewer: independent; authored none of the batch.
- **Verdict: APPROVE WITH NOTES**

## Requirements set before reading the diff

From the [E1 brief](../briefs/chapter-one/chapter-one-e1-r9-certification-brief-2026-10-05.md), the witness rules in [architecture](../system/architecture.md) and [AGENTS.md Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent):

1. A choice path is credited only for an accepted choice against its pending continuation. Refused or offered choices get no credit.
2. A `fact.assign`/`fact.adjust` sequence step is credited only when that exact fact moves from its prior value to the authored result in committed state, and the receipt holds the same `fact_changed` transition.
3. `any`/`not` descendants get no credit.
4. Expected values are literals from the cartridge, not values computed by the code under test. Real SQLite, cold reopen, and replay derive the same paths.
5. The batch credits exactly the 6 claimed paths and adds no pending paths.

## Checks (scratchpad logs `debt-*`)

- Clock literals come from the cartridge: `cartridge.json` calendar start 64800, rate 50; `a_peg_debt.json`/`a_aldric_debt.json` windows `through 151200`, `151201..237600`, `from 237601`; `resources.json` pennies start 20. 64800 + 1 729 000 ms x 50/1000 = 151250 and 64800 + 3 457 000 x 50/1000 = 237650. Both are computed by hand, independent of the kernel.
- `npm run typecheck`: exit 0.
- Full `node --test kernel/ts/test/e1*.test.ts`: 36/36 pass, exit 0.
- `e1_cases.ts` recorder: exit 2, `pending: 23 real SQLite cases passed`, `gaps.authored_obligations` = 151. Compared with the 157 baseline (`pending-ff63b598.txt`), exactly `a_aldric_debt/choices/late{,/sequence/0,/sequence/1}`, `a_peg_debt/choices/accept_late{,/sequence/0}` and `a_peg_debt/choices/elapsed` were removed; 0 were added. CLI replay of `debt-late.jsonl` and `debt-elapsed.jsonl` re-derives the same 5 and 1 choice paths.
- Mutants in a throwaway worktree against `e1_obligations.ts` (all were restored; the worktree was removed). Each mutant makes `e1_debt.test.ts` fail on the named plant: accepted guard removed (refused entry in `chosen`); pending guard -> `continuation already resolved`; `old === next` -> `tithe already late`; committed-value check -> `fact not committed`; fact match -> `tithe event names another fact`; `old` match -> `event with wrong prior value`; `new` match -> `tithe event with another result`; event check bypassed -> `event with wrong prior value`; adjust sign flipped -> missing `late/sequence/1`.
- No batch code credits `any`/`not` descendants. The batch does not touch `requiredPolicyPaths` (`e1_obligations.ts:310`). The 21 `any`/`not` children stay pending, as the brief requires.
- No frozen fixtures or expected answers were changed. The batch has no Elixir counterpart.

## Findings

1. **nit**: `kernel/ts/test/e1_debt.test.ts:77,95`. The plants `no tithe event` and `no axis event` use the same shared event check as `event with wrong prior value` (line 68), and no separate mutant makes only them fail. They add little. Keep or drop them; neither choice changes the verdict.
2. **question (outside the batch diff; carry to PM)**: `kernel/ts/test/e1_obligations.ts:314`. When `policy.op === 'all'` is mutated to recurse into every op, so that `any` children are credited, all 36 E1 tests still pass. Only the recorder gap count would show the 21 pending `any`/`not` paths disappearing. The existing tests (`e1_cases.test.ts:153,286`) pin only `all` roots. The code is correct today. Should a focused red control for `any` non-credit be added in the parent PR?
