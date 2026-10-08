# PM decision: B2 Chandler's Debt — 2026-10-05

Under the [autonomous mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md),
the PM adopts the [B2 brief](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/briefs/chapter-one/b2-chandlers-debt-brief-2026-10-05.md)
for the real Missing Child chapter. The selected contract is in
[mechanics](../system/mechanics.md#s2-chandlers-debt-selected-contract-pending-implementation).
This is planning and specification, not implementation proof or permission to merge source.

- Reuse A1's original Aldric in the public Chapel Nave. Peg stays reachable at the chandler
  at every hour; the storeroom is authored space, not an after-hours lockout. S2 is optional,
  cannot require waiting, and cannot depend on the bell choice or an unrelated reading scene.
- Acceptance before expiry transfers Peg's exact ledger to the player and creates one bound
  obligation and one expiry job. It does not manufacture a ledger. Acceptance through day 2
  18:00 advertises the on-time deadline; acceptance after that and through day 3 18:00
  explicitly advertises a late-only result. A player who never accepted has no obligation,
  trust penalty or ledger transfer after expiry; Peg explains the elapsed offer.
- On-time delivery is inclusive at logical time 151200, late delivery is 151201–237600,
  and an active obligation expires at 237601 before input at that time. Completion invalidates
  its expiry job. The accepted expiry fails S2 once and changes Peg trust by −5; it does not
  destroy or teleport the ledger. Death and storage retain exact item identity and elapsed
  deadline. These units derive from B1's authored 3600-unit hour and 24-hour day.
- Adopt one player-scoped Priory/Fen axis, bounded −10..10 and starting at 0, with positive
  meaning Priory favor. On-time changes it by +2; late by −1, each clamped once. Peg trust is
  a separate player-scoped integer bounded −100..100, starting at 0. `priory.tithe_delivered`
  records pending/on_time/late/never at instance scope.
- Pennies are a nonregenerating resource, bounded 0..1000 by this chapter's content. The
  player starts with 20. Bound Aldric holds an explicit 10-penny funding row; on-time reward
  transfers exactly 10 from him to the player in the same committed outcome. Late/expiry
  transfer none. The player start and reward amounts come from archived chapter content;
  Aldric's funding row and the 1000 ceiling are PM selections that may be tuned with the
  first commerce consumer. Neither fact adjustment nor
  saturation can create or erase money. Death retains the player's pennies on the same body.
  B3 may use this resource without a wallet, coin items, shop or bank in B2.

The B1 calendar/status reviewed local head `9bca4307` is a dependency, not a claimed
merge. Source assignment waits for its merge and a current
release re-pin. The owner permits forward development but still requires an independent
release answer, safe mismatch refusal and no silent save deletion.
