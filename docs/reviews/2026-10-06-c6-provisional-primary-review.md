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


## Final actual-publication source review

**Verdict: APPROVE for source `206ffb39de549d9781fa36bb61e9fada2852ad4f`.**
No open primary source findings. This approves the final source and release pin;
full local publication checks, independent save/protocol disposition, browser
closure, exact-head hosted CI, PR and merge remain delivery gates. It does not
claim C6 published or owner/native proof.

Reviewed final integration over published D9 main `b52eaeff`, candidate source
`c32d1c21`, and the three-file bundled-Book correction to `206ffb39`. Earlier
provisional P1/P2 remain closed. Checked the changed source/pin/tests and direct
movement/composition callers, retained hound/death/receipt ownership, current
Sedge dialogue selection, final transcript discovery and independent oracle.

### Final pin and integration

Chapter `0.0.41`, API `1.36`, content hash
`cee92d0a2e460318724ffcc004aaeb6c2bc9f5abf124ca9845958eeb11378f7a`,
209 initial identities. Ran the standard-library Python successor generator with
writes captured in memory: both final hash/canonical and ID output reproduce the
retained fixture bytes exactly. The generator starts from unchanged frozen D9
v040, independently expands C6 references, and pins the five literal route edges
and minus-one consequence; it calls no compiler/kernel helper. Elixir source
compilation equals that complete answer; TypeScript allocation compares every
initial identity to the independent answer.

Size corrections retain validation order, complete prior-row checks, immutable
bindings, attempt identity, cursor increments and legal lifecycle transitions.
Movement still passes its transfer prefix into patrol then expedition, and
preserves resulting operations/events/narration order. The closed-union target
and row dispatch changes preserve quest/patrol behavior. No existing frozen
fixture was changed. The provisional duplicate artifact and special transcript
replay override are removed; normal discovery replays the final trace including
ancestry selection.

Browser preparation independently found that `c32d1c21` still bundled v040. The
minimal reviewed correction selects v041 in the actual App and updates the
existing shell test's independent literal hash. That packaging issue is closed
at the approved source above.

### Independent checks

- Final C6 kernel/schema/actual-source/real-SQLite and full transcript replay:
  exit zero, seventeen tests passed.
- Focused Elixir chapter oracle, expedition physical-edge compiler admission,
  deer/dream/patrol consumers and portable composition: exit zero, thirty-two
  tests passed.
- Actual corrected App shell: exit zero, five tests passed, including unsupported
  old-save refusal/preservation and unchanged save ownership.
- A throwaway actual-source real-SQLite control: exit zero. Sedge teaches free D1
  swim before any S27 instance; cold reopen retains it; actual D6 Pool Bottom has
  the literal 120-second water budget; ordinary return then real populated hound
  Start/Flee and the five ordered entries complete C6, still retaining swim.
- A throwaway extension to the real fatal-bleed SQLite test: exit zero. Stage-three
  fatal return cold-reopens with `marsh.journal.failed`; ordinary corridor return
  and immediate fresh Restart cold-reopen with `marsh.journal.active` and cursor
  zero. Both reviewer controls were removed.
- `git diff --check` on final changes: exit zero.

The retained real-SQLite suite also proves each ordered stage/shelter reopen,
C6-first Sedge acknowledgement and subsequent independent lesson/D6 use, forged
save refusal without changed rows, deferred-FK failed COMMIT, successful COMMIT
with lost acknowledgement, and exact-invocation replay without duplicate reward.
The actual-source hostile-prior Sedge regression confirms the hostile default
prompt remains while explicit C6 acknowledgement and free D1 teaching work.

The compiler and loader each reject a controlled nonexistent north route edge;
the loader input is independently rehashed so it reaches semantic admission.
Schema tests execute their individual guard removals through the explicit schema
argument. Inspected the recorded restored physical-exit and selected-dialogue
mutants: their focused new regressions fail while earlier focused cases pass.
New cases name distinct plausible breaks, use literal/independent answers and
accepted behavior on controlled source; no source-text assertion or coverage-only
case was added. Production source was not edited during this review.

Ponytail/correctness final self-review: bounded helpers remain in their current
owners, no new dependency or raised size allowance, no alternate lesson or extra
state framework. Necessary admission and corruption/refusal checks remain. No
additional finding. Owner-save bytes were never read or written.
