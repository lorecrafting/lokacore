# Owner decision: world time starts at first entry — 2026-10-08

Question ([E2 gate audit](../reviews/2026-10-08-e2-gate-fable-audit.md)): `stepElapsed` skips
Step's ancestry gate, so a managed session advances world time while the player is still on the
ancestry screen (two minutes there is 6000 units at rate 50).

Owner answer (paraphrased): world time starts as soon as the player enters the world for the
first time. No time passes while the ancestry screen is shown.

This supersedes the [2026-10-06 pre-choice elapsed
ruling](owner-decision-d11-prechoice-elapsed-2026-10-06.md).

## Effect

- First entry is the accepted `choose_ancestry` decision (the `character.select` row). The
  predicate is `needsAncestry(world, actor)` (`kernel/ts/src/commands/actions.ts`), shared by
  Step, ActionSet refusal and `stepElapsed`. A cartridge without `ancestries` starts world time
  at creation, unchanged.
- The kernel refuses trusted elapsed before selection as `invalid_state`
  ([D11](../system/mechanics.md#d11-character-choice-selected-contract)). The local driver credits
  no wall time before selection; credited time starts at the selection invocation's
  reservation ([save](../system/save.md#durable-elapsed-sessions)).
- No save format, checkpoint row, protocol, GameView or ErrorCode change; no pin is removed.

## Save impact (pre-production, [forward development](owner-decision-forward-development-2026-10-05.md))

- (a) Older chapter-one saves with accepted pre-choice elapsed receipts: a plain reopen keeps
  the committed clock. A reopen that replays receipt history (exchange or liquid history) now
  refuses as a corrupt save, because replay rejects those receipts. No compatibility code.
- (b) Older saves closed with pending pre-choice debt (target above clock): the driver delivers
  it, the kernel refuses, and the Book shows "Time stopped: invalid_state"; Start over is the
  way out. The target is not clamped.
- (c) New saves have no pre-choice receipts or debt.
