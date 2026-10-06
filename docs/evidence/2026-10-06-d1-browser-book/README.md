# D1 browser Book proof and final review corrections

Exact production source: `b0f37b0768825f0952c8a2a1f525e992923fddfc`.
The player release remains v030/API 1.26, SHA-256
`dbff57ba20305dffa4a0679ab58d480574fbc3fd93fddeb3bf08d48d78e057b9`,
149 initial IDs. This follow-up changes Book notice routing and browser tests;
its production cartridge, authority, persistence and protocol stay unchanged.

Governing rules: [B6 marker and D1 browser Book route](../../system/book-ui.md),
[D1 adopted brief](../../briefs/chapter-one/d1-ferry-isle-brief-2026-10-05.md),
[delivery workflow](../../WORKFLOW.md). The [final Sol findings](../../reviews/2026-10-06-d1-ferry-isle-primary-review.md)
remain open until independent scoped review. Earlier [source/SQLite proof](../2026-10-06-d1-ferry-isle-publication/README.md)
and [CI portability proof](../2026-10-06-d1-ci-portability/README.md) remain applicable.

## Production browser journey

`CI=1 E2E_TELEMETRY_DISABLED=1 NODE_NO_WARNINGS=1 mise exec -- npm run test:e2e -- --no-cache --retries 0`
from the app directory passes **3/3**, exit 0, on the exact source. The added
journey uses only real Book controls and browser SQLite: fresh Ferry Landing,
Boathouse's visible 2p fare, rapid double-tap Board with exactly one crossing and
20→18p, original Sedge's free choice/grant, cold lesson-history reopen, all six
rooms including the dark Loft, free return and Boathouse reopen still at 18p.
The two existing movement and paid Lantern dream journeys also pass. An earlier
uncached CI run repeats all three twice: **6/6**, all repeats pass.

A temporary missing-transport-controls mutation leaves the old movement and Maud
journeys green and makes the new D1 journey fail at Board, exit 1. Its retained
screen and image show a 2p fare with no boarding control. Restoration passes.

The original hosted Maud locator failure (run 37465997049, job 112277046494) is
retained. GitHub uploaded no failure screen on that attempt; its exact route is
unknown. The unchanged `cf5f8cbe` hosted retry passes, as do the original local
two-test run and CI three-repeat probe. Timing/reset is an inference, not an
observed cause. The existing test now asserts fresh Ferry Landing and accepted
Well Lane/Lantern arrival. No sleep or retry was added. CI retains redacted current
report, failure screens, screenshots and logs, excluding cache, sessions and ZIP
traces. The configured redactor rejects the unredacted controlled path input and
produces valid redacted JSON; see capture notes.

## Controlled real browser corpse recovery

The published isle has no attacker or hazard; this is a declared authored test
variant, not a claim of public island death. In a disposable exact-source checkout,
only App's bundled chapter import changes to the generated controlled fixture.
The test changes preview ports; App, Book, authority and browser SQLite remain
otherwise unchanged. The retained import/config diff records that seam.

The generator reuses actual authored-source compilation through the existing
transport fixture helper. Inputs are Boathouse entry, calendar start 0, pennies 2,
HP 1/no regeneration, original torch/satchel placed at Boathouse with their shop
offers removed, one cloned rat at Loft with its existing discovery predicate,
rat chance 100/fixed damage 1, player chance 0, and combat interval 1. Discovery
uses the real original Marsh Light/Seek route; no synthetic state/receipt, clock,
RNG, storage injection, extra island light or runtime test hook exists. Invalid
fixture setup probes were rejected by the existing schema/loader and are not
counted as player proof.

Controlled canonical SHA-256:
`6b1ec4279bdeee224cf7f460f5d71b2a28d9a2d5190a180562202aa7a5c6f3df`.
Python independently recomputed that hash; the normal cartridge loader accepts it.

The exact-source uncached CI browser run, with zero retries, passes **1/1**, exit 0
(65.81 seconds). It takes the original satchel/torch, discovers the rat, ignites
and nests the torch, pays the actual ferry, then uses real Attack and a scheduled
fatal round. Cold reopen confirms Chapel with empty inventory. Five south moves
and west reach the gearless 0p waiver. Ordinary boarding, east and up expose the
dark Loft's actual owned corpse; ordinary nested Take recovers the torch and
satchel. Cold reopen confirms both held and 0p. Free return reaches Boathouse;
the emptied corpse grants no waiver and the visible 2p offer refuses for lack of
money. Unique authored belongings and UI outcomes are asserted here; exact IDs,
nested custody and SQLite fault outcomes retain their separate source proof.

