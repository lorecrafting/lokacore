# Q2-B independent review — PR #188

Source reviewed: `e4a802997ee9cda671fed8742b1094df1cf83070`. Reviewer authored none of the implementation.

## Requirements derived before reading the diff

- Only an accepted meeting after active Q2 and Study binds the original living Wren/Vesper and records reached-Wren. Both remain reachable at all hours; descriptive interactions grant no progress.
- The authored bank supports the answer with its exact multiplicity. Malformed, absent, extra or impossible-bank answers refuse. Bank-valid wrong answers commit one narration line, preserve the continuation and allow immediate retry; correct answers resolve once and assign the fact atomically.
- Original bound identities, living co-location, command identity and answer intent remain authoritative across replay/reopen. Departed/dead participants block Choose but allow Close.
- Book offers bounded local tiles after history, preserves sent retry identity, refreshes only the same offered answer, and routes eventless wrong and resolved correct narration to the original speaker once. Corrupt receipt evidence fails closed.
- Four journal stages reflect facts while Q2 stays active. No escort, message, terminal status or rescue claim ships. Compiler/loader contracts, independent release oracles, schema red controls and changed-row transaction guarantees hold.
- Composition uses existing policies, facts, choices, narration and receipts without content-specific kernel cases or speculative machinery.

## Verdict

**APPROVE.** No blocker, should-fix or nit findings. No open primary-review items.

## Source review

- `kernel/ts/src/mechanics/dialogue/rule.ts:98` revalidates the saved participants before answer admission; malformed/impossible input refuses, wrong input emits only its authored line, and correct input uses the existing atomic choice/fact path. `shared.ts:81` checks both original NPC identities for living co-location while Close remains independent.
- `cartridges/ashmere_missing_child/dialogues/a_vesper_meeting.json:1` gates the accepted meeting on active Q2 and studied tracks. Ordered meeting/riddle/answered dialogues plus informational replies implement the adopted boundary without an escort/message placeholder. Both new facts are player scoped. No NPC attack profile, wait gate or terminal child-status writer was introduced.
- `kernel/ts/src/view/view.ts:215` selects the first holding active journal variant without changing quest objective/lifecycle. The content preserves the four stages and active Q2 after success.
- `mobile/app/book/Menu.tsx:61` uses bounded tile indices to preserve duplicate letters; Backspace/Clear/Submit use local state and the ordinary button input path. `model.ts:285` includes the whole projected choice in freshness identity while allowing the selected answer to differ from an unfilled offered button. Pending retries retain the original invocation/answer.
- `mobile/app/book/presenter.ts:83` requests narration by the accepted invocation's command ID, including eventless wrong answers. `mobile/authority/local-story/dialogue-receipt.ts:10` validates command, source, beat, original roles, answer, narration and root resolution evidence before routing to the speaker. Existing changed-row commit/reconcile and cold-reopen paths remain in use; no table, format or transcript was added.
- Compiler/loader checks reject missing choice/text references, insufficient duplicate tiles, malformed policies and either feature below API1.9. The Python release oracle declares semantics and allocation order independently of compiler/kernel; its source-text copy is limited to the documented prose catalog. Historical fixture files are unchanged.

## Independent checks

- `mise exec -- node --test kernel/ts/test/{wren_riddle,cartridge_riddle,riddle_contracts,dialogue,quest_dialogue,journal}.test.ts mobile/authority/local-story/{wren_riddle,saves,recovery,faults,journal,combat,combat_schedule}.test.ts mobile/app/book/{riddle,presenter,combat}.test.ts mobile/app/chapter.test.ts`: **116 passed**, exit0 after restoring both mutations. Includes actual report/Study flow, original-role departure/death/substitution, file-backed before/wrong/correct cold opens, exact replay/changed-answer conflict, corrupt evidence, elapsed freshness, failed and lost COMMIT, and existing combat/recovery routing.
- `mise exec -- mix test test/loka/content_riddle_test.exs test/loka/core/riddle_contracts_test.exs test/loka/content_missing_child_test.exs --force`: **5 passed**, exit0.
- Removed tile consumption at `kernel/ts/src/mechanics/dialogue/shared.ts:62`: the named wrong-answer test failed, exit1, because excess repeated letters were accepted as `riddle_wrong` instead of `invalid_state`. Restored before the green run.
- Removed root evidence validation at `mobile/authority/local-story/dialogue-receipt.ts:58`: the named saved-corruption test failed, exit1, with `Missing expected exception` when the stored resolution evidence was absent. Restored before the green run.
- Independently traversed the five new schema roots, deleting each required member/pattern/minItems/maxItems constraint from generated definitions and running the literal fixtures: **19 mutants killed, zero survivors**. No mutant was committed.
- `python3 test/loka/cartridge_missing_child_hash.py` reproduced both committed v010 fixtures byte-for-byte; hash `86bf2f39ca5386235dae8fa89826b4357c74e38a57f26ad8b254a0cba49fa994`. The compiler test independently matches that artifact.
- All **22** retained evidence files matched `SHA256SUMS`. Reviewed the retained initial routing failure, surviving initial binding mutant, corrected controls, and final sweep reports. The helper's compiler/loader mutation report retains classifications rather than raw logs, as disclosed by the evidence README.
- Remote checks on the reviewed source head were all green: changes, lint, elixir, typescript, sim and bundle. Record commit/push uses the ordinary repository hooks.

## Composition and Ponytail Review

The adoption's composition statement matches the actual consumers: ordered policy-selected dialogue reads quest/fact state, durable roles supply identity, choice/fact consequences own writes, and the shared receipt path owns narration recovery. Active journal variants reuse policy evaluation and have an immediate content consumer. Kernel behavior contains no Wren/Vesper/lantern-specific branch. No dependency, graph, follower scaffolding, alternate storage writer or copied whole-state action path was introduced. **Lean already. Ship.**

