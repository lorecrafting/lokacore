# B7 waterskins and liquid actions — primary source review

**Verdict: CHANGES REQUIRED.** Exact source
`d31b47d8b2474699348675d697b2fa26a34ba181`, local branch
`b7-well-waterskin`. Published reviewed B4 comparison base:
`cc43d0186e70231d7ba25bf73da61e6838c0bf06`. Fresh independent reviewer
authored none of B7. The evidence-only successor `0c987ca97da64c636f63875c680321c3f38fb805`
was read separately; its passing checks are not the verdict.

## Governing requirements

Derived from the [adopted brief](../briefs/chapter-one/b7-well-waterskin-brief-2026-10-05.md),
[PM decision](../decisions/pm-decision-b7-well-waterskin-2026-10-05.md),
[mechanic](../system/mechanics.md#b7-well-and-waterskin-selected-contract),
[composition](../system/protocol.md#b7-liquid-composition),
[save](../system/save.md#b7-liquid-recovery),
[Book](../system/book-ui.md#b7-water-details) and
[composition ownership](../system/architecture.md#building-mechanics-by-composition):

- Exact owned, reachable participants and keyed target/input/policy admission agree with projected offers.
- Fill issues only declared source water within capacity/carrying; Pour debits and credits atomically; Drink consumes a full authored serving without time/RNG/resource effects.
- The exact row follows custody and current-build receipt recovery without another quantity writer or creation framework.
- Each Book control has its source/detail owner, retains exact participants and freshness, and shows the actual committed amount in live and recovered history.

## Findings

### B7-01 — blocker: authored liquid action keys execute but have no offers

`kernel/ts/src/view/liquid.ts:44`, `:64`, `:77`; related invariant
`kernel/ts/src/view/invariants_view.ts:168`.

A valid loaded cartridge defines `draw_water` → `fill`, `decant` → `pour`,
and `sip` → `drink`, then replaces Well Lane's ActionSet with those three
keys. Both skins are owned and contain water3/2. Independent identification,
resolution and keyed execution accept all three exact commands, but
`liquidActions` returns `[]` for every subject and the GameView/admission
invariant returns false. Projection indexes engine keys instead of the
resolved actions' semantic commands. The generic list excludes the commands,
so Book has no fallback controls. The invariant also requires action key to
equal command type.

Project each resolved liquid action under its own key, with its exact keyed
admission and command semantics. Verify allowed, target/input-narrowed and
policy-denied authored keys, including room replacement. The existing
engine-key override test passes and misses this case. Direct Book consumers
must retain semantic command information for wording/ownership and liquid
freshness while leaving invocation identity unchanged.

### B7-02 — should-fix: Pour appears on its receiver page without its result

`mobile/app/book/model.ts:230`, `:254`; direct caller `group` at `:103`.

With production original4/spare3, `buttonsOf` creates
`Pour a waterskin into a spare waterskin` with `[original, spare]` and no
source `detail_id`. `group(...).on(spare)` therefore lists the original's
Pour on the receiver page. A real GameSession/presenter press there commits
3/4, retains the spare page, and routes the confirmed narration only to
the original's history. The page where the player pressed shows no Pour
result. Give Pour the source owner using existing detail metadata, as the
adjacent Refuel consumer already does; preserve both ordered participants.
Check source-only listing, nested return and the live result together.

### B7-03 — blocker: live narration omits the committed quantity line

`mobile/app/book/logs.ts:20`; direct caller
`mobile/app/book/presenter.ts:111`–`:112`.

The same real production Pour press transfers1, but live source history is
only `You pour into the other waterskin.` The required `Water · 1 quarter-litres`
line is absent. The added formatter runs in `narrationLines`, while live
`received` calls that helper only for receipts with combat lines; ordinary
liquid receipts take `replyLine`. Cold restoration uses the helper, so live
and reopened Book differ. Exercise an actual projected button through
`presenter.press` and assert the committed quantity in the visible source
history for Fill/Pour/Drink and exact retry; the current helper-only test
cannot detect this missing live integration.

## Independent verification

Pinned `mise exec -- node --test --test-reporter=spec` on kernel liquid,
cartridge-liquid, liquid composition and liquid contracts, authority liquid,
and Book liquid: **23/23 pass**, exit0. Controlled loaded alias and real
GameSession/presenter probes reproduce B7-01/B7-02/B7-03 on the unmodified
exact source.

In a separate disposable detached worktree, remove only Pour's source
`change(...)` operation. The existing focused `Fill, Drink, partial Pour`
test fails, exit1: actual quantities4/4 versus independent expected3/4.
Restore exactly; the same case passes1/1, exit0, and `git diff --exit-code`
passes. The mutation worktree was removed. No source or test edit is included.

Compiler/loader safe mass, short refs and template refusal, portable independent
row/precondition fixtures, shared carrying/custody, and actual SQLite prior/next
recovery were inspected. The new tests distinguish plausible breaks and use
literal/independently pinned expected quantities; the missing live and authored-key
cases above require integration regressions. Existing evidence reports the full
active checks and schema sweep; no redundant full run was performed here.

**Ponytail Review:** no separate complexity finding; existing custody, carrying,
typed row, writer group, receipt and UI mechanisms suffice. No new framework
or dependency is warranted. The direct-base absence of later B4 review records
is inherited branch history, not a B7 source deletion; final integration must
retain those published records. Separate save/protocol approval, final source
fix review and publication/browser gates remain required. No merge or push.

## Scoped fix round 1 — APPROVE

**Exact source reviewed:** `d24b6f8917fa46e171fbf1791e3ed2c3bd848109`.
**Verdict: APPROVE.** B7-01, B7-02 and B7-03 are closed; no new finding
within the fixes and their direct callers. The original review above remains
historical. Scope: source diff from `d31b47d8` through this fix head, including
GameView admission invariants, Book buttons/freshness, live narration and their
changed regressions. No broader source review was reopened.

- **B7-01 closed.** Projection selects resolved actions by semantic command,
  passes each actual key through ordinary admission, and retains key/command
  separately. The invariant accepts the corresponding exact key and handles
  unkeyed admission across matching offers. Independent loaded-cartridge probes
  replace the room set with `draw_water`, `decant`, `sip`: all three offer exact
  participants, reach actual Book presses and commit their typed commands.
  Target/input narrowing and denied policy refuse with literal expected codes
  and unchanged3/2 rows. Semantic commands also reach Book wording, ownership
  and quantity-aware freshness; the existing intent carries the authored key.
- **B7-02 closed.** Pour receives source `detail_id`, including authored aliases.
  The independent real Book probe confirms the original's Pour is absent from
  the receiver page. The affected production test also exercises an original
  skin nested in the bought satchel: its source history receives the result,
  the receiver receives none, and the nested page stack remains intact.
- **B7-03 closed.** Live replies format retained committed narration through
  the same helper as restoration. Independent real Book presses show amounts
  Fill1, Pour2 and Drink1 from controlled initial3/2 rows, with literal final
  quantities4/2,1/4,2/2 respectively. Cold reopening restores the same detail
  history. The new loaded consumer regression also exercises lost acknowledgement
  and retry for each verb without duplicate history. The old helper-only test
  was replaced with the live consumer proof.

Independent passing checks under pinned mise:

- Kernel liquid, all Book tests, authority liquid, light Book and aliased Read
  Book: **121/121**, exit0. The initial broad run lacked the new worktree's
  TypeScript dependency; after installing the pinned app dependencies, the same
  group passed. No source or dependency declaration was changed.
- Separate loaded GameView→Book→receipt→cold-reopen probes: **12/12**
  allowed/target/input/policy cases across all three authored liquid keys, exit0.

Three independent disposable mutations at the exact fix head each fail, exit1:

1. Bypass only keyed `refusal` in liquid projection: the narrowed-action
   regression sees actual available=true instead of false.
2. Remove only Pour's source ownership metadata: the exact-pair/nested Book
   regression sees undefined `detail_id` instead of the literal original ID.
3. Restore combat-only live narration formatting: the loaded Book regression
   fails its required committed quantity assertion.

All three were exactly restored; the affected kernel/Book liquid group passes
**13/13**, exit0, with an empty source diff. The disposable worktree was removed.
**Ponytail Review:** no additional complexity finding; the fixes reuse existing
semantic display metadata, detail ownership, keyed admission and narration
formatting. No source/test edit is included in this review-only record commit.
Separate save/protocol approval and accumulated publication/CI/browser gates
remain their own requirements. No merge or push was performed.
