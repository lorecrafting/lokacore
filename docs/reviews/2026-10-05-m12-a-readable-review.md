# M12-A first readable details — independent review

PR: #177. Source reviewed: `fe0f79aebd5af623f3b8bc6dd5ffcedddeff9e66`.
Reviewer: fresh independent Codex agent; authored none of the implementation.

## Requirements derived before the diff

- `readable@1` owns detail-only `read`: exact actor-room detail identity, `invalid_target` for unknown/non-readable/entity/room targets, `not_present` for remote readable details. Accepted Read emits exactly one authored Text, empty operations/events and unchanged RNG; repeated reads add no gameplay state or logical duration.
- Compiler and loader require both catalog TextKeys and the capability lock. Projection, invocation and direct admission must share composed ActionSet policy, exact targets and scene/combat exclusions; the view invariant must catch mismatches.
- Book uses the projected label/target and confirms narration once in World. Pending, refused and stale attempts cannot show reading text. Receipt retries/reopen and elapsed-only freshness retain the existing authority boundary.
- The actual Missing Child chapter advances to 0.0.2 with the landing notice and inn rumor board, separate observational descriptions and approved copy. The independent oracle changes by version; historical pins stay frozen. No extra gameplay writer, schema for saves, modal, quest/topic grant or timer.

Governing clauses: [composition](../system/architecture.md#building-mechanics-by-composition), [readable](../system/mechanics.md#readable1-mechanicsreadablerulets), [cartridge](../system/cartridge.md#source-layout), [GameView](../system/protocol.md#gameview), [Book World](../system/book-ui.md#world-and-status-entry), [freshness](../system/book-ui.md#live-action-freshness), [PM adoption](../decisions/pm-decision-m12-a-readable-2026-10-05.md).

## Verdict

**CHANGES REQUIRED** — one blocker, M12A-R1. No other findings.

## Finding

**M12A-R1 — blocker — `mobile/app/book/model.ts:92`.** World loses a valid projected Read when its authored action key is an alias. A loaded cartridge can define `peruse` with `command: "read"`, entity scope `inspectable_details`, empty input and an always-true policy, and subtract the engine `read` action from Ferry Landing. `gameView` then advertises the available `peruse` with the notice's exact target and label, and `step(..., "peruse")` accepts it with `readable.notice`. `buttonsOf` retains the invocation, but `group().place` returns no button because its target-bearing exception requires the literal key `read`. `RoomPage` renders only that group, leaving the player unable to read the notice. This violates Book's projected Read contract and composed ActionSet behavior.

Preserve projected place membership through grouping instead of recognizing a single action key. Add a controlled alias case that proves the available World control retains its original action key and detail target; do not expose entity-only controls as place actions. The existing production tests exercise only the engine key and miss this failure.

## Independent verification

- Queried PR #177 at the exact source SHA: all six started checks completed successfully (`changes`, `lint`, `elixir`, `typescript`, `sim`, `bundle`).
- Focused source baseline: 23 passing Node tests across runtime Read, terminal aliases, loader room validation, real SQLite/Book Read and the active Maud reward/storage proof. Compiler/source checks: 18 passing Elixir tests (`content_rooms_test.exs`, `content_missing_child_test.exs`).
- Tested the tests in the detached review worktree, restoring each original before continuing: deleting the actor-room presence comparison fails wrong-target/projection tests; changing narration from readable text to observational description fails exact runtime narration and production Book/recovery/freshness tests; removing the invariant's exact-target equality fails the substituted-target test. All three mutations exit 1. Restored runtime, Book, actual App and transcript suite: 15 passing tests, exit 0.
- Reproduced the alias failure above with a schema-valid artifact accepted by the actual loader, a selected accepted Read and the actual `buttonsOf`/`group` functions. This is an observed source defect, not inferred from names or a source-text assertion.
- Reran the supplied schema sweep against this head: 256 removals, 212 killed, 44 explained equivalents (42 required union discriminators already required by dispatch, two `minItems: 0`), zero unexplained. Independently removed the new readable `label`, readable `text` and Read `target_id` requirements in memory: literal malformed values change from `missing_property` to accepted, demonstrating red controls for each new required field. GameView's schema change is descriptive only.
- Regenerated the independently declared Python v0.0.2 artifact and IdSource answers: byte-identical to the committed new fixtures. Historical chapter/sampler hash and ID fixtures have no diff; every prior invalid fixture entry remains unchanged, with 16 entries appended. Current-source compiler parity and recorded transcript replay pass.
- Read compiler/loader ownership and text validation, exact invocation targeting, final combat/scene restrictions, query/selector budgets, receipt recovery, current pin/refusal and elapsed freshness paths. Read introduces no gameplay writer, persisted reading state or elapsed privilege. Real SQLite tests prove committed lost-acknowledgement retry, single receipt/narration and cold reopen; unchanged genuine failed-COMMIT and pin-refusal suites remain covered by source-head CI.

## Composition and Ponytail review

The mechanic reuses existing detail identity, the actor's body/container, ActionSet admission, authored narration and authority receipts. It names no chapter or NPC and adds no dependency or save machinery. Moving the existing verb metadata out of the size-limited actions file preserves its behavior. Ponytail: lean already; no complexity finding. The presenter alias defect above is correctness, not a request for an abstraction.

No owner Simulator or native preview was run; PM batches that separate acceptance step. Review worktree code mutations were restored, and only this record plus the review index are committed.

## Separate protocol opinion (verbatim)

This supplemental opinion does not supersede the primary M12A-R1 finding or verdict.

```text
APPROVE
PR177 source head: fe0f79aebd5af623f3b8bc6dd5ffcedddeff9e66

Findings: none.

Read's closed command schema, inspectable_details scope, embedded readable metadata and capability ownership agree with the adopted contract. Compiler/loader checks require readable@1 and both catalog references. Generated contracts, residency and feature mapping are consistent. Projection retains exact detail targets and authored labels, respects composed admission, and suppresses Read during scenes/combat. Accepted Read returns one authored narration with empty operations/events and unchanged RNG/state.

Validation:
- Independent contracts.exs --check and features.exs --check: exit 0.
- Reproduced schema sweep: 256 removals, 212 detected, 44 redundant, zero unexplained survivors. Redundancies are independently enforced discriminators or minItems:0.
- Focused kernel tests: 96 passed. Book/current-chapter storage tests: 5 passed. Validator/save/recovery tests: 40 passed.
- Meaningful independent red control: removed the current-room guard through an in-memory Node loader transformation. Remote-target refusal and exact-projection tests failed; 2 failures among 6 Read tests. Tracked source was never edited.
- Direct v001-save/v002-bundle probe: pinned_release_missing; database bytes unchanged.
- Inspected compiler/loader ownership/reference mutation evidence; compiler tests were not independently rerun. Optional App-shell test lacked TypeScript in the isolated checkout.
- Ponytail review: no unnecessary machinery identified. Isolated checkout removed.
```
