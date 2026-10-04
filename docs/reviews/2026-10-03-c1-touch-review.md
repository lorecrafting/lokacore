# C1 touch primary review — final

PR #141; exact head `595c036409744672b0854fa6ec7354065db3fced`; base `b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4`. Independent reviewer authored none.

Verdict: APPROVE WITH NOTES. No open correctness or simplicity defects. Presenter head `595c036409744672b0854fa6ec7354065db3fced` and scoped final integrated Release head `9732b0ec58f81ae74b7ca4e4cf8dd736d4cd409a` reviewed independently. Required sampler/native interaction and scene persistence proof completed below; initial pending sections are retained as dated-stage provenance. Merge remains PM-owned.

## Requirements derived before implementation review

- Presenter remains GameSession/structured-protocol only; no engine, storage, App story/save binding or native change, world value or clock feature.
- Only projected, available actions are invokable: per-exit doors/sight, held/worn equipment, reachable flattened contents, position actions, selected journal text, content band wording/tone.
- Same-room item actions preserve pages while the item is projected; movement/removal closes obsolete pages.
- Chapters show initially and on index change without ordinary-update repeats. An active scene owns controls and current persisted line; chapter waits behind it; no ordinary modal controls.
- Actual sampler touch walk and Release Simulator scene kill/relaunch remain required, including menu choices/Close/Done at iPhone 11 viewport. Approved existing fixtures may prove only fixture-specific baseline behavior.
- Distinct realistic test breaks, independent expectations and actual red controls; evaluate authorized smoke expectation against real kernel action+take behavior.

Sources: current docs/system/protocol.md GameView/ActionSet, mechanics door/containment/equipment/position/quest/chapters/scene, architecture renderer; chapter-one plan §3 slice12, mobile/evidence lessons, owner touch-resumption ordering.

## Presenter findings

No concrete correctness blocker found in the reviewed presenter diff. Scope holds: no new engine, App/save binding, native, storage implementation or protocol change in PR #141. The existing smoke expectation change is justified by independently running the real items fixture: the offered oil flask take saves an accepted `taken`, one entity transfer and `item_acquired`, adopts oil into inventory and removes it from the satchel.

Ponytail Review: no unnecessary dependency, speculative abstraction, duplicate rule, whole-state copy or cut proposed. Lean already. Ship. This was the preliminary simplicity result; final acceptance is recorded below.

## Completed checks

- Exact head `mise exec -- npx tsc --noEmit` from mobile/app: exit 0.
- Exact head `mise exec -- node --test book/*.test.ts`: 36 PASS, 0 failed, 0 skipped; restored suite repeated after mutants: 36 PASS.
- `mise exec -- node --test ../authority/local-story/smoke.test.ts`: 17 PASS, 0 failed, 1 optional copied-phone-save skip.
- `mise exec -- node --test kernel/ts/test/containment.test.ts`: 11 PASS.
- Temporary real-authority flask behavior control: PASS, described above; temporary script removed.
- Seven reviewer mutations in detached throwaway: lost door direction, omitted nested contents, omitted worn items, removed chapter queue, cleared item pages, ignored catalog band prose, omitted position grouping. Each focused `c1.test.ts` + `touch.test.ts` run exited 1 on relevant assertions; source restored after each. No check-all rerun.
- New tests catch distinct UI projection/navigation breaks using controlled literal expectations; real Lantern door test separately verifies direction invocation through authority. The tests do not establish rendered layout or Simulator gestures.
- Per-file diff/actual source self-review; `git diff --check` clean; code changes restore clean after mutations.

## Simulator preparation, honest limits

- Own fresh iPhone 11 viewport Simulator only; all launches/captures bounded.
- `expo prebuild --platform ios --no-install`, `pod install`, Release xcodebuild with signing disabled: PASS. Release rebuild after mutation restoration: PASS.
- Exact-head Lantern app installed successfully. agent-device open exited 0 but warned: `COMMAND_FAILED: iOS runner was already restarted during this request and "snapshot" still failed, so agent-device stopped instead of paying for another runner boot.` A following `press label="Got it" --settle` hit the 30-second watchdog (exit 124); no interaction proof.
- Temporary combined preview only: copied sampler developer's approved fixture hash `0e66807306404138bd5dcb07893f3ef1d6edff7a2141d4c2c38753f8f70b4e55`, bound it in throwaway App to its separate sampler save. Release preview build/install/simctl launch PASS; immediate screenshot shows black startup area plus status bar, not a usable UI. This is an unreviewed combined preview, not final sampler acceptance. Production App/source/binding untouched.
- GUI launch obstruction: `open -a Simulator` says application missing; the expected `/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app` does not exist and Spotlight found no Simulator bundle. CLI simctl exists.
- On PM CPU pause instruction, own Simulator was Booted and graceful shutdown completed exit 0. No other Simulator or owner save touched. No subsequent build/boot/relaunch/daemon operation.

