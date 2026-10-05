# M20-B2 — playable Maud quest and storage

Make Maud’s five-rat quest playable, with an earned storage key, +5 trust and a chest that stores items.

Governing clauses: [Maud content](../../system/cartridge.md#mauds-cellar-content-m20-b2),
[Book dialogue, Journal and container controls](../../system/book-ui.md), and the
[opening/commit contract](../../system/save.md). B1 merged at `ab17f58e`; this branch
merged it normally and also merged the PM status update `1571f3ab`.

## Final native proof

[Final Release build](native/final-book-build.json) pins source
`b2601c47a1bc14001399e7bcdfdfe7a5b07996b9`, iOS Simulator Release, signing disabled,
and `ashmere_sampler@0.0.10` / API1.7. The following commit `1b6bb44a` changes only
the test loader; its mobile runtime/content inputs are identical. Artifact hashes
and the independent current content hash are in the build record.

A second fresh, isolated Simulator installation ran the actual bundled chapter.
`agent-device` pressed visible controls, captured accessibility snapshots and PNGs,
and waited for actual elapsed combat to return to World. SQLite observations used
read-only connections; no state injection supplied credits, rewards or storage.
The owner's Simulator was not operated or inspected.

| Observed behavior | Retained proof |
|---|---|
| Keyless, unaccepted cellar entry; five actual rat deaths before acceptance | [initial rows](native/final-keyless-cellar.json), [five credits](native/final-five-kills-before-acceptance.json), [five corpses](native/final-five-corpses.png) |
| Acceptance gives no key; Journal is ready | [rows](native/final-accepted-ready.json), [Journal](native/final-ready-journal.png) |
| Done transfers original key, adds5 trust, clears cellar and resolves only Maud | [rows](native/final-rewarded.json), [narration](native/final-reward.png), [resolved Journal](native/final-resolved-journal.png), [inventory](native/final-earned-key.png) |
| World has no premature whole-story ending hint | [World after done](native/final-world-after-done.png) |
| Reward leaves chest locked; ordinary Unlock/Open exposes concrete Put | [locked chest](native/final-chest-locked.png), [Put control](native/final-put-control.png), [stored item](native/final-stored-item.png) |
| Close, terminate/relaunch same Release, Open, Take retrieves same brass key | [closed rows](native/final-stored-closed.json), [cold rows](native/final-cold-reopen.json), [reopened chest](native/final-reopened-chest.png), [retrieved rows](native/final-retrieved.json), [inventory](native/final-retrieved-inventory.png) |

[Independent native IDs](native/final-independent-native-ids.json) use Python stdlib
SHA-256, the declared world context and literal reviewed allocation ordinals.
[Literal state assertions](native/final-verification.json) passed. The final native
run had no player death; the production SQLite test separately exercises actual
death and equipment-free shrine return. This proves the Maud/storage consumer,
not a completed Missing Child chapter or a production release.

## Tests and red controls

The actual compiler matches the independent Python sampler answer. The frozen0.0.9
answer remains byte-identical history for conformance/transcripts, with no runtime
adapter. Production tests exercise actual combat, early/late acceptance, each
four-credit omission, same-key rewards, attic separation and real SQLite reopen.
One Book rendering regression covers Maud completion without a whole-story hint.

[Mutation results](content/results.json): deleting the fifth objective leaf,
binding the chest to the brass key, restoring a keyed cellar gate, and switching
the actual App bundle to0.0.9 each failed its behavior test (exit1); restoration
passed (exit0). Mutated content was compiled before execution. Restoring the old
Book ending heuristic [failed](content/false-story-ending.log); the corrected
consumer [passed](content/false-story-ending-restored.log).

[Full checks](content/full-checks.log) passed before the final B1 merge/Book fix.
The final source is checked again by the required pre-push hook; its result is
reported with the exact PR head. No protocol vocabulary/schema or engine rule was
added. Ponytail Review: lean already; no new dependency or speculative abstraction.
Correctness self-review checked all five bindings, reward custody, frozen fixture
selection, current release pins, and the generic Book removal.

## Failures retained and disposition

Native actions001–065 and unprefixed screenshots/rows predate the Book fix and are
diagnostic only. Actions066 onward carry `Phase: final Book fix`; the fresh final
quest walk starts at action070. Earlier builds remain labeled in their JSON files.
The first wait targeted transient death narration and timed out; later waits target
World room return. Earlier reward stale-view refusals preserved the pending reward
until a successful visible retry. The old World capture demonstrated the false
ending hint and triggered the PM-approved generic consumer removal.

Final traces retain an unchanged map tap followed by a successful normal retry,
driver refusal of an outdated frame ref, and redundant Leave/selector attempts
after automatic page routing. Fresh snapshots/selectors continued the walk; none
supplied game state. The failed inventory navigation image is explicitly named
`final-inventory-navigation-refusal.png`. The first isolated Simulator had already
shut down when termination was attempted; final proof uses the second fresh one.

Initial fixture drift, helper complexity and EntityId typing failures are retained
under `content/` with their fixes represented in the source. No failed result was
converted into a passing claim. Logs redact local/scratch/container paths and
Simulator identifiers. [SHA256SUMS](SHA256SUMS) covers retained evidence bytes;
[verification](SHA256SUMS.verify.txt) is beside it, neither file self-listed.
