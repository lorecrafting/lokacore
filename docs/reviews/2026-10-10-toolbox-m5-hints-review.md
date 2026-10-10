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

## Re-check: fixes and the action tip (`toolbox/m5-deadline` at `6a94f4eaf40008132deb3be3228c9a0a6923eab5`)

- Scope: `ddb65809..6a94f4ea` (W23 fixes, action `tip`). Row W24 is out of scope (Beads `loka-kgd.45`). Governing: [mechanics.md action tip](../system/mechanics.md#quest-stage-hints-toolbox-row-w23), [cartridge.md](../system/cartridge.md#quest-stage-hints), `protocol/action.schema.json` `ActionRecipe.tip`.
- Hosted CI on the head: ci success, book-e2e success.
- Verdict: **APPROVE WITH NOTES** (one should-fix, one nit, no blocker).

### Must be true (tip)

1. The first accepted perform by an actor, with any outcome, assigns `seen_tip_<key>` and shows the tip after the outcome line. Later performs show nothing. The value comes from state only, so replay gives the same result.
2. The fact is reserved like `skill_<key>`: an authored spec or any write of it is `RESERVED_FACT` in both kernels. Reading it is allowed.
3. The loader and the compiler agree on `UNRESOLVED_REFERENCE`, `UNDECLARED_CAPABILITY` (fact@1) and the 1.46 floor. A key over 55 characters is refused.
4. Recipes without a tip add no fact, so the Chapter 1 bytes stay the same.

### Dispositions

- F1 (removed `prior`): accepted. An earned exit always gets a new writer group (`proposal.ts:211`). Compose faults `conflicting_write` when two groups write one quest target (`foundation/compose.ts:66-70`; `sightRebindValid` applies only to sight). A test already pins the dialogue accept plus handover case (`quest_delivery.test.ts:130-145`). Activations in the same group are still found in `ops` (`lifecycle.ts:55`). So `prior` could only affect a proposal that is already refused. The rest of the group argument: `sightRebindValid` is true only for a `population.slot` bind (`compose_sight_rebind.ts:22-23`). Every `join` call gets a new group (`proposal.ts:88` root, `:236-238` reaction, `:284-286` job, `:301-304` crow). The one exception is `creditDelivery` (`:190`), which reuses the fatal group but carries only `fact.assign` and levelling ops (`combat/credit.ts:36-50`), never quest ops.
- Chapter 1 bytes: the diff touches no `cartridges/ashmere_*`, corpus or transcript file. `expectedFacts` and the `position.ex` reserved list add `seen_tip_` only for recipes with a `tip`, and only `quest_sampler` has one (`grep "tip" cartridges`).
- N2: fixed (`composition.json` id `...-stored-then-removed`).
- N3: deferral accepted. It is tracked in `loka-kgd.45` and only affects the display.
- Dispute on the TS 55-character check: accepted. `seen_tip_` plus 56 characters breaks the `Key` limit `maxLength 64` (`action.schema.json:10`). An artifact that omits the FactSpec instead fails `RESERVED_FACT`.
- Mutants run on the focused files. Red: the unseen check dropped (`rule.ts:105`), the tip placed before the outcome line (`rule.ts:90`), the assignment dropped, TS `expectedFacts` tip (`cartridge_position.ts:99`), Elixir `position.ex:96` seen_tip write site, and the `recipes.ex` authored `RESERVED_FACT`. Green: see finding 1.
- Row W23 can be marked "done (batch M5)". The designer's approval of the Journal "Hint:" wording is an open designer item, not a build gap.

### Findings

1. should-fix, `kernel/ts/src/mechanics/action_recipe/rule.ts:73`: the mutant `rolled?.outcome === 'failure' ? [ran, []] : tip(...)` leaves `quest_hints.test.ts` green, and no other test uses a tip. The spec says the tip shows on "success, failure or performed" (`mechanics.md:1932`, `action.schema.json` `ActionRecipe`). Failure scenario: a regression that skips failed performs means a player who fails a checked search first never sees the tip until a later success. Fix: one test with a checked recipe whose first perform fails, asserting the tip line and `fact_changed` with no `action_completed`.
2. nit, `kernel/ts/src/mechanics/quest/lifecycle.ts:46-48`: `stamp` now depends on the compose rule that `quest_delivery.test.ts:138` marks as an open PM question ("fault, or widen the rule"). If that rule is widened, only the `both` assertion changes. The unstamped transition would then return with no failing test. Fix: when the rule is widened, restore the lookup together with a test.
