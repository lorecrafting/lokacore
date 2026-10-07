# C6 provisional primary review — 2026-10-06

**Verdict: CHANGES REQUIRED.** Independent source review of `8acf6825` against
published main `de8b1cb5`. The reviewer authored none of the implementation.
This reviews the preserved provisional source; it does not accept a final C6
release. D9 publication, final predecessor integration, independent known-answer
pins, browser closure, the full gate and exact-head CI remain publication gates.

## Requirements and scope

Reviewed the C6 brief and its governing mechanics, protocol, save, cartridge and
Book clauses; delivery workflow; mechanics, storage, contract, mobile and evidence
lessons. Checked the actual source diff, authored route/actions/Sedge dialogue,
portable composition twins, compiler/loader validation, projection/invocation,
receipt/save recovery, focused tests and provisional feature/transcript records.
No owner save or browser/native session was accessed. Review controls ran only in
an isolated detached checkout; production source was not changed.

## Findings

### P1 — blocker: failed attempts keep active Journal instructions

`kernel/ts/src/view/quest_journal.ts:56` selects prose from the quest lifecycle,
which deliberately remains `active` after expedition departure/death. Consequently
the authored `marsh.journal.failed` is never selected for an attempt failure.
`mobile/app/book/pages.tsx:267` prints `0 of 5 entries` and suppresses next-route
text, but never renders failed status or retry guidance. A player who leaves the
footprint or dies sees the active circuit instructions instead of the required
immediate Hound Run retry.

Controlled evidence: appended a literal Journal expectation to the existing real
departure test, after its confirmed failed/cursor-zero assertions. It fails with
actual `marsh.journal.active`, expected `marsh.journal.failed`. Select failure prose
from the attempt without making the quest terminal; preserve explicit Restart.
This violates the C6 Book clause and blocks provisional source approval.

### P2 — should-fix: detours make Journal directions misleading

`kernel/ts/src/view/quest_journal.ts:82` projects the next authored edge's direction
and destination without its origin. `mobile/app/book/pages.tsx:268` renders those
as `Next: west to Willow Shade`, implying a move from the current location.

Controlled evidence: after reaching cursor one at Reed Bank, an accepted east
detour returns to Hound Run and correctly retains cursor one. The Journal still
projects west/Willow Shade while the actual west exit's sight names Reed Bank.
Following that instruction makes an uncredited move to a different room. Preserve
the retained edge and identify its origin, or limit current-location direction
wording to the edge's origin. The C6 Book clause requires an honest next edge.

## Checks and controls

- Focused provisional kernel, contract and real-SQLite tests: nine passed.
- Actual-source acceptance tests after isolated dependency installation: two passed.
- `mise exec -- mix test --force test/loka/content_expedition_test.exs test/loka/core/compose_test.exs`: exit zero, fourteen passed.
- P1 controlled assertion: nonzero test result, the literal failure above.
- P2 accepted detour: confirmed current Hound Run, retained cursor one, projected
  west/Willow Shade and actual west/Reed Bank.
- Controlled stored command-direction and current-location tampering both produced
  typed `save_corrupt` through full `openGame`; neither supports a save finding.

The initial actual-source run lacked isolated checkout dependencies; installation
resolved that environment failure. Full publication checks were not claimed green.
The preserved artifact/transcript and feature cells explicitly remain provisional;
frozen protocol fixtures are unchanged by this diff.

## Simplicity and correctness self-review

Applied Ponytail Review questions by hand: no additional over-engineering finding.
The implementation uses existing movement/death/encounter/quest/fact ownership,
changed-row commits and small receipt helpers, with no added dependency or raised
size limit. Validation and recovery checks are necessary trust-boundary work.
Self-reviewed the findings against lawful detours and the deliberately nonterminal
failed quest: neither requests new mechanics or terminal quest failure.


## Scoped fix round 1 — P1/P2 closed

**Verdict: APPROVE for provisional source `5658f7c39c9d067afc9f1f90aff8cb83c0f1bb6d`.**
No open primary findings. This is a scoped source approval, not final C6 release
acceptance; the publication gates named above remain in force.

Reviewed the five-file fix diff from carried review record `c0b999ea`, its direct
Journal/Book callers and the two new actual-source regressions.

- **P1 closed:** `kernel/ts/src/view/quest_journal.ts:57` now chooses the authored
  failed-attempt prose while preserving the nonterminal quest. Actual departure,
  cold reopen and explicit Restart retain failure/retry text and then restore
  active text with a fresh attempt at cursor zero.
- **P2 closed:** `kernel/ts/src/view/quest_journal.ts:87` supplies a directional
  hint only at the bound route edge's origin. `mobile/app/book/model.ts:18` and
  the Journal renderer show the retained named checkpoint without an inapplicable
  direction. Returning to Reed Bank restores west/Willow Shade without crediting
  that return move.

Independent verification: the focused kernel/contract/actual-source/real-SQLite
suite exits zero with thirteen tests passed. An additional throwaway reviewer
control, using the actual compiled source with its ancestry choice and populated
hound Start/Flee, exits zero: a legal cursor-one detour reopens with the truthful
checkpoint label; return reopens with the directional label; outside-footprint
failure reopens with `marsh.journal.failed`; explicit Restart reopens with
`marsh.journal.active`, cursor zero and a different attempt ID. `git diff --check`
on the fix diff exits zero. The temporary control was removed.

The added tests exercise accepted moves and Restart against compiled authored
content. Their literal expected stage/status/text values are independent of the
projection implementation and catch distinct breaks missing from the prior tests.
Inspected the developer's three recorded restored red controls: removing the P1
selection fails on active versus failed prose; removing the P2 origin guard fails
on west versus absent direction; restoring the old Book formatter fails on
`Next: undefined to Willow Shade.` versus the checkpoint label. The original
review independently demonstrated P1's failing literal assertion and P2's wrong
actual detour behavior. No production source was edited during this recheck.

Ponytail/correctness scoped self-review: the two projection conditions and small
Book formatter are sufficient; no new dependency, schema or release pin, generic
rendering layer, or unnecessary test fixture. No additional finding.
