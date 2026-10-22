# Review: pack of one Attack narration (loka-kgd.187, PR #427)

- Branch `fix/pack-sole-narration`, exact commit `0b1d8c29848fcc7aaad35e6da41fbf697c2259d0`, base `515d4803d50a6cf5c3e52c29fcdf6274ce22117e`.
- Governing: [decision.schema.json](../../protocol/decision.schema.json) `DecisionResult` (line 33, lines 62-69), [C4 pack assistance](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract), [Book log rule](../system/book-ui.md) line 74, [save.md Receipts](../system/save.md), [AGENTS.md pre-production](../../AGENTS.md#architecture-decisions-already-made-do-not-reopen-silently), [Writing tests](../../AGENTS.md#writing-tests-every-change-every-agent).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.

## Must be true (from the clauses; the one-line src hunk was seen when the PR was opened)

1. An accepted decision either has no `narration` or has 1 to 64 lines. `decision.schema.json:33` says "absent means none", and `narration` is not in `required`.
2. A pack Attack names only the helpers that actually join (`mechanics.md:1374-1375`). With zero helpers there are no lines, so absent is the right answer, not an invented line.
3. The save check stays unchanged, and no other producer can still write `[]`.
4. Elixir needs no change: either it has no rule that produces narration, or it gets the same fix.
5. Each new test fails when the fix is reverted, and its expected values do not come from a kernel run.

## Checks run

- **1, 2.**
  - `decision.ts:315` now omits an empty list.
  - Solo Attack: at `combat/rule.ts:66`, `helperNotes(..., roster)` with `roster` undefined (`rule.ts:92`, `roster?.`) gives undefined, so its narration is omitted. A pack of one now commits the same shape.
  - `book-ui.md:74`: a receipt with no narration draws the outcome word. A pack of one now renders as a solo Attack does.
- **3.**
  - `git grep "kind: 'accepted'" kernel/ts/src` finds one literal, at `decision.ts:309` (PR claim rerun: holds).
  - `ast-grep '{ ...$D, narration: $N }'` over `kernel/ts/src` finds no hits, so no root overrides narration by spread.
  - `proposal.ts:90` copies the root's narration. `proposal.ts:106` already adds it only when non-empty.
  - Before this fix, a root `[]` passed through `...root` at `proposal.ts:102`. `accepted()` was its only source, so the fix sits in the shared sink and closes the class. `helperNotes` returning `[]` is semantically correct and needs no change.
- **4.**
  - `git grep helper_joined lib` finds no hits (PR claim rerun: holds).
  - `lib/loka/core/compose.ex:206` only applies the `encounter.open` op. No `lib/` module builds narration for an accepted decision. Elixir is unaffected.
- **5.**
  - Baseline: c4_pack passes 13, c6_expedition passes 5.
  - Mutants on `decision.ts:315` (bin/mutate.sh, narrow files only):
    - revert to `narration && {narration}`: red in c4_pack and in c6_expedition.
    - always omit narration: red in c4_pack.
    - keep narration only when it has more than 1 line: red in c4_pack.
  - Failure reasons for the revert, rerun by hand:
    - c4_pack `✖ attack on the only co-present goblin…`: `{ path: '/narration', code: 'too_few_items' }`.
    - c6 `✖ attacking the sampler lone hound survives a cold reopen`: `Error: save_corrupt`.
  - Expected values are independent: `active_ids [h2]` is the fixture's own id, the schema is the oracle, and the opponent id comes from the view.
- **Old saves.** `AGENTS.md:22` holds: pre-production has no save compatibility. An old save that holds `[]` still refuses loudly as `save_corrupt` and is never silently deleted.

## Findings

1. Note, `kernel/ts/test/sim.test.ts:213`: the brief expected the sim narration check to catch this. It cannot.
   - The sim never reaches combat headless (loka-lmvc).
   - `sim_batch.ts:40` treats `[]` and an absent field alike (`narration?.length`).
   - So the developer's "baseline has no combat entry" is correct, but the reason is that the sim does not reach combat.
   - Failure scenario: a reader trusts the sim to guard combat narration shape. It guards neither combat nor the schema.
2. Question, `mobile/authority/local-story/`: the commit path does not validate `DecisionResult`, but reopen does (`receipt-history.ts:49` and others). That asymmetry is why this bug reached disk instead of failing at decide time.
   - This is the known receipt-integrity limitation (`save.md:235`, DIFFERENCES.md). It predates this PR and is out of scope here.
3. Nit: the PR body has no file:line cite for the solo Attack parity claim. The parity is `combat/rule.ts:66` together with `rule.ts:92`.

**Verdict: APPROVE WITH NOTES**
