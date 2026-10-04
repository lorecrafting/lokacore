# C1 dialogue, Contents and pickup polish independent review

PR #144; final source reviewed `665b3ff6c0fbed1109a8aa13576bad710a623d11`; original base `7845f9b1ab8924013d460b7dda29f21e148eb7e5`. Independent primary authored none; actual model identity unverified. Bounded PM substitute under recorded delegation; separate requested GPT-6.1 Sol runs retained verbatim below.

**Final disposition: APPROVE WITH NOTES.** Source APPROVE; F1/F2/F3 closed. Required inherited native checkpoint is satisfied by inspected fresh independent combined PR148 Release proof at `0e49963f893192d193fac65851aa882be0f597b8`, with owner-deferred UI-FUZZ-01. Original665 full-native walk remains historically incomplete. This review does not pass the whole Gate C1 checklist or invent measured phone response.

## Acceptance and source disposition

Requirements derived before diff from Book UI/GameView and original owner wording: stable mounted NPC history with captured offered freshness; Contents' five status-entry routes; real confirmed-only named Take/Drop return and once-only retry context; command-free item Leave; accepted-place-only World-log clearing; incomplete Give omission without rejecting complete two-target commands; fixed title with genuine offered Look; modal Scene2 recovery and queued chapter precedence; truthful save errors. Original dock/pending-NPC-Leave/position-pane requirements were later explicitly superseded by the [published next-polish owner record](https://github.com/lorecrafting/lokacore/blob/0e49963f893192d193fac65851aa882be0f597b8/docs/decisions/owner-decision-c1-journal-position-polish-2026-10-03.md) and current [Book UI](https://github.com/lorecrafting/lokacore/blob/0e49963f893192d193fac65851aa882be0f597b8/docs/system/book-ui.md).

Every changed file and relevant route/presenter/session caller reviewed; realistic independent mutations RED and restoration GREEN. F1: pending/refused item Reply coverage originally missed premature World return; minimal literal boundary tests now catch it. F2 (initial Sol F1): saved-command narration recovery could throw outside invoke handling; narrow catch retains saved result, truthful fault feedback and clears retry context. F3: combined0.0.2 fixture invalidated old absent-Look expectation; real title callback now proves one receipt and stale drawn freshness/no second receipt. Personally run final focused suite:42 PASS, one existing optional skip. Original NPC-flip, missing-room-reset, duplicate-narration and scoped fix mutants were actually executed. [Chronology](../evidence/2026-10-03-c1-dialogue-contents-primary/source-primary-review-history.md) retains the initial surviving mutant, reproduced storage fault and scoped dispositions.

UI input `eb81d98825610398b08d6bab0e6ffe16822a7245`, content input `e3c4fddf2bb74c5e4ae4a0e79feda14e83beb434`, initial composition `0606d10d37dc0f0b1a49a02ebad8b0dac67d3183`, final665 test/doc fix are distinguished. At665 production Book bytes matched UI input and sampler bytes matched content input. PM personally verified all six exact-head checks; no duplicate full pipeline was run by this primary. Supporting content0.0.2 has genuine hash `813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa`; no fabricated UI Look or old-save compatibility machinery was demanded after owner override.

Ponytail Review and correctness: existing platform/presenter/session harnesses reused; necessary confirmation/recovery validation retained. No complexity finding or new production machinery; net0 lines recommended for removal. Publication contains only records, evidence and review index, with no runtime change.

## Native checkpoint and limits

Personally completed665 native proof was a clean signing-disabled Release, actual pin/stamp, fresh World and genuine title Look advancing0/0→1/1. Owner-adopted preview activity interrupted the remaining walk; external actions were never credited. Its [partial history](../evidence/2026-10-03-c1-dialogue-contents-primary/native-665-partial-report.md) and13 proof artifacts stay historical. Body blur existed at revision0 before Take; cause/zoom unknown.

The [composed checkpoint closure](../evidence/2026-10-03-c1-dialogue-contents-primary/composed-native-checkpoint-closure.md) records this primary's actual read-only inspection of fresh148 primary's108 hashed artifacts, preserved101 proof manifest and separately hashed owner-deferral addendum. Native actions are that fresh primary's execution, not this primary's. Current descriptions/inline history/one Leave/direct cycle satisfy explicit supersession; Contents5, item local Leave/no save change, Take/Drop custody/named once-only events, accepted-room clearing, fixed title/offered Look and modal precedence are supported. Native held detail omits Give; source guard and real-host complete-recipient regression preserve valid mechanics without inventing a touch recipient selector.

Scene2 actual same-target terminate/launch exited0; identical saved line/head/state-row/receipt digests and count23/23 survived. Restored Scene ends before queued The Lantern Found; chapter dismissal changes no metadata at25/25 and later Look does not repeat it. Native fault injection/alternate recipient ending are not claimed. Fresh148 source reviewer additionally ran controlled safety tests/mutants.