## Original pending evidence (updated by resume below)

Actual adopted sampler integrated exact CI-green head, then Release Simulator touch walk: opening and reached chapter titles; modal chapter ordering; door unlock/open/close/lock and adjacent sight; held/worn wear/remove; locked and nested containers unlock/open/take; sit/rest/sleep/stand status and movement admission; selected journal text; catalog band wording and tone; Map tip/joystick/footer and menu/Close/Done at iPhone 11 viewport; scene Continue-only controls and kill/relaunch on persisted line 2 with no repeated consequences. No final approval, owner-human proof, device success or merge claim. Fresh exact sampler binding proof remains outstanding.

Logs are redacted and hashed; raw private Simulator metadata removed. Detached mutation checkout removed at preliminary handoff. Reviewer remains available for actual sampler evidence and scoped same-developer fixes.

## Resume: actual approved-sampler Release GUI walk

The earlier black startup screenshot and missing Simulator.app were tooling/startup limits, not an established app defect. PM located Xcode 27 DeviceHub (`com.apple.dt.Devices`). Computer Use skill was read and announced; Mac GUI actions used node_repl + @oai/sky exclusively. Only the own review Simulator was booted/relaunched through simctl. No rebuild or agent-device runner compilation ran during this resumed lane. DeviceHub initially had stale/no-frame and timeout AX calls; refreshing the tree after boot and selecting the own Simulator exposed app AX controls.

Product under test: retained Release combined preview of UI `595c036` with adopted sampler fixture from developer `953986c`; approved hash remains `0e66807306404138bd5dcb07893f3ef1d6edff7a2141d4c2c38753f8f70b4e55`. Temporary preview App binding was restored and throwaway removed at the first handoff; no production changes. This is actual native Release interaction on the approved sampler content, but not final CI-green integrated-production-head proof.

Completed via actual GUI clicks, with redacted per-step AX logs:

- Opening chapter `Bram’s Lantern` → Continue → Ferry Landing; map tip `Got it`; footer Map tap.
- Bram dialogue offer, quest acceptance, Done, later Close and reopen; offer screenshot shows choice/Close/Done visible at iPhone 11 viewport.
- North sight includes Well Lane and brass lantern; upstairs sight includes keys/cloak, attic sight includes trunk. Visited all six declared rooms by Map movement buttons.
- Lantern take; journal selected `Bring the lantern to Bram.`; terminal journal selected `You found the lantern and kept it.`.
- Sit → sitting status + unavailable movement; Rest → resting; Sleep → sleeping; Stand → standing and movement succeeds again.
- Take cloak → Wear → only Remove offered on worn item; Carrying shows keys/lantern under Held and cloak under Worn/Cloak; Remove updates Held and empty Cloak slot, preserving item page.
- Trunk Unlock/Open; closed lid hides whistle; Open reveals nested whistle; whistle page Take succeeds; container page remains; Close/Lock restore legal buttons.
- Cellar exit Unlock/Open/Close/Lock/Unlock/Open; door state and per-direction controls update; open reveals Lantern Cellar sight; movement to cellar and back succeeds.
- Keep the lantern starts scene line 1; Continue advances to line 2. Full app AX confirms no Map/Back/Done/Journal/Carrying/Settings/NPC controls, Character disabled, only Continue enabled.
- Terminate/relaunch on line 2 restores exact line-2 prose. Read-only SQLite snapshots before/after have scene fact `2`, revision `40`, clock `0`, receipt count `40`, identical complete state/head digest `55743b0e757581b2cc997a343233875b263976696694717277be37b7d17d0458` and receipt digest `6fede9db4e33e1b97aebd5c18ffa0a24302fd958eab293d44bbadea693dbb8da`. No repeated consequences/receipts or clock change.
- Continue line2→line3→end then shows queued chapter `The Lantern Found`; dismiss and ordinary movement do not repeat it.

