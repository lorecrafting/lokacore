# M1-B3 — still-offered Book controls across live-clock redraws

- PR: [#173](https://github.com/lorecrafting/lokacore/pull/173)
- Reviewed source commit: `0c0e44e401bcf37cbed6db72e817c5a834724542`
- Reviewer: fresh independent Codex agent; authored none of this slice.
- Verdict: **APPROVE**.

## Requirements derived before reading the diff

From [Book live action freshness](../system/book-ui.md#live-action-freshness), [GameView](../system/protocol.md#gameview) and the [preview-save decision](../decisions/owner-decision-preproduction-preview-saves-2026-10-04.md):

1. An elapsed-only redraw permits the original still-offered action, with the same key, ordered targets and structured input, actor, room, choice/continuation, scene and combat context.
2. Movement preserves the captured destination and door state; position preserves its drawn position. Changed context or a confirmed intervening player invocation keeps the original token and receives the authority’s stale refusal, with no substituted target or extra movement.
3. Pending retries preserve the sent invocation, token, receipt and presentation context. Authority freshness/admission and clock/schedule progression remain intact.
4. All offered Book paths, including choice/Leave, scene/combat, item pair actions and post-Maud west movement, share those rules. No optimistic success or invented narration is permitted.
5. Cross-build preview-save compatibility is not added; same-build durable save/retry/reopen and explicit Start over remain required.

## Findings

None. No code, fixture or authority-contract changes are requested.

## Verification

- Source-head CI: all six jobs green at the reviewed commit (bundle, changes, Elixir, lint, simulation and TypeScript). [CI run](https://github.com/lorecrafting/lokacore/actions/runs/37259396810), [bundle run](https://github.com/lorecrafting/lokacore/actions/runs/37259396803).
- Independently ran `mise exec -- npm test` in `mobile/app`: 288 tests, 287 pass, one existing skip, zero failures. This includes the new real-SQLite post-Maud acceptance → elapsed pulse → west-exit regression, with the literal Well Lane destination and no stale message.
- In the detached review worktree, bypassing `liveButton` fails the Bram drag, Maud/position/item and combat elapsed-redraw tests (three failures).
- Removing both generation increments fails the existing room/details test and position-cycling test (full mobile suite: two failures), proving same-context old controls cannot be reused after another confirmed press.
- Removing the current offered-action membership check fails the departed-Bram regression (one failure), proving matching room/context alone is insufficient.
- Restoring Book’s unconditional old-token routing shortcut fails the confirmed pickup/return-to-World regression (one failure).
- Every mutation was restored; the reviewed source diff is unchanged. No owner Simulator or native/UI run was performed or claimed.
- Tests use controlled clocks, real SQLite, literal cartridge-derived expected destinations/IDs and behavior/receipt assertions. No frozen fixture or expected contract answer was changed.

## Architecture placement and simplicity

The owner’s subscribed-state question was assessed against the actual invocation paths. `Book.tsx:57` subscribes to current GameSession state; `presenter.ts:176` reads the latest projection at press time and matches the captured semantic action through the existing `buttonsOf` projection. These already provide current state. A gesture or saved handler can still retain an earlier action after redraw; resolving only “north” or “Close” from the latest state could move from a different origin or close a different continuation. The origin/action/context and generation guards preserve that distinction, with current authority freshness/admission still enforced by `game.invoke`.

Keeping this adaptation in the presenter is safe and proportionate for the specified Book behavior. The authority’s token stays the command boundary, pending attempts stay unchanged, and no session/protocol redesign is needed for this bug fix. Any later change that removes authority freshness tokens would be a separate contract decision.

Ponytail Review: **Lean already. Ship.** The existing presenter and button projection are reused; there is no new dependency, authority mechanism or speculative abstraction. The extracted screen helper keeps the existing file/function limits without adding a layer.
