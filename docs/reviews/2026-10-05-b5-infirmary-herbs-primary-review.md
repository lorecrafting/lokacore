# B5 Infirmary Herbs — independent primary review

Local draft branch `chapter-one/b5-infirmary-herbs`; exact source head
`802edd92c975295b0c83526d6e15a508979e366a` (B5 source delta from `0d485096`).
Verdict: **CHANGES REQUIRED**.

## Acceptance derived before the diff

- [Mechanics](../system/mechanics.md#s9-infirmary-herbs-b5-selected-contract):
  public all-hours route/Wick; deterministic one-item harvest conserving direct
  room custody; exact direct-held identity/occurrence bindings and atomic exchange;
  terminal-only explicit repeat; final carrying admission; independent actual-gain
  contribution; optional supply and ordinary recovery.
- [Cartridge](../system/cartridge.md#b5-herb-and-bandage-stock): twelve distinct
  herbs and bandages fund four three-for-three exchanges, masses 20g/10g,
  increment +1 and cap +3; compiler and loader independently reject invalid stock,
  references, holders and tuning. No mint, restock, wait or content engine literal.
- [Protocol](../system/protocol.md#b5-harvest-and-exchange-composition) and
  [save](../system/save.md#b5-stock-and-repeat-recovery): shared bounded queries,
  paired retirement/fresh activation, exact receipt proof and one transaction;
  lawful intermediate custody/repeat states reopen, corrupt rows refuse without
  repair, uncertain commit and replay preserve all prior or all next truth.
- [Book](../system/book-ui.md#b5-herbs-and-wick-details): confirmed finite supply,
  retrieval/refusal, explicit funded Accept/Reaccept/Turn in and truthful journal;
  no unfinished bandage-use/herbalism controls. Tests require independent expected
  answers and observed behavioral red controls.

## Findings and validation

- **B5-P1 — blocker**, `mobile/authority/local-story/exchange-save.ts:48`:
  history replay calls player `step()` for trusted elapsed receipts. Player step
  explicitly refuses elapsed. A fresh B5 save accepts elapsed 64800→64801, then
  `openStory` returns `save_corrupt`; real SQLite rows stay unchanged. Ordinary
  foreground/resume elapsed delivery therefore makes even unaccepted S9 saves
  unreopenable. Replay each command through its appropriate trusted boundary and
  add the focused B5 elapsed/reopen regression. Open.
- **B5-P2 — should-fix**, `kernel/ts/src/mechanics/dialogue/shared.ts:147`:
  the added static-role identity lookup re-resolves already pinned roles for every
  dialogue. After Talk, changing the definition→ID lookup while the original bound
  NPC/item remain valid makes Choose reject `not_owned`; the existing controlled
  regression `kernel/ts/test/dialogue.test.ts:426` expects the original participants
  and now fails. Preserve [bound dialogue roles](../system/mechanics.md)
  while retaining B5's exact participant validation, or explicitly reconcile this
  broader contract change and its test. Open.

Focused B5 kernel, loader/schema, Book and SQLite suites: **15/15 pass**.
Related containment/quest/dialogue/commerce and authority suites: 90 passing;
B5-P2 fails; App chapter test is unavailable here because `typescript` is absent.
Independent wrong harvest-order and omitted outgoing-transfer mutants each exit 1
on their named B5 behavioral test; restored kernel/contract suites **7/7 pass**.
Mutants were removed with their throwaway detached worktree. The elapsed probe
used the real SQLite adapter and confirmed refusal without row repair.

Ponytail Review: lean already; no complexity finding or requested cut. Source
fixes, separate save/protocol review and publication checks remain pending.

## Scoped fix round 1

Source fix `cbb11fcee8830930e05abb17c60a58b40e5748a1`; exact integrated head
`2df52d328adbfdea39a0cde623f6a9f34fffb186`. Verdict: **APPROVE**.
The initial CHANGES REQUIRED and its findings above are retained as history.

- **B5-P1 closed:** accepted elapsed replay uses `stepElapsed` and checks the saved
  run identity. The new literal 64800→64801 regression physically closes/reopens
  file-backed SQLite before S9, then harvests and completes the real exchange.
  Replacing that trusted dispatch with player `step` independently fails the test.
- **B5-P2 closed:** generic role admission retains original bound identities;
  B5 additionally compares continuation participants with the accepted occurrence
  binding and transfers to that bound NPC. Both the pre-existing generic regression
  and the new B5 mapping-drift regression pass. Reintroducing the static-role lookup
  independently fails both tests. The touched readiness, admission, transfer and
  save-loader callers were checked; no new finding.

Scoped kernel/loader/schema/dialogue, Book and SQLite suites: **36/36 pass**.
After both independent red controls were restored, their three named regression
tests pass; the throwaway detached worktree was removed. No broad publication run.
Ponytail Review: lean already; no requested cut. No primary finding remains open;
separate save/protocol disposition and publication gates retain their own scope.