No concrete UI/native correctness defect observed. No native fix requested. Current working sampler preview is visible in DeviceHub; own Simulator remains booted on Well Lane for the owner, with PM informed. Lane relinquished after record/capture work. No other device or owner save operated.

Remaining acceptance limits:

1. Final CI-green production App/sampler binding head must get scoped proof; preview composition is explicitly labeled above.
2. Adopted sampler has no `band.*` catalog entries and no world/pool band table. Its GUI shows the default `perfect health` fallback, so the requested custom content-owned phrase/tone row cannot be demonstrated on this content. The primary controlled-input catalog test/red mutation and Sol stubbed TSX probe pass; no actual custom native tone proof yet. This is an acceptance/content gap for PM disposition, not an established presenter defect.
3. Footer Map tap, tip and movement buttons were exercised. Raw joystick drag was not exercised in this resumed GUI walk.

Device names/window titles/IDs and paths are redacted in retained text; DeviceHub screenshots mask sidebar, window title and bottom chrome before output/hash. Temporary private Simulator JSON and unredacted screenshot deleted. An initial AX sanitizer missed one physical-device row in transient tool output; it was caught and strengthened to redact all rows/names before subsequent outputs; no raw AX retained.

## Separate independent Sol review, verbatim

```text
Verdict: APPROVE WITH NOTES
PR: #141
Head: 595c036409744672b0854fa6ec7354065db3fced
Base: b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4
Independent review; authored none.

Findings: No concrete correctness or simplicity defects found.

Own checks:
- 28 focused book tests passed.
- Mobile noEmit typecheck passed using read-only mapping to installed dependencies.
- Changed-file size checker and renderer-import rule passed; whitelist unchanged.
- In-memory SQLite probes passed: nested flask kernel offer/take/saved inventory reconstruction; directional door unlock/open; worn-item actions/page retention; current position actions; scene Continue freshness and line-two reconstruction.
- In-memory TSX probes passed: local chapter dismissal, modal precedence/ordinary-control suppression, queued title, journal text, resource phrase/tone and exit sight/actions. Native components/hooks were stubbed.
- Six loader-only mutants produced failing tests: lost door direction, omitted nested/worn items, retained hidden descendant, discarded chapter queue and ignored catalog phrase.
- Diff whitespace check passed; exact head and clean working tree confirmed.

Simplicity: Lean already. Existing React Native controls and session boundary suffice; no new machinery, world-number literals, boundary relaxation or engine/storage/native/App binding changes.

Head observation: Body remains at mobile/app/book/Book.tsx:235; the supplied removal claim is inaccurate. Its presence is not a defect; size limits pass.

Limits: PM’s six green CI checks and developer/primary test/mutation totals are reported evidence, separate from my checks. I did not run the 17-test smoke suite or full checks, or prove actual sampler/device behavior. Required primary Release Simulator interaction/relaunch evidence and final integrated sampler walk remain pending. This code verdict does not replace those proofs or authorize merge. No filesystem mutations.
```
## PM disposition after native walk

SAMP-BAND-01: PM authorizes sampler developer fix round 1 to declare world.bands with existing eleven baseline cuts/tones, top key `ready` with legacy phrase `is in perfect health`, and remaining legacy keys/phrases. Eleven existing UI-label strings are added; the 57 adopted story strings remain unchanged. Docs first, clearly recorded PM ruling, no invented owner prose approval; only the new unreleased sampler artifact is rederived using an independent literal oracle. No engine/presenter change.

Fix not reviewed here yet; final fixture hash/head/CI are unknown. Retained preview remains scoped native proof of unchanged rows. Required next proof on final CI-green integrated Release product: content band display/tone and scene line-2 relaunch, plus direct callers affected by any fix. No repeated whole walk unless relevant behavior changes. Raw joystick drag is honestly not run; PM rules it is no new/changed C1 row and requires no duplicative expansion without a concrete failure. Own preview Simulator may remain open while CPU stable. Verdict remains REVIEW IN PROGRESS / PENDING, no merge approval.


## Final integrated Release acceptance

