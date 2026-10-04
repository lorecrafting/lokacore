# C1 dialogue/Contents polish independent primary source review

PR #144; audited head `7a2a140ecdadf33a0684124862bcf178a52b64fb`; base `7845f9b1ab8924013d460b7dda29f21e148eb7e5`. Independent primary authored none. Actual model identity unverified. Native final verdict pending.

Requirements derived before diff from full Book UI, GameView, architecture Book presenter, owner direction/labelled PM choices: captured offered-action freshness; stable mounted NPC detail/once-only chronological original-context history; five Contents routes/status vs position; local Leave and saved-choice retention; confirmed-only named Take/Drop return; committed-place-only World reset; scene/queued-chapter priority and save honesty; incomplete Give omitted without rejecting a complete two-target command; fixed title/footer; no fabricated Look and no mechanics/persistence/content/native scope extension. Derived acceptance retained in primary controls.

Every changed file and directly relevant route/presenter/session/Turn callers reviewed with outlines/ranged reads. No production correctness finding. Dedicated canonical UI spec links from AGENTS/system index/architecture and original owner record; current old sampler conditional plaintext title is correct. Supporting new content and composed native source require separate identities and proof.

Personally run focused baseline: polish/presenter/touch/local-story smoke, **40 passed, one existing optional skip**. Existing expected behavior follows literal prose/route/custody answers. Native leaf hosts and React state slot harness are explicitly not mounted/native proof. No full check_all duplication; exact-head CI is PM-personally-verified evidence.

Independent mutations: ordinary NPC action page flip => RED; missing committed-place reset => RED; duplicate restored narration on receipt => RED. Restored focused tests GREEN; tracked checkout clean. Independent real sampler Talk/recovery probe produced one exact authored prompt before and after recovery, without invented retained narration.

## F1 — blocker, required mutation-sensitive confirmation coverage

`mobile/app/book/polish.test.ts:300` and `:393`: Take/Drop confirmation tests exercise `PRAGMA query_only=1`, whose exception exits `pressed()` before `received()`. They do not test a valid host `Reply.kind='pending'` or refusal reaching `received()`. Mutating `presenter.ts:178` to `s.returnWorld = ['take', 'drop'].includes(attempt.button.action_key)` prematurely requests World on an unconfirmed item press, yet the entire 40-pass/1-skip focused suite stays GREEN. A controlled pending Take through the declared Game boundary, with unchanged custody, demonstrates correct code `returnWorld=false` GREEN and the mutation `returnWorld=true` RED. Production guard is correct; this is a demonstrated test guard gap under the required reviewer mutation rule. Add minimal pending/refusal coverage retaining item detail and no success, demonstrate RED/restored GREEN.

Ponytail Review: Lean already. Ship. No complexity removal recommended; `net: 0 lines possible.` Confirmation guard and original retry context are necessary safety, not bloat.

Retained redacted proof: shared scratch `c1-dialogue-primary-controls/`, 15 artifacts and independently checked SHA256SUMS/verify, excluding themselves. Final publication/review index and Sol answer are PM-owned. No code author, PM or owner checkout edits; no push/merge. Native GUI/build still on explicit hold for green supporting content and clean integration SHA.

## Pending fix round 1

PM relayed separate Sol finding F2: `presenter.ts:181` calls `game.lastNarration()` after a saved decision outside the `pressed()` invoke try/catch. Primary source inspection agrees that a storage-read failure can escape before press redraw/context clearance; independent fault reproduction belongs to the Sol report until primary runs it. Original author receives F1/F2 together. Review only the fixes and direct callers after exact-head CI is green. Native hold continues. Latest owner override removes any requirement to add old-save-version compatibility machinery; content version/pin remains unadopted pending revised minimal scope.

Primary now personally reproduced F2 using a controlled declared Game boundary: invocation saves the choice; the subsequent lastNarration read throws. The throw escapes `press`, no result is appended, and `screen().fault` is undefined. Original source remains restored clean. Reproduction/probe retained and SHA-verified; controls folder now has 17 manifested artifacts. This establishes F2 independently, without attributing Sol's execution to primary.

