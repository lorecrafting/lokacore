# B2 Chandler's Debt — independent save/protocol second opinion

Reviewed integrated local `integration/b2-chandlers-debt` commit `8da75b876a78910e449244251b05478a7086b70d` against `552e00acf9b066816d9f91a4949be89f34661c7a`. I authored none of the implementation. **CHANGES REQUIRED.** This is a separate save/protocol opinion, not a primary implementation review or a claim of full CI.

## Findings

1. **B2-S1 — forged payment prior balances survive cold reopen.** In `mobile/authority/local-story/dialogue-receipt.ts:139–153`, payment evidence checks the two ten-penny differences and identities, while `deadline-save.ts:178–181` separately checks only final state rows. A receipt can therefore claim Aldric `100→90` and the player `50→60` with the real saved rows still Aldric `0`, player `30`. In an isolated real-SQLite test, I changed only those four numbers in the retained accepted on-time receipt; `openStory` returned `open`, where the selected save contract requires `save_corrupt`. Bind the receipt's exact before/after values to the original funded row and final row, accounting for the one permitted transfer; test a cold reopen after this mutation. The retained receipt currently does not justify the saved money.

2. **B2-S2 — expiry receipt fact scope is not bound.** In `mobile/authority/local-story/deadline-save.ts:270–289`, `expiryReceipt` checks the fact references and expected/new values but never their scopes. In a second isolated real-SQLite test, I changed only the saved expiry receipt's `peg_trust` `fact.assign` scope to another valid player CharacterId. `openStory` again returned `open`; this should be `save_corrupt`. Check both receipt fact scopes against the actor's actual fact scope (and the writer group/causal evidence of the same completed job). This is an independently plausible cross-scope corruption despite the current row still holding `−5`.

## Checks and limits

The 13 focused B2 kernel/schema/real-SQLite tests passed at the reviewed head with `node --test --experimental-strip-types`. The two planted SQLite mutations above failed as red controls (actual `open`, expected `save_corrupt`) and were removed from the isolated checkout after observation. The existing focused tests cover original acceptance, the four literal deadline boundaries, saved acceptance and turn-in, missing job, and saved expiry. I inspected due-before-input schedule dispatch and shared dialogue availability; I found no separate defect there. I did not run full `bin/check_all.sh`, exact-head CI, or an uncertain-COMMIT campaign, so this opinion does not certify those paths.

Ponytail Review: no unnecessary abstraction or machinery found in this save/protocol diff; the additional checks belong at the existing receipt trust boundary. **Lean already.**
