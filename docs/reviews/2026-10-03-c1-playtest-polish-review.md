# C1 playtest polish primary review

PR #143; head `9f18cb91fb331fc725d31cbfba2ac2fc38dab829`; base `289034c4708e55caada6098fd631e0c45073f3cb`. Independent reviewer authored none. Bounded PM substitute under recorded delegation; no Gate C1 pass.

## Requirements derived before diff

- World retains heading/authored description/entities/meaningful consequences, omits standalone exits/sight/duplicate arrival titles; Map retains directions/sight/door actions.
- NPC taps full projected details, with actions/choices/live results there; pending choices survive World return/reopen/relaunch.
- Every Back to World label/accessibility action actually clears page stack to World; item retention/custody remains correct.
- Only ROOM position status opens offered position controls; nonstanding can reopen and stand. Character/details have informational position only.
- Modal scenes admit only offered Continue, restore persisted line without extra receipt/state changes, and precede queued chapter. Freshness and offered actions preserved.
- Unclassified restored narration uses declared bounded World fallback; no English guesses or new authority persistence. No mechanics/native/storage/protocol/content/dependency changes. Menu redesign excluded.

## Source review and personally run checks

Reviewed every changed file, route/presenter direct callers, session retry and chapter/item-page behavior. No correctness or simplicity finding. Ponytail Review: Lean already. Ship. Drawing separation supports real route callbacks and reuses existing Sheet/Tap/Act; no new dependency, mechanics, storage, native plugin or contract machinery.

Focused tests personally run: polish/model/presenter/c1/touch/joystick and local-story smoke/start_over, 69 pass, zero fail, one existing platform skip. Existing component harness runs real session/SQLite/component callbacks, stubbing native leaf hosts; no native layout claim. Literal expected prose/actions and controlled query_only failure are independent of implementation.

Actual mutations in own detached checkout: Back to World changed to stack-pop => route test RED; allowed position target on details => position test RED; discarded detail routing of pending retry => two dialogue tests RED. Each restored; focused polish suite GREEN; git status clean. UI-only loader topology: kernel node_modules absent, old kernel-anchored TypeScript require => Cannot find module typescript RED; corrected app-anchored require => four tests GREEN. Retains original author's loader setup failure provenance, independently reproduced.

PM personally verified all six started CI checks SUCCESS at exact head before review (CI run 37178629223 and mobile-bundle run 37178629376); primary did not duplicate check_all.

## Scoped native proof

Personally built and interacted with signing-disabled **Release** on a newly created isolated iOS 27 Simulator using the existing unchanged Expo scene/gesture plugins. Restored source clean at build; real SQLite trace confirms `loka-kernel@9f18cb91fb331fc725d31cbfba2ac2fc38dab829`; sampler content pin `5631ddf63007b837bef1e91dfb71fcfb8d31847257210c5de1caa5b198a771b5` unchanged. Computer Use node_repl/@oai/sky with actual Device Hub GUI; simctl lifecycle only. Initial AX cannotComplete/timeout settled after build, retained as reviewer setup limitation; no runner churn or alternate UI automation.

Observed native routes: clean World title/description/entities, Map directions/sight and keyed unlock/open/close door actions; Bram full detail/actions/prompt/choices/results, Back-to-World retains choice, speaker reopen and actual choice relaunch, no live-result leak to World; Character and other details position informative only; ROOM position target independently opens sit/rest/sleep, nonstanding reopens and stands; nested Carrying/item/Map returns clear to actual World; Take retains item page and projected legal custody actions.

NPC ending starts modal scene. At line 2, actual terminate/launch retained authored line “You turn the brass lantern in your hand. Its dented side is cool against your palm.”, scene fact 2, identical saved head/state/receipt hash/count (revision 12; 12 receipts). Only enabled game action Continue; no Back, position shortcut or enabled Character. Final Continue ends scene (fact -1), then queues The Lantern Found chapter; acknowledgement followed by ordinary position updates does not repeat chapter. Choice before/after metadata is likewise identical (revision 1; one receipt). Initial comparison printed false because Python tuple/list container types were compared before JSON normalization; actual retained before/after JSON is identical, independently asserted equal. This was a comparison setup error, not a saved-state difference.

Four scoped rooms visited for the door/key probe; no repeated full six-room acceptance. After proof, only the isolated review app/save was reinstalled and launched to leave a fresh corrected World preview visible. Owner baseline Simulator/phone/save untouched.

## Findings and verdict

**APPROVE. No open findings.** No mechanics, content, storage, protocol, native plugin or dependency changes. No full gate pass. Owner-phone human play and responsiveness remain Gate C1; follow-up feedback cycles and separately queued status-entry menu redesign remain outside PR #143. Host-neutral unclassified restored narration remains the PM-approved bounded World fallback, preserved without guessing. This is the PM recovery interpretation, not the owner’s quoted wording.

## Evidence

[Independent scoped evidence](../evidence/2026-10-03-c1-playtest-polish-primary/README.md): personally run focused tests, actual RED mutations/loader and restored GREEN, trace/save identity, GUI control log, five actual screen crops, real choice/scene2 SQLite comparison, successful Release build-tail excerpt. `SHA256SUMS.verify` is an actual passing shasum verification after redaction. Private raw screenshots/build/source paths excluded.

## Separate Sol review (verbatim)

```text
Verdict: APPROVE WITH NOTES — independent source review; authored none.
PR: 143
Audited head: 9f18cb91fb331fc725d31cbfba2ac2fc38dab829
Base: 289034c4708e55caada6098fd631e0c45073f3cb

Findings: None.

Personally verified:
- Clean detached checkout; required policy/spec reads before diff; changed files and direct callers traced with AST searches and ranged reads.
- 25/25 scoped model, presenter, component-routing and C1 tests; mobile typecheck, changed-file size checks and diff whitespace check succeeded.
- Additional real in-memory session/component probes confirmed command-free NPC opening, present/absent saved-choice reopening, Close result destination, item-detail retention, restored scene control exclusivity and queued chapter.
- A committed NPC choice with lost acknowledgement and failed receipt read returned pending; retry from world replayed its result into the originating NPC detail without moving. A subsequent move worked.
- New tests use behavioral assertions and independent literal expectations; no source-text assertions found.

Reported evidence:
- PM verified all six exact-head CI jobs SUCCESS across runs 37178629223 and 37178629376.
- Preserve original eaff335 setup failure: loader required kernel-local TypeScript absent during UI-first CI installation. Inspected the one-line fix and personally confirmed app-local compiler resolution. Kernel-directory-absent old RED/new GREEN remains reported evidence.

Limitations:
- No code mutations or behavioral mutation-failure verification; reported loader RED/GREEN is setup evidence.
- No writes, installation, full checks, file-backed smoke run, native/GUI/device work or crash proof.
- Separate primary Release Simulator interaction and owner-phone play/touch-to-visible gate remain outstanding.

Simplicity: Lean already; net: 0 lines recommended for removal. Existing layouts/actions reused, dependencies unchanged, safety preserved. Menu/book-index discussion excluded.
```