Exact integrated head `9732b0ec58f81ae74b7ca4e4cf8dd736d4cd409a`, actual production App/sampler binding from `fc5a6f1`, canonical sampler hash `5631ddf63007b837bef1e91dfb71fcfb8d31847257210c5de1caa5b198a771b5`. PM reported all six checks green on this exact head before releasing the native lane. Detached checkout tracked source clean; direct git comparison establishes Book presenter bytes unchanged from independently reviewed `595c036`. No manual fixture/App preview patch in this final build.

Own root/kernel/app installs, iOS prebuild, Pods, one Release Simulator xcodebuild (signing disabled), isolated own-app reset/install/launch: all exit 0. Only the prior unreleased preview save was reset for its changed pin; no owner database/device touched. Actual build success is retained, not inferred from install.

SAMP-BAND-01 is closed for this UI acceptance: independently checked all eleven literal baseline cuts/keys/tones and final canonical hash; native Character shows `hp 20 / 20, is in perfect health` with normal foreground. Both offer and ending dialogue choices, Close, Done and footer fit 414 × 896 logical pixels with the longer catalog status. Native warning/danger HP transitions were not naturally reached in the short sampler; those projections remain controlled-test evidence, not claimed native outcomes. The fix changes only unreleased sampler content; engine/presenter unchanged and story prose adoption remains PM-governed.

Fresh SQLite metadata pins final hash, revision 0, clock 0 and zero receipts. Native trace is `loka-kernel@9732b0ec58f81ae74b7ca4e4cf8dd736d4cd409a`, with no dirty suffix. Actual short quest reaches scene line 2. Before/after actual terminate/relaunch SQLite records are identical: scene value 2, revision 8, clock 0, eight receipts, state/head digest `48276f372fa50facde2d5f895b274bbead6b74f7aa19db1d2376a620a4f6264e`, receipt digest `89a9969997d677d3d77f57e90941031f612e0838952e69a5cb628d76dce935a6`. AX after relaunch restores exact line-2 prose, with only Continue enabled and Character disabled. Continue twice completes scene, then queued `The Lantern Found` chapter appears. No receipt/state consequence repeated by relaunch.

Additional representative screenshots on the same actual final product show ferry, opened directional cellar door with adjacent sight, opened trunk with reachable whistle, keys/lantern Held plus cloak Worn, Sitting position/actions, and resolved journal text. These supplement unchanged full-walk proof rather than repeat every earlier transition. Every public screenshot was visually inspected; no layout defect observed. After retaining the proof, actual own-app Start over returned the visible owner preview to `Bram’s Lantern`; final opening screenshot captured. Own Simulator remains booted for owner preview; native/GUI lane released, no other daemon user needed.

Final verdict: APPROVE WITH NOTES. No required native cases remain pending for C1. Notes retain explicit limits: Simulator only, no owner-phone touch-to-photon/human acceptance claim, raw joystick drag not run under PM's unchanged-control disposition, and warning/danger native transitions not claimed. Independent sampler source review/merge decisions remain separate PM gates. No branch push/commit or shared worktree source edit performed.

## Compact publication evidence

Prepared compact redacted subset for PM at `docs/evidence/c1-touch/`: twelve actual final-production screenshots, exact fresh/before-after SQLite metadata, real build/install/launch/terminate/relaunch status, original failed runner/watchdog, checks and seven actual red controls. Its `SHA256SUMS` was actually verified over 38 files. Full original 155-file history and later captures remain in scratch; earlier images and the original retained manifest are unchanged. A final stricter privacy scan found the generated own-review Simulator name in one historical resume-bootstatus log outside the public subset; that one token was replaced with `<review-simulator>`, so its original historical manifest entry is superseded by the final manifest. No personal-device identifier was present in that token. Pre-final record/index are preserved separately before this final update; original hash verification applies to that earlier captured stage.

After PM publishes, evidence links: [README](../evidence/c1-touch/README.md), [SHA manifest](../evidence/c1-touch/SHA256SUMS), [opening](../evidence/c1-touch/opening.png), [menus](../evidence/c1-touch/ending-menu-fit.png), [content phrase](../evidence/c1-touch/content-band.png), [scene 2](../evidence/c1-touch/scene2.png), [before](../evidence/c1-touch/scene2-before-relaunch.json), [after](../evidence/c1-touch/scene2-after-relaunch.json). These links anticipate publication and do not claim either PR has merged.
