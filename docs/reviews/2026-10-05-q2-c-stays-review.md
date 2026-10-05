# Q2-C-stays independent review — PR #189

Source reviewed: `abd54bf2d19220e1d88bb2ec8c128a76102f54a3`. Reviewer authored none of the implementation. Review and temporary mutations used a disposable detached worktree.

## Requirements derived before reading the diff

- Only the complete stays path is offered after the accepted riddle and active actor-owned Q2. Selection rechecks unselected branch, missing status, the original living and present Vesper/Wren, and direct Vesper custody of the unique message. One atomic receive assigns stays; carrying refusal preserves custody and the pending choice.
- Drop/Take, legal Put/Take and real death/corpse recovery preserve the same item. Ordinary Give refuses the protected item and any containing item, while unrelated and emptied containers remain usable.
- Elspeth must be living and present, with the original message directly in the actor body and the branch/quest/status guards still holding at execution. One handoff resolves Q2 as stays and assigns status stays. Arrival, historical/nested custody and stale continuation cannot resolve it. No escort option or rescued/lost terminal is exposed.
- Retained original roles, committed transfer/assignment/quest evidence and current custody agree on reopen. Malformed evidence returns typed save_corrupt. Confirmed narration belongs to its original NPC; pending/refused/stale results cannot print success. Changed-row transactions retain rollback and both unknown-COMMIT fences, exact replay and old-pin refusal.
- API1.10 gates authored Give restriction and nonterminal receive; existing exclusions and legacy terminal receive remain. Independent v011 hash/allocation answers match the actual source while v010 remains frozen. Q1, Maud S1 and all-hours return remain usable.

## Verdict

**APPROVE.** No blocker, should-fix or nit findings. No open primary-review items.

## Source and composition review

- `cartridges/ashmere_missing_child/dialogues/c_vesper_answered.json:1` implements the four policy prerequisites and binds the original message, Vesper and Wren. Its sole carry_message choice reuses receive plus fact.assign. `a_elspeth_return.json:1` supplies the active quest, accepted riddle, stays branch, missing status and possession policy; shared role custody narrows transitive has_item to direct body custody at Choose. The retained branch and terminal roles both resolve to the authored original item. Only this terminal choice writes child status; Green and Elspeth read it. Dialogue ordering retains Q1 and Elspeth directions, and the journal requests delivery/recovery without claiming the nested item is ready.
- `kernel/ts/src/mechanics/dialogue/shared.ts:81` uses the pinned policy and shared counter before the existing living/presence/direct-custody/carry checks. Both pending-option projection and Choose call this boundary. `rule.ts:98` retains the single writer group for transfer, fact assignment, quest transition and choice resolution. Close remains available after refusal.
- `kernel/ts/src/mechanics/containment/shared.ts:21` checks protected descendants using the existing bounded ancestry traversal, including contents behind a closed lid. `rule.ts:69` and `view/action_lists.ts:151` share the restriction. Dialogue hand_over continues through its separate guarded transfer. No content names enter these engine rules.
- `mobile/authority/local-story/dialogue-save.ts:18` validates retained rows and branch assignments, finds the original accepted receipt, rejects impossible NPC custody, and checks terminal receipt/quest/status/original direct custody together. `dialogue-receipt.ts:120` checks root transfer, acquisition, assignment/fact event and terminal quest evidence before detail routing. `store.ts:139` integrates that boundary with the existing typed corruption path. Existing Book receipt selection/freshness and transaction adoption remain in use; no save table, command or transcript was added.
- `kernel/ts/src/content/cartridge_quests.ts:54` and `lib/loka/content/requires.ex:25` gate each new feature independently. Receive still excludes accept/hand_over, and existing type/reference/ownership/carrying checks remain. Generated contracts expose only the optional false-valued item property.

The composes-with claim is accurate: generic authored properties and facts connect dialogue, conserved containment, carrying, death, quest resolution, receipt recovery and Book presentation. No follower scaffolding, new dependency, alternate storage writer or whole-state action copy was introduced. **Ponytail Review: Lean already. Ship.**

## Independent validation

