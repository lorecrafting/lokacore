# B2 Chandler's Debt implementation — independent primary review

Local draft PR, integrated source head `8da75b87` against local `main` `552e00ac`, 2026-10-05. I authored none of the 52 changed source, content, contract, fixture or test files.

**Verdict: CHANGES REQUIRED.** Two open findings.

## Requirements derived before the diff

The adopted B2 decision and the active mechanics, cartridge, protocol, save and Book clauses require Peg's optional all-hours offer to disclose the actual on-time cutoff before acceptance, bind and transfer her original ledger with one occurrence-bound expiry, allow direct-body delivery to the public original Aldric at inclusive times 151200 and 237600, settle due work before input at 237601, conserve the funded 10 pennies on time, and refuse contradictory saved quest, fact, receipt, custody, job and balance rows as `save_corrupt`. GameView and Choose must agree; carrying or funding refusal must leave the choice and state unchanged.

## Findings

- **B2-P1 — blocker — `mobile/authority/local-story/deadline-save.ts:155`.** On an ordinary saved on-time delivery, change only the persisted `priory_fen_axis` fact from `2` to `9` and cold reopen. The authority returns `open` while the quest, on-time status and retained choice receipt still claim a +2 outcome. The selected save clause requires reconciling the outcome's facts against the receipt; the Book can present an invented allegiance. The new receipt checker validates `fact.assign` but skips the authored `fact.adjust` (`dialogue-receipt.ts:253`), and `deadlineSave` never validates this axis. A controlled real-SQLite probe expected `save_corrupt` and failed with actual `open`.
- **B2-P2 — should-fix — `cartridges/ashmere_missing_child/text.json:273`.** Before acceptance at or before 151200, Peg's visible prompt says only that Aldric is waiting and the selectable offer says “by the deadline.” The actual second-day-six cutoff appears only in the narration after acceptance (`:276`). A player can accept without seeing the promised cutoff, contrary to the explicit Book and B2 offer clauses. State the actual cutoff in the offered choice or prompt.

## Validation and simplicity

Focused Node contract, kernel and real-SQLite authority tests: 13 passed at the integrated head. In a throwaway worktree, changing the through-window comparison from `>` to `>=` made the 151200 boundary test fail; removing the payment lowering made the on-time and later-expiry tests fail. Both mutations were restored. A separate real-SQLite altered-axis probe failed its `save_corrupt` expectation as described in B2-P1; it was removed after capture. `git diff --check` passed. Focused Elixir tests could not start in this sandbox: Mix's TCP filesystem lock returned `:eperm`; the developer's full check result was not independently rerun here.

Ponytail Review: Lean already. Ship. The new reconciliation code is long, but its row, receipt and transaction checks protect the selected save boundary; I found no safe duplication or unused machinery to cut.

## Scoped fix recheck — 2026-10-05

**APPROVE** at integrated source head `ce56f24c`. B2-P1 is closed: `deadlineSave` now compares the saved Priory/Fen fact to the authored `fact.adjust` outcome and the bound terminal receipt; the new real-SQLite altered-axis test returns `save_corrupt`. Its payment and expiry receipt checks also bind original balances, actor scope, writer group and due-event cause. B2-P2 is closed: Peg's selectable pre-acceptance text now says “by the second day at six.” The independently generated v016 hash and IDs reproduce the committed fixtures byte for byte.

The changed `deadlineSave` path and its `store.load` and committed-dialogue callers were checked. Sixteen focused contract, kernel and authority tests passed on the restored source. Removing the saved-axis comparison made the new SQLite corruption test fail with actual `open`; restoring it returned the suite to green. The App chapter test could not start in this throwaway checkout because its `typescript` dependency was absent; the developer reports it passed in the installed checkout. No finding remains open. Scoped Ponytail Review: no new unnecessary abstraction or removable guard.
