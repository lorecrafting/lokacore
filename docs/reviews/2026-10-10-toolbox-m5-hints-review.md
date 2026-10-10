# Item review: toolbox row W23 quest stage hints, part 1 (loka-kgd.38, batch M5)

- Branch `toolbox/m5-quest`, head `ddb658099d7ac1205b4609e689f96d3b100260b8`, base `45e12917` (merge-base with `origin/toolbox/batch-m5`); no PR yet (batch M5 draft). Fresh Opus item review. The action `tip` and row W24 are out of scope (they follow on `toolbox/m5-deadline`).
- Governing: [toolbox row W23](../MECHANICS-TOOLBOX.md#ranked-toolbox); [mechanics.md quest stage hints](../system/mechanics.md#quest-stage-hints-toolbox-row-w23); [cartridge.md quest stage hints](../system/cartridge.md#quest-stage-hints); [save.md](../system/save.md) quest rows; [Review stance](../WORKFLOW.md#review-stance).
- Developer `/code-review medium`: two rounds, reported with dispositions in Beads `loka-kgd.38` (no PR body yet).
- Hosted CI on the head: ci success, book-e2e success (`gh run list --commit ddb65809...`).
- Verdict: **APPROVE WITH NOTES** (one should-fix, three nits, no blocker).

## Must be true

1. `started_at` on the quest instance row equals the cause's logical time (command clock or due-job time), written at activation and at each transition; never the wall clock (replay-safe).
2. Both kernels' composition store, replace and remove it identically; ops of quests without hints carry no field, so Chapter 1 and corpus bytes are unchanged.
3. Recovery refuses a malformed or future `started_at` (`save_corrupt`); a row without it loads and shows no hint.
4. The Journal shows a hint only while open, for the instance's stage, once `after x 60 x rate` logical units have passed (rate = logical seconds per real second, cartridge.md time policy).
5. Loader and compiler agree: order, `INVALID_TIME_POLICY` without `real_elapsed`, `KERNEL_API_RANGE_INVALID` below 1.46; installed API 1.46.

## Proof

- (1) Every quest op in a proposal joins through `join` (`proposal.ts:153`, root base `world.state.clock` at `:86`, due jobs `cause(p, due_time, ...)` at `:286`) or the earned exit (`:214`, cause event time). `farewell` (`:115`) and `record` push no quest ops.
- (2) No corpus, transcript or Chapter 1 file in `git diff --stat`; new fixtures only append cases. Mobile receipt routers (`dialogue-receipt.ts:146`, `expedition-receipt.ts:142,204`, `deadline-receipts.ts:197`) match quest ops field by field, so an extra `started_at` does not break evidence routing.
- (3, 4, 5) Mutants, focused files, each red: `hint` `<=` to `<` (`quest_journal.ts:83`); TS compose keeps the old `started_at` (`compose_quest.ts:45`, `compose.test.ts`); Elixir compose keeps it (`compose_quest.ex:42`, `mix test --force`); `store.ts:153` future check dropped (`quest_started_at.test.ts`); compiler policy check forced off (`quests.ex:120`).
- Disputes judged. Accepted: stamping terminal transitions (row text "each transition"; failed/abandoned to active needs it); `Hint:` outside `LABEL` (`sections.tsx:119,126` already draw inline note words "Next:", "Shelter used."); no compose `started_at <= clock` check (display-only value, recovery guards the trust boundary); quest scan in `stamp()` (runs only with quest ops); duplicate KERNEL_API diagnostic per hinted quest (loader reports the first). The extra `exit` object (`proposal.ts:212`) is harmless.
- Claim rerun: the "deadlineJob join stamps it" correction holds (`proposal.ts:286` into `:153`).

## Findings

1. should-fix, `kernel/ts/src/mechanics/quest/lifecycle.ts:60`: mutant dropping `...prior` from `refOf` leaves `quest_hints.test.ts` green. Scenario: a dialogue accept that activates a hinted quest and hands over its item in one command earns `objectives_complete` in the same proposal; `world.state.quests` lacks the new instance, the transition goes unstamped, composition removes `started_at`, and the `objectives_met` hints never show. Fix: one test on that path (activate and earn in one proposal).
2. nit, `protocol/fixtures/composition.json:2928`: id says "replaced-then-removed" but the case stores then removes; TS replacement is covered only indirectly by `quest_hints.test.ts`.
3. nit, `protocol/quest.schema.json:485`: `hints: {}` validates (no `minProperties`); the quest is then stamped and gated (`INVALID_TIME_POLICY`, 1.46) with nothing to show.
4. nit: the compact save evidence of [Review stance](../WORKFLOW.md#review-stance) (reopen, failed-COMMIT, lost-ack, receipt-replay) is not in the Beads notes; hosted mobile ran them green on the head.

Open: Book Journal "Hint:" wording awaits the designer; `book-ui.md` gets the line then.
