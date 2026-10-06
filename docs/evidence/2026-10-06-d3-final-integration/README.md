# D3 final published-main integration proof — 2026-10-06

Branch: `chapter1/d3-western-ashmere`. Published predecessor:
`e9db5bdffc9bfc98d1580a65e6e99fff53451497` (C4 + D4 and current CI scope).
The predecessor was incorporated with a merge commit; provisional D3 source and
its [independent review](../../reviews/2026-10-06-d3-western-ashmere-source-review.md)
remain preserved. Governors: [approved brief](../../briefs/chapter-one/d3-western-ashmere-brief-2026-10-05.md),
[cartridge](../../system/cartridge.md#d3-western-ashmere-declarations),
[Book](../../system/book-ui.md#d3-mill-cottage-and-hob-details) and
[B4](../../system/mechanics.md#b4-light-and-darkness-selected-contract).

Independent successor: `ashmere_missing_child@0.0.33`, API `1.28`, hash
`5d48ad7fb4402de91c775dfe9395949ed1c1fe73d4bf0e13f2cb29717c1c1fdf`,
184 starting IDs. The [independent generator](../../../protocol/fixtures/generate_missing_child_v033.py)
uses frozen v032 plus literal D3 declarations, Python canonical JSON, SHA-256
and ID domains; it imports neither compiler nor kernel. Compiler comparison,
active TypeScript allocation and active app bundle use the successor fixture.
The first real-SQLite D3 check verifies the exact successor hash and cold-reopens
new rooms and readable receipts; controlled schedule/death fixtures separately
exercise both boundaries and both actual dark owned-corpse recoveries.

Each raw log records its command and individual exit status. Nine integrated
source mutations fail: missing mill return, wrong Hob start, wrong dawn, missing
dusk, swapped document bodies, missing loft/cellar darkness and extra cellar rat.
Restoration passes. Old-suite justification for the added checks remains in the
[provisional proof](../2026-10-06-d3-western-ashmere/README.md).

Final check results: full `mise exec -- bin/check_all.sh` **exit 0**,
including 368 ExUnit tests, contracts/features, boundaries, Credo, core size/
purity/docs/tracker red controls, all kernel TypeScript tests/typechecks,
active chapter simulator and Prettier. The retained first gate failed only
obsolete active dream/patrol v032 references; re-pinned current assertions
passed their focused 5-test rerun before the final gate.

Focused routes/light/ferry/food/real-SQLite checks pass 37 tests; additional
Book/readable/notice/navigation checks and final exact-pin SQLite checks pass.
App TypeScript checks pass. The browser route/schedule red control uses a
lawful controlled artifact with Old Mill north redirected and Hob dawn delayed
until 07:00: both new browser consumers fail at their named behavior. Browser
selector/bootstrap correction attempts remain retained as failures; they
exposed test assumptions about automatic Read, Leave, inventory, targeted
action labels, repeated dialogue history and reopen routing, requiring no
production behavior changes. The restored final browser result is retained
in `browser-restored-final.log`: **2/2 pass, exit 0**. Both documents and all
up/down routes survive the walk; each dark branch and both Read histories
survive reload. Hob is met while lit in Mill Loft at 18:00, then in Old Mill
after the controlled 06:00 boundary, with saved Conversation/Leave restored.
No owner save, native preview, simulator or device was touched. Browser tests
use an isolated origin/save; the Hob test controls only browser clocks through
an init script, buying and igniting the actual torch through Book controls.
No production testing hooks, new capability, writer or schema were added.

Ponytail Review: **Lean already.** Existing compiler, fixture convention,
Book controls, schedule/light mechanics, rollback-journal SQLite and browser
harness suffice; no dependency or abstraction added. Correctness self-review
covers preserved Boathouse ferry/east edge, literal reciprocal routes, exact
Hob identity/boundaries, Read history isolation, original corpse/light custody,
allocation ordering and all active successor references. Independent final
review and exact-head remote CI remain PM work; no push or PR was made.