## Fix round 1 — source APPROVE

Audited `eb81d98825610398b08d6bab0e6ffe16822a7245` after PM personally verified all six exact-head CI checks SUCCESS. Scope restricted to F1/F2 fixes, all three changed files, and Book/Fault/session direct callers.

F1 **CLOSED**: pending/refused Take and Drop cover the declared Game Reply boundary with literal nonsuccess output, unchanged custody/view, and `returnWorld=false`. Existing Book tests cover consuming the route flag. Primary's original premature-return mutation now fails this regression.

F2 **CLOSED**: only the postcommit narration-recovery read is caught; the authoritative saved reply still supplies known narration, accurate “Saved result; narration recovery unavailable” feedback is drawn, and retry context clears whenever Game has no pending attempt. The real-SQLite missing-table injection in the existing Book/session harness catches escape, missing feedback/result, and stale NPC retry routing with fresh movement/pickup. Primary removal of this catch fails the regression. No wrapper that mislabels saved work as pending, no new framework or production test seam.

Personally run full focused baseline now **42 passed, one existing optional skip**; both own realistic mutants RED; restored polish/presenter GREEN; tracked checkout clean. Ponytail: existing harness reused, necessary six-line runtime recovery catch; no simplification finding, net zero lines recommended. No new findings. **Source APPROVE, final primary verdict still pending required composed Release proof.** Supporting new content/owner no-old-version override must be recorded with its final accepted identity; native lane remains held.

## Composed preflight — F3 integration test expectation

At clean integration `0606d10d37dc0f0b1a49a02ebad8b0dac67d3183`, primary independently checked book source byte-identical to UI `eb81d988` and sampler fixture byte-identical to supporting content `e3c4fdd`. Own combined focused test run: **41 pass, one failure, one optional skip**. `polish.test.ts` asserts absent `Look, Ferry Landing`; the newly enabled 0.0.2 capability correctly makes that literal button present. This is an obsolete old-sampler absence expectation, not a runtime fake Look or production bug. Native generation succeeded with tracked source clean; expensive build and GUI did not begin.

PM routed F3 test-only integration fix to original author, with actual offered title-Look callback/receipt/freshness behavior and RED control, plus canonical Book UI current-vs-historical factual clarification. F1/F2 remain closed. Await new exact-head green and scoped F3 recheck before native. Supporting artifact hash supplied by PM: `813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa`; primary native identity remains to be measured.

## F3 fix round 2 — source APPROVE

Audited `665b3ff6c0fbed1109a8aa13576bad710a623d11` after PM verified all six exact-head CI checks SUCCESS. Reviewed only title callback test, canonical fact/link and direct caller. F1/F2 remain closed. Production book source byte-identical to `eb81d988`, sampler fixture byte-identical to `e3c4fddf2bb74c5e4ae4a0e79feda14e83beb434`.

F3 **CLOSED**: actual title callback creates exactly one receipt, advances freshness without changing place or adding generic Look log; reusing the previously drawn title produces stale feedback and no second receipt. Expected counts/prose/room key are literal. Independent removal of the drawn title token makes this test RED; restoration GREEN. Actual composed focused suite **42 PASS/1 optional skip**. Canonical spec accurately names 0.0.2 authentic Look under linked supporting decision while preserving fixed-text titles for cartridges without Look.

Native Release now authorized on this real clean composed SHA. Preserved setup failure: final prebuild was accidentally invoked from repository root, where local Expo was absent; npm fetched a tool-cache Expo then failed SDK detection. No tracked/generated repository changes or installed app resulted. Correct app-local `npx --no-install expo prebuild` uses pinned 57.0.24 and succeeds; Pods succeed. No wrong artifact used. New private isolated Simulator booted/selected; owner previews untouched. Native verdict remains pending actual proof.