The browser route initially exposed a real shared Book defect: self-luminous
Notice recipes are projected only on that Notice, while the link checked place
entity actions. A confirmed-save await still failed; pending was transient. The
minimal fix falls back to the Notice's own actions and existing bound button;
readable details preserve their original Read entry precedence. The focused old
suite passes 15/15. The final new test with pre-fix Notice code fails **1/34**;
restoration passes **34/34**, including readable, notice-board and riddle controls.
The result stays in marker history, with empty target IDs and no World leak.

Full headless app: **523 tests, 522 pass, one intentional skip, zero failures**,
exit 0. Ponytail and correctness self-review: existing projection/button/capture
machinery suffices; no new dependency, abstraction or compatibility adapter.

## Reproduce and inspect

Copy `generate-recovery.ts` to the disposable checkout root as
`d1-recovery-generator.ts`; run `MIX_ENV=test mise exec -- node d1-recovery-generator.ts`.
It writes `protocol/fixtures/d1-recovery-browser-fixture.json`. Apply the retained
App import/config diff, copy `recovery.e2e.test.ts` into the app's tests directory
as `d1-recovery.e2e.ts`, then run the production command above with
`--grep 'controlled real browser'`. Use the declared isolated ports and disposable
save only. The generated fixture's canonical bytes match `controlled-fixture.json`.

The four controlled screenshots were visually inspected. The dark corpse and
unaffordable offer captures are stable; waiver/inventory captures include an
ordinary page-turn frame. They are retained honestly as functional capture
artifacts, not a layout or native-device claim. No owner save or native session
was touched. Browser refresh is not a SQLite fault oracle.

Every retained artifact is listed in [SHA256SUMS](SHA256SUMS), with verification in
[verification.txt](verification.txt). Raw logs are path-redacted with `redact()`;
fixture/test/screenshot inspection found no machine paths or device identifiers.

Retained artifacts:

- [001-waived-original-corpse.png](001-waived-original-corpse.png)
- [002-dark-loft-owned-corpse.png](002-dark-loft-owned-corpse.png)
- [003-recovered-original-belongings-after-reload.png](003-recovered-original-belongings-after-reload.png)
- [004-empty-corpse-no-waiver-or-fare.png](004-empty-corpse-no-waiver-or-fare.png)
- [capture-notes.txt](capture-notes.txt)
- [controlled-fixture.json](controlled-fixture.json)
- [d1-book-notice-final-green.log](d1-book-notice-final-green.log)
- [d1-book-notice-final-red.log](d1-book-notice-final-red.log)
- [d1-book-notice-old-suite.log](d1-book-notice-old-suite.log)
- [d1-browser-ci-failed.log](d1-browser-ci-failed.log)
- [d1-browser-ci-probe.log](d1-browser-ci-probe.log)
- [d1-browser-double-tap-green.log](d1-browser-double-tap-green.log)
- [d1-browser-exact-production.log](d1-browser-exact-production.log)
- [d1-browser-exact-recovery.log](d1-browser-exact-recovery.log)
- [d1-browser-final-app-proof.log](d1-browser-final-app-proof.log)
- [d1-browser-harness-red.log](d1-browser-harness-red.log)
- [d1-browser-hosted-same-head-green.json](d1-browser-hosted-same-head-green.json)
- [d1-browser-journey-green.log](d1-browser-journey-green.log)
- [d1-browser-recovery-confirmed.log](d1-browser-recovery-confirmed.log)
- [d1-browser-recovery-fixed.log](d1-browser-recovery-fixed.log)
- [d1-browser-recovery-harness.log](d1-browser-recovery-harness.log)
- [d1-browser-recovery-import.diff](d1-browser-recovery-import.diff)
- [d1-browser-transport-artifact-red.log](d1-browser-transport-artifact-red.log)
- [d1-browser-transport-red.log](d1-browser-transport-red.log)
- [generate-recovery.ts](generate-recovery.ts)
- [missing-board-screen.txt](missing-board-screen.txt)
- [missing-board.png](missing-board.png)
- [recovery.e2e.test.ts](recovery.e2e.test.ts)