- `mise exec -- node --test kernel/ts/test/{missing_child_stays,reward_storage,reward_storage_content,rule_steps}.test.ts mobile/authority/local-story/vesper_message.test.ts`: **42 passed**, exit0, both before and after restoring all mutations. These include the actual Q1/report/Study/riddle path, capacity retry, protected descendant Give, direct/nested custody, real fatal combat and file-backed cold corpse recovery, exact replay/conflict, NPC narration, elapsed/stale controls, corruption behind a later receipt, failed/lost COMMIT and intact v010 refusal.
- `mise exec -- mix test test/loka/content_missing_child_test.exs test/loka/content_reward_storage_test.exs`: **6 passed**, exit0. The chapter compiler matches the independent artifact; both feature gates and receive/accept exclusion are exercised.
- Independently removed the pinned policy check at `kernel/ts/src/mechanics/dialogue/shared.ts:88`: **exit1**, with branch/status recheck and turn-in tests failing. Restored it.
- Independently replaced ancestry containment with direct item equality at `kernel/ts/src/mechanics/containment/shared.ts:28`: **exit1**, with the protected-message-in-trunk Give test failing. Restored it.
- Independently bypassed transfer evidence at `mobile/authority/local-story/dialogue-receipt.ts:132`: **exit1**, with the retained receipt-transfer corruption control failing. Restored it. No mutant or probe test is committed.
- Additional real-SQLite probe put the received message inside a non-receptacle brass key behind an unrelated later receipt: reopening correctly returned typed **save_corrupt**, exit0.
- Inspected and independently reran the schema sweep against the exact source: **101 constraints**, **60 fixture failures**, **41 closed-subset schema compiler rejections**, **zero survivors**. The new give_allowed const is covered; this is not a claim that all 101 were killed by runtime fixtures.
- `python3 test/loka/cartridge_missing_child_hash.py` reproduced both v011 fixtures byte-for-byte. Its literal semantics/allocation order were reviewed independently of compiler/kernel output; only the documented prose catalog is read from source. Hash: `e45a762f9698a01821b7fedb4394e4dcadd43c909361977d7957a085826d04d0`. Original message ID: `b03b53e3-456d-8c7a-b056-ff22f4adf06d`. The v010 hash and allocation files are unchanged.
- Confirmed source head unchanged and all six GitHub checks green: changes, lint, elixir, typescript, sim and bundle. Record commit/push uses normal hooks.

## Evidence and limits

Nine reviewer logs/results are privately retained in the handoff execution bundle with SHA256SUMS and a separate successful verify output; private paths and identifiers were redacted. The PR has no committed C-stays evidence pack. Developer temporary logs and sweep reports were inspected, but absent developer checksums are not treated as authenticated retained evidence. The adopted contract requires the checks and red controls, not a new repository evidence pack; the critical claims above were reproduced independently.

The full TypeScript/mobile suite and native appearance were not independently rerun; the source-head CI and focused behavior checks bound this verdict. No Metro, DeviceHub, Simulator, preview, native build or owner-save operation occurred. UI blur remains deferred. The rescue/escort path remains a separate future slice, with no unfinished selectable branch in this release.

## Independent Sol protocol/save second opinion

The PM ran a fresh read-only Codex Sol opinion on the exact source head. Its answer is reproduced verbatim.

```text
VERDICT: CHANGES REQUIRED
PR #189, reviewed SHA abd54bf2d19220e1d88bb2ec8c128a76102f54a3.

PS-1 | should-fix (P2) | mobile/authority/local-story/dialogue-save.ts:158
Quest consistency is checked only when received=true. Reproduced: complete Q1 to activate Q2, then change only Q2’s saved row to state="resolved", outcome="stays", before selecting the message branch. Reopen succeeds instead of reporting save_corrupt. The journal claims delivery although branch remains unselected, status remains missing, and the original message remains with Vesper. Q2’s active-policy requirements then prevent completing the path. Validate terminal quest evidence even when no receive row exists; permit legitimate absent/active prebranch states.

VERIFICATION:
- Exact head confirmed; reviewed diff against origin/main, the source parent.
- Required workflow, lessons, decision and governing specifications reviewed.
- 47 focused kernel tests and 17 in-memory SQLite/Book tests passed.
- Additional v011 journey passed Q1, riddle, message terminal, five actual rat kills, Maud reward and session reopen.
- Python oracle reproduced v011 hash/IDs; current changed Elixir compiler modules produced the matching artifact. Historical v001–v010 fixtures remain unchanged.
- API1.10 gates, original-item transfers, protected-container Give, direct-body terminal and absence of selectable escort checked.
- Book detail recovery, exact replay, intact v010 pin refusal, genuine SQLite read-error propagation, failed COMMIT and lost acknowledgement verified.
- In-memory removal of Give protection and Choose policy validation each caused existing tests to fail. Removing give_allowed’s schema const defeated its invalid fixture.
- Ponytail review found no additional complexity finding.

LIMITS:
No files modified. No full check_all rerun, native/UI execution or owner-save access. Reopen probes used new sessions over in-memory SQLite, not file-backed close/reopen. Six source-head CI successes were supplied in the prompt.
```