Sampled bodies were clear, but later owner-reported intermittent fuzz is explicitly deferred as **UI-FUZZ-01**; no full-fix/diagnosis claim. Exact owner messages and chronology are retained by [PR148](https://github.com/lorecrafting/lokacore/pull/148). Its [canonical review](https://github.com/lorecrafting/lokacore/blob/c1-polish-journal-position/docs/reviews/2026-10-03-c1-next-ui-review.md) and [current native report](https://github.com/lorecrafting/lokacore/blob/c1-polish-journal-position/docs/evidence/2026-10-03-c1-next-ui-primary/native/native-primary-review-current.md) are published on the PR148 branch; local links can follow their main merge. The108 artifacts are not duplicated here. Owner manual Simulator acceptance/defer direction is reported; owner-phone feel/latency remain unmeasured, no explicit latency waiver inferred, whole Gate C1 closure remains PM-owned.

## Retained evidence

[Primary proof and publication notes](../evidence/2026-10-03-c1-dialogue-contents-primary/README.md), [actual final checksum manifest](../evidence/2026-10-03-c1-dialogue-contents-primary/SHA256SUMS) and verify output distinguish personal/source, historical partial native, inspected composed native and separately executed Sol. All text/script captures were privacy-scanned; original private inputs are preserved and additionally redacted publication copies have new actual hashes. Three Sol answers below are verbatim and their source answer hashes match metadata.

## Initial separate Sol review (verbatim)

```text
Verdict: CHANGESREQUIRED
PR: 144
HEAD: 7a2a140ecdadf33a0684124862bcf178a52b64fb
BASE: 7845f9b1ab8924013d460b7dda29f21e148eb7e5
Independent source review; authored none.

F1 | should-fix | mobile/app/book/presenter.ts:181
The new game.lastNarration() storage read occurs outside the invoke error handler. If it fails after an authored command commits, the exception escapes Book.tsx:62 before redraw. The committed consequence is omitted, fault UI remains empty, and presenter retry context is not cleared.
Reproduced with the real sampler/session and in-memory SQLite: fail the fourth getFirstSync operation while accepting Bram’s quest. The quest becomes active and pending=false, but press throws and NPC history contains only the prompt. The control appends the authored acceptance.
Handle this post-commit read failure while preserving the saved result and refreshing the UI.

Personally run:
- presenter.test.ts, model.test.ts, c1.test.ts, polish.test.ts: 32 passed.
- Existing joystick stale-drag test: 1 passed.
- In-memory sampler prompt restoration and Take/Drop probes: expected results.
- Post-commit read-fault control/probe: reproduced F1.
- git diff --check: passed; checkout clean at exact HEAD.

Reported:
- Root independently verified all six exact-head checks SUCCESS; I did not query CI.

Limits:
Read-only source review; no mutations, installs, builds or native/GUI proof. Actual native interaction and owner phone/Gate C1 acceptance remain separate pending work. Sampler 0.0.1’s absent Look and conditional fixed-text title are correct documented behavior.

Simplicity:
Existing platform controls and presenter state are reused; no concrete over-engineering finding. No production engine/store/protocol/content/native/App/dependency changes.
```
## Separate Sol fix round1 (verbatim)

```text
Verdict: APPROVE
PR: 144
Reviewed HEAD: eb81d98825610398b08d6bab0e6ffe16822a7245
Source-reviewed baseline: 7a2a140ecdadf33a0684124862bcf178a52b64fb
Independent scoped fix-round1 review; authored none.

Primary F1 — CLOSED
mobile/app/book/presenter.test.ts:32
Valid pending/refused Take and Drop replies now exercise received(), assert unchanged view/custody, returnWorld=false and literal non-success output. Book.tsx:65 and model.ts:39 consequently retain the projected item detail. Reported action-key-only premature-return mutant fails at the returnWorld assertion.

Sol F1 / primary F2 — CLOSED
mobile/app/book/presenter.ts:181
Postcommit lastNarration failures are caught without discarding the saved reply. Authored acceptance reaches the original NPC history, fault UI renders, pending remains false, and pressed() clears presenter retry context.
mobile/app/book/polish.test.ts:190 verifies saved Bram quest acceptance, subsequent fresh movement, one acceptance entry, cleared fault and correctly named pickup. Session retry clears before the failed narration read, preventing replay of the committed command.

New findings: none.

Personally run:
- presenter.test.ts and polish.test.ts: 17 passed, 0 failed.
- Verified 10 retained evidence artifact hashes.
- Diff whitespace check; exact HEAD confirmed; checkout clean.
- Inspected fix diff and directly relevant callers.

Reported, not personally executed:
- Three red controls failed; restored targeted tests passed.
- Focused suite: 42 passed, one existing optional skip.
- Author pre-push passed; root verified exact-head checks finished SUCCESS. CI not independently queried.

Limits:
No writes, mutations, installs, full check_all, builds or native/GUI runs. No phone acceptance or whole Gate C1 claim. Separate sampler Look work excluded.

Simplicity:
Lean already. Necessary catch and focused regression coverage; no complexity finding. net: 0 lines possible.
```
## Separate Sol fix round2 (verbatim)

```text
Verdict: APPROVE
PR: 144
SHA: 665b3ff6c0fbed1109a8aa13576bad710a623d11
Fresh independent scoped fix-round2 review; authored none.

F3 — CLOSED
mobile/app/book/polish.test.ts:156
Actual offered title Look commits receipt 0→1, changes freshness, retains literal room identity, and adds no duplicate World heading. Reusing the captured callback produces the literal stale-view line without a second receipt. Expected results are independent; missing dispatch or dropped freshness would fail these assertions.

docs/system/book-ui.md:21
Correctly identifies sampler 0.0.2 and links the owner repair while retaining conditional fixed-text behavior when Look is absent.

New findings: none. Prior F1/F2 remain closed.

Personally checked:
- Requirements before fix diff; touched test/doc and direct title caller.
- polish.test.ts: 9 passed, 0 failed.
- Sampler/content files byte-identical to reviewed PR145.
- Fix changes only test/doc; runtime unchanged from approved UI baseline.
- Whitespace check passed; exact HEAD and clean worktree reconfirmed.

Reported, not personally rerun:
- Missing-dispatch/dropped-token mutants RED, restored GREEN.
- All six exact-head CI checks green; CI not queried.

Limits:
No writes, mutations, installs, builds, native/GUI or full check_all.
Combined native proof remains separate; owner phone/manual Gate acceptance pending.

Simplicity:
Lean already. Existing test extended without new machinery.
net: 0 lines possible.
```