## Limits

Headless React controls establish behavior and ordering, not native appearance. Native/UI blur verification remains deferred per the task boundary. No Metro, DeviceHub, Simulator, preview/native tooling or owner-save access occurred. Q2-C remains the adopted rescue/return consumer; it is not an open Q2-B defect.

## Independent Sol protocol/save second opinion

The PM ran a fresh read-only Codex Sol opinion on the exact source head. Its answer is reproduced verbatim.

```text
VERDICT: CHANGES REQUIRED
HEAD: e4a802997ee9cda671fed8742b1094df1cf83070

R1 — should-fix (P2)
mobile/authority/local-story/dialogue-receipt.ts:29
Failure scenario: after a correct answer resolves the riddle, its retained ChoiceRow has source=null or a missing source in otherwise valid saved JSON. dialogueDetail calls refString(row.source) before validating it, throwing an untyped TypeError. On reopen, localSession reports no save_corrupt kind and startOver=false, leaving the player without the required recovery control.
Reproduced using real in-memory SQLite and the actual localSession path. Restoring the original row restores successful reopen.
Validate the stored source before dereferencing it and route malformed identity through typed save_corrupt handling, preserving genuine SQLite errors.

VERIFICATION
- Exact source head confirmed; reviewed against origin/main.
- Ten focused tests passed: loader/API gates, answer validation, participant identity/availability, receipt corruption, UI controls, freshness and failed/lost COMMIT reconciliation.
- All 68 literal schema controls passed in both kernels.
- Independent Python hash/allocation pins matched; current Elixir compiler matched the chapter artifact.
- Persisted-row reopen passed before answering, after wrong and after correct; exact wrong-answer replay succeeded and changed-answer replay conflicted.
- Old 0.0.9 release was refused without changing authority rows; genuine SQLite read errors remained storage errors.
- In-memory red control disabling wrong-answer comparison failed with actual=answer, expected=riddle_wrong.

LIMITS
- File-backed/process-restart tests and full CI were not rerun; six green source-head jobs were supplied by the requester.
- No files modified, native/preview/device tooling run, or owner saves accessed.
```


## Scoped primary re-review — fix round 1

Fix source: `ac43394a1bd15d6bd4a69343b9f361b99a756c82`. **APPROVE; R1 closed.** No open primary findings. This pass reviewed only the fix and its direct receipt/narration/session callers; the original source verdict and independent Sol finding above remain historical.

- `mobile/authority/local-story/dialogue-receipt.ts:29` now validates the stored `DefinitionRef` before `refString` dereferences it. Invalid saved identity uses the existing malformed-JSON corruption route. `save.ts:161` and `session.ts:60` preserve the receipt dispatch and narrow corruption classification; genuine database errors are not caught or relabeled by this guard.
- Independent disposable file-backed SQLite probe followed actual report → Study → meeting → correct answer, closed the connection, and verified the intact saved receipt still reopens resolved with narration `narration.b_vesper_riddle` routed to the literal Vesper identity. Separately wrote null and omitted `source` into the retained resolved ChoiceRow, closed/reopened each database, and observed `save_corrupt`, Start over available, and explicit Start over opening a fresh game with empty journal and no pending choice. Exit0; test databases removed.
- Independent adjacent-error control acquired a real SQLite `BEGIN EXCLUSIVE` lock from a second connection at the narration SELECT. The resulting `SQLITE_BUSY` remained a storage failure, with no corruption kind and `startOver=false`; no file replacement or reset was offered. Exit0.
- Removed the new source guard in the disposable worktree and ran the named `malformed retained riddle source` control. Both null/missing subtests failed, exit1: actual error kind `undefined`, expected literal `save_corrupt`. Restored the guard before validation and committed no mutant.
- `mise exec -- node --test mobile/authority/local-story/{wren_riddle,session,start_over}.test.ts mobile/app/book/presenter.test.ts`: **40 passed**, exit0 after restoration. Includes existing valid replay/identity, narration routing, malformed receipt, elapsed freshness and failed/lost COMMIT behavior.
- All **24** retained evidence checksums verified, including the fix's red and restored-green logs. Ponytail Review: one existing boundary-validator call is sufficient; no new catch, abstraction or persistence machinery. Record commit/push uses normal hooks. No native, preview, device or owner-save work occurred.

## Independent Sol scoped fix recheck

The PM ran a fresh read-only Codex Sol opinion on the exact fix source head. Its answer is reproduced verbatim.

```text
VERDICT: APPROVE
HEAD: ac43394a1bd15d6bd4a69343b9f361b99a756c82

R1 CLOSED. No new findings.
mobile/authority/local-story/dialogue-receipt.ts:29 validates saved source before dereferencing it, enabling typed save_corrupt recovery.

VERIFICATION
- Six focused repository tests and four independent real-SQLite in-memory controls passed.
- Null/missing and other malformed sources offer Start over without changing authority rows before explicit recovery.
- Explicit Start over produces a working new run, clears receipts and preserves reports.
- Valid wrong/correct receipts preserve command and original-speaker identity across reopen; exact replay succeeds and changed-answer replay conflicts.
- Genuine SQLite errors, including an error injected at opening narration’s read operation, remain operational errors without a Start over offer.
- Independent red control removed only the guard through an in-memory module hook: both new source cases failed with missing save_corrupt kind, exit 1.
- Fix and direct callers reviewed; no unnecessary machinery found.

LIMITS
File-backed/process-restart tests, full checks and remote CI were not rerun. No files modified, owner saves accessed, or preview/Metro/Simulator/device/native tooling run.
```
