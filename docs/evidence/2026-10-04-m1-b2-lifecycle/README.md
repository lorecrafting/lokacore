# M1-B2 developer evidence — 2026-10-04

Governing [brief](../../briefs/m1-b2-lifecycle-ui-sampler.md),
[Save](../../system/save.md#durable-elapsed-sessions),
[App lifecycle](../../system/architecture.md#elapsed-session-driver),
[Book consumer](../../system/book-ui.md#shared-elapsed-statuscompletion-boundary)
and [sampler binding](../../system/cartridge.md).
This is developer proof, separate from independent review and exact-head CI.

The normal compiler and independent Python literal oracle agree on sampler0.0.4/API1.1,
real_elapsed rate50/start64800 and hash3a667d1b38c66026eda4597879be24b0eec9cb7c61a26b92757e2ad9f31036d6.
Only the manifest and Bram source changed; all ten rooms, prose, items and quests remain.
The oracle accounts for the scheduled job before the cloak holder.

## Controlled headless outcomes

[Focused mobile results](mobile-focused-corrected.log) and [final consumer results](self-focused.log)
passed; source types, sampler compiler/KAT and source-size checks passed in the adjacent logs.
Real rollback-journal SQLite controls preserve fractional resumed wall through uncertain metadata,
invalid/stale preflight, A's original horizon, B conflict and the sixteen-boundary budget.
Actual App and Book modules receive controlled external native inputs; these runs do not prove native layout.

[Mutation results](mutation-results.json) identify fifteen actual red controls, with their retained
failure logs. Three new resume failures survive the old driver/session suites (the `*-old.log`
files pass). Existing tests already catch the budget and saved narration-read faults.
The first pending-wakeup mutant survived because the test immediately backgrounded; the corrected
control restores storage while still active, then fails that mutant. Every mutant was restored
byte-for-byte. A real broader-run regression in unknown-save pending plus visible storage error was
fixed; its existing SQLite FULL test now detects removing that pending state.

## Actual unsigned Release Simulator walk

[Build provenance](native-build-proof.json), [final source hashes](native-source-sha256.json)
and [actual UI commands](native-ui.log) bind the proof. Builds use dirty working sources, not an
invented immutable source commit. Native kernel version retains the app's dirty marker.
The initial full walk precedes removal of redundant completion bookkeeping; final-source Release
was rebuilt, installed on the same controlled save and cold-opened to its unchanged saved scene.
Final identity/lifetime reds cover the simplified matching guard. All other production inputs stayed unchanged.

| Observed outcome | Evidence |
|---|---|
| Open Bram continuation becomes Conversation, retains prompt and honest absence/Leave | [Capture](conversation.png), actual UI log |
| Inactive JS stops rows; resume accounts absence once | [Paused](native-paused.json), [inactive](native-inactive-confirmed.json), [resumed](native-resumed.json): clock71910→74813, 58064ms wall gap, r600→800 |
| Terminate/relaunch retains actual continuation, pin and run | Stable-choice before-kill/killed/reopened JSON: identical choice hashes/run hash; clock116941→119092 over43029ms wall gap (1ms wall/Mono rounding) |
| Nonzero NPC scroll survives confirmed time | [Before](scroll-deep-before.png), [after](scroll-deep-after.png), [pixel comparison](native-scroll-comparison.json): body unchanged, clock99706→99774 |
| Ordinary item/quest/navigation remain usable | Actual UI log: named pickup once, Journal updated once for offer, Map follows Bram inn→landing; Leave silent |
| Safe scene stays user-driven | First line remains while clock123838→126200; actual Continue advances brass line; final rebuilt source restores that line at clock174560 |
| Previous saves untouched | [Protection result](native-protected-saves.json):61 inspected, changed0/missing0; PM separately verified the original manifest |

One stale drawn action correctly refused; no authority/freshness bypass was used. Cold launch retains
the existing manual chapter entry, then opens the saved conversation. The 72-second first departure
is the declared profile arithmetic and controlled headless result; native captures observe the
transition without claiming a precise native stopwatch timestamp. No temporary layout edits,
owner Simulator operations, owner save reset/retarget, physical-phone proof or paid build occurred.

## Self-review

Ponytail: removed redundant last-completion-id state/assignments; the matched retained attempt
clears after consumption. No dependencies, scheduler, bus, new public API, World copies or speculative
configuration. Correctness review checked storage uncertainty, original context, settled frames,
reentrant recovery scheduling, lifetime/run guards and bounded reservation work. No open self-review
findings. Normal pre-push completion and independent verdicts are recorded in the PR/workflow;
unknown build-proof fields remain null until those separate steps occur.

[SHA256SUMS](SHA256SUMS) retains exact redacted bytes; its [verify output](SHA256SUMS.verify)
is separate and not self-listed.

The first normal commit hook blocked two App tests importing the kernel test helper directly.
The existing shared SQLite/clock helper now lives in
`mobile/authority/local-story/__tests__/elapsed-host.test.ts`; exactly eight verified test callers
import it across the existing local-story boundary. No shim, checker exemption or production
source changed. The first candidate `test/` placement exposed test-only Node imports to mobile
types (EXIT2) and failed the existing function-size check (EXIT1). The next `__tests__/` candidate
passed size/types but the normal hook's authority display-text rule still treated its SQL as
production text (EXIT1). The final `.test.ts` name uses both checkers' existing test convention;
the existing production compile scope excludes this test-support directory.

[All eight caller suites](relocation-focused-final.log), [mobile types](relocation-mobile-types-final.log),
[kernel types](relocation-kernel-types-final.log), [AST boundary/display-text scan](helper-boundaries-final.log)
and [size check](helper-size-final.log) passed (EXIT0). The [eight structural caller imports](helper-caller-imports.json),
[original hook failure](precommit-import-boundary.log), [second hook failure](precommit-display-text.log)
and [size failure](relocation-size-failed.log) are retained. Production source hashes are unchanged,
so no further native build was needed.

The first normal full pre-push run failed the existing cross-kernel artifact parity test:
its shared peer input declared API1.0, so the current sampler correctly returned
`KERNEL_API_UNSUPPORTED`. The [actual peer probe](parity-api-context-probe.json) shows API1.1
loads all nine artifacts with identical bytes, hashes and locks. Only that test's peer input
now declares API1.1; all other API1.0 contexts and artifact expectations remain unchanged.
The [focused parity suite](parity-api-context-focused.log) passed (EXIT0); the
[first pre-push failure](prepush-api-context-failed.log) is retained. No production or native
source changed.
