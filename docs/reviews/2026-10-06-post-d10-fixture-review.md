# Post-D10 authority fixture independent review

- Branch: `fix/post-d10-authority-fixtures`.
- Base: published `main` at `87ac4cbb`.
- Exact source reviewed: `c34e22c22992737206dce5bde81b60bf999258cb`.
- Reviewer: fresh independent Codex agent; authored none of the source changes.
- Final source reviewed: `5402b30595e6aa6bfad62d4b1c1726e920928080`.
- Final verdict: **APPROVE**. R1 closed; no open findings.
- Initial verdict at `c34e22c2`: **CHANGES REQUIRED**, superseded by the scoped recheck below.

## Governing requirements

[Opening a story and receipts](../system/save.md#opening-a-story),
[D9 recovery](../system/save.md#d9-village-consequence-recovery), and the
[pre-production decision](../decisions/owner-decision-preproduction-compatibility-2026-10-04.md)
require genuine genesis, accepted ancestry/story/death/custody history, exact release
references, and unchanged corruption refusal. No fabricated receipt, save-guard bypass,
frozen-fixture rewrite or owner-save operation belongs in this repair. Existing behavior
assertions must survive; the [test discipline](../../AGENTS.md#writing-tests-every-change-every-agent)
requires each claimed guard's realistic violation to fail.

## Finding R1 — blocker: transport-only fixture masks its named regression

At `mobile/authority/local-story/transport.test.ts:487`, the stripped cartridge still
activates accepted-history replay through knowledge, water and food, and through
readable books, careful Harvest and a shop discount. Independently deleting only
`!Object.keys(fresh.cartridge.transports ?? {}).length &&` from
`mobile/authority/local-story/liquid-save.ts` leaves the named transport-only test green
(1 passed, exit 0). A regression dropping transport as an independent replay producer
therefore escapes this claimed regression test; another producer catches its forged event.

Keep the crossing/reopen/forged-event/unchanged-storage assertions, but isolate a valid
cartridge whose only history trigger is transport. The transport-trigger deletion must
then fail at the forged-event refusal; restoring production code must pass. No production
change is requested.

## Independent checks and assessment

The five changed test files passed **25/25**, exit 0. Independent temporary controls
all failed their existing focused test, exit 1: selected `fresh()` used as release genesis
(`save_corrupt`), missing accepted Study Take (recovery entrance rejected), and stale
Book service version `0.0.32` (`unsupported_capability`). All mutations were restored.
The transport-trigger deletion above was the surviving control. A runtime probe verified
zero liquid/service/population/fuel/patrol/exchange producers and the remaining triggers
listed in R1. Developer full-suite and full-check results remain attributed to the
[repair evidence](../evidence/2026-10-06-post-d10-fixture-repair.md).

The remaining diff is sound: ancestry is committed once, accepted story actions earn D9
state, authored deterministic combat creates the Study corpse, and cold load/replay/fault
assertions remain. The Book uses its frozen v035 fixture's service reference. No test is
removed or skipped. Removing Western Ashmere's evolving whole-cartridge hash leaves its
literal prose, room, custody and no-story-credit assertions intact. Production save guards
and frozen fixtures are unchanged; review used only disposable SQLite files.

Ponytail Review: no framework, dependency or production abstraction added. The existing
shared SQLite setups justify the 545-line transport and 507-line water test allowances;
splitting would scatter their fixture/fault setup for small excesses over 500. R1 needs a
bounded fixture correction and behavioral red control, not another checker framework.

## Scoped R1 recheck — APPROVE

Exact correction: `5402b30595e6aa6bfad62d4b1c1726e920928080`. The fixture removes
the remaining independent history triggers and their dependent declarations, without
changing the crossing, reopen, literal balance, forged-event refusal or unchanged-storage
assertions. No new test, helper or production edit was added.

The reviewer independently deleted only the transport predicate in `liquid-save.ts`:
the existing test now fails at the intended refusal, actual `open` versus expected
`save_corrupt` (1 failed, exit 1). After exact restoration, all **25 focused tests pass**
(exit 0, no skips). `git diff --exit-code HEAD -- kernel mobile` confirms that no review
mutation remains. **R1 is closed.**

The resulting 563-line transport test retains the same cohesive shared fixture and
is within the test escape hatch; the 507-line water allowance remains justified.
Ponytail Review: Lean already. Ship. The review record's documentation/link check passes.
Full accumulated publication checks and hosted CI remain PM-owned delivery gates;
this review does not resume paused native work or claim a new full-gate run.
