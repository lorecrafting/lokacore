# C2 — Watchman's Rounds: finite patrol and immediate recovery

**Adopted PM assignment; reviewed dependencies re-pinned for source assignment.**
Suggested source branch `chapter-1/c2-watchmans-rounds`; developer uses its own worktree.
Source base `c85e21ef` on published GitHub main
contains B1 clock/status, Q2-C-rescue and the independently approved C1 training
([primary](../../reviews/2026-10-05-c1-tobin-primary-review.md),
[save/protocol](../../reviews/2026-10-05-c1-tobin-save-second-review.md)).
B5 herbs and B4 light are also integrated and reviewed; [the roadmap](../../ROADMAP.md)
records their publication. The current chapter artifact is 0.0.21/API1.19,
hash `a274bb1c6b22306718648bbcb1b967ee017e0420b62589afe10e1009434dbbfa`,
94 IDs ([known answer](../../../protocol/fixtures/missing_child_v021_hash.json)).
C2 needs no B7 behavior. During source tracing, B6 exact dialogue selection became
a shared source dependency: its selector allows patrol controls and C1 lessons at
the same original Tobin without first-dialogue ambiguity. Integrate the reviewed
selector and re-pin its artifact before final C2 verification. If either lands before C2, merge main and re-pin the
source artifact before implementation or publication; serialize shared cartridge,
protocol and generated-file edits. C2 successor release/API/hash/IDs, source head,
PR and verdicts remain null. No source, tests, browser/native sessions or save
operations are performed by this planning change.

## Goal and governing clauses

C2: accompany Tobin on a finite patrol, with failure recovery and no nighttime wait.
Deliver the complete optional S3 outcome through four real checkpoints, honest
pause/failure, immediate Rejoin/Restart and durable trust. Follow the
[PM adoption](../../decisions/pm-decision-c2-watchmans-rounds-2026-10-05.md),
[selected mechanics](../../system/mechanics.md#s3-finite-watch-patrol-c2-selected-contract),
[route/production settings](../../system/cartridge.md#c2-watch-route-and-trust),
[typed composition/admission](../../system/protocol.md#c2-patrol-composition-and-admission),
[save/reopen](../../system/save.md#c2-patrol-attempt-recovery) and
[Book](../../system/book-ui.md#c2-watch-patrol-details). Installed movement, combat/Flee,
death/shrine/corpse custody, escort, quest, dialogue and receipt contracts govern their
existing behaviors. Read mechanics/storage/contracts/mobile/evidence lessons before
their areas. Apply Ponytail before implementation, Ponytail Review and actual-diff
correctness review before handoff. Native work remains paused.

## Real route and ownership

Existing Ferry Landing north → Well Lane north → Green north → North Gate east
(new) → Watch Post reaches the same original C1 Tobin. Keep his pennies, skills,
dialogues and exact rusty gift; there is no substitute Tobin. Add exactly Watch
Post, Watch Cell, Gate Tower and East Gate with the links in the cartridge clause.
All four rooms have equipment-free egress. Read the actual duty roster and road
sign; no gate key or outside-chapter road target is needed.

Talk/Start at Watch Post earns0 checkpoints. Continue rounds moves Tobin west alone
into North Gate; the player then moves west, earning1. Continue south/player south
joins Green for2. Continue east/player east joins East Gate for3. Continue west/player
west through Green and north/player north through North Gate remain3. Continue east/
player east joins Watch Post for4, resolving S3/completed and trust true once.
No clock wait, money, learning, light, hound combat or automatic player movement is
part of this route. Trust grants no extra item/skill/gate; C1 teaching remains optional.

**Composition record:** real consumer is original Tobin leading ordinary player
travel, with actual fatal player death invalidating the current attempt. Reads are
bound actor/body/Tobin/S3/activation, attempt/cursor/status/credit, actual accepted
entered-room/fatal events and life/location/passage. Writes are one typed patrol
row, leader containment, choice/quest progression and reserved player trust;
movement/death retain their own player/corpse writes. Patrol owns leader progression
and credit, movement owns edge admission/transfer, quest owns activation/terminal,
death owns fatal reset before revival, authority owns receipt/commit/adoption.

Reuse body/life/location queries, ordinary passage/transfer/entered occurrence,
quest/choice hooks, reserved facts, changed-row receipts and full-prior transition
preconditions. Missing invariant is durable bounded player-follow-leader attempt
identity and ordered causal checkpoint credit. Implement only its typed row and
transition, keyed to this actor's exact quest instance; do not repurpose Wren's
actor-keyed NPC-follow-player row. Use accepted start/restart command IDs as attempt
identity, without another identity allocator or unbounded event history in the row.
The existing receipt history proves transitions. No named Tobin/S3/room branch belongs
in kernel code. Bounds and route values live in cartridge data; shared safety budgets
apply to projection/admission/validation before work. Any new foundation composition
branch requires independent literal fixtures and two-kernel differential proof.

Likely files: chapter manifest/rooms/Tobin/S3/dialogues/facts/text; minimal patrol
owner and shared movement/dialogue/death hooks; compiler/loader; typed protocol
state/delta/invariant/action/view shapes and generated outputs; both compose twins
only if needed for the new transition; local-story save validation; existing NPC/
Journal/World projection and Book details. Preserve integrated C1/B5/B4 definitions
and derive fresh successor pins independently. Out: daily NPC
patrol AI, hounds/assist/arrest, NPC death/replacement, survival duration/timer,
general quest interpreter, skill/reward changes, extra rooms, server adapters,
new native work, navigation redesign and save migrations.

## Independent expected behavior and red controls

Use actual loader/public commands, hand-checked route answers and real disposable
SQLite. Each new test names a distinct realistic break. Apply its mutant to the old
focused same-layer suite first; if existing focused coverage fails, add no duplicate.
Observe red, restore and rerun; expected results never come from the implementation.

- **Leader entry credited before player join:** Start0; leader west leaves player at
  Post and credit0; player west gives1. Continue/player south2, east3, west3, north3,
  east4, S3/completed, trust true. Four North Gate repeats never give4. Plant leader-
  event credit, missing deduplication or source/attempt validation and observe reds.
- **Wrong orientation or competing escort:** keep an active following original Wren
  while starting S3; Continue moves only Tobin, while the correct player Move carries
  Wren once and credits S3 once. Failed passage/insufficient player movement leaves
  that join pending with player/Wren behind. Replay neither departure nor join twice.
  Plant a second player transfer, swapped relation target or free movement admission.
- **Departure silently resumes:** after credit1 at North Gate, player north to chapel
  pauses with credit1; Tobin remains North Gate. Player south returns but remains
  paused/credit1; explicit Rejoin gives together/credit1. From cursor1, legal paired
  joins Green→East Gate→Green→North Gate→Post give2→3→3→3→4. A fresh-id stale
  Continue carrying old attempt/cursor/status refuses atomically. Plant implicit
  arrival Rejoin or omitted drawn-cursor guard. Close stays usable when an action is unavailable.
- **Death retains old survive credit:** credit2 at Green; player leaves to the real
  cellar and suffers an actual fatal installed rat round. Death marks failed/credit0,
  same-body shrine return, Tobin still Green/cursor2, S3 active/trust false. Return by
  ordinary exits and Restart at Green gives a new attempt/credit0, cursor2. Paired
  entries East Gate→Green→North Gate→Post give1→2→3→4; resolve once. Old attempts,
  revival and player-alone visits give no credit. Plant omitted fatal reset or old-
  attempt acceptance. Also kill while awaiting with Tobin ahead in a controlled
  actual combat setup; lawful leader-ahead death must fail, not fault.
- **Trust without terminal proof:** final join commits one S3/completed/trust true,
  with no penny, skill or item change. Repeat, exact retry and later travel/death
  retain terminal truth and no movement/reward. Starting skills acquired or absent
  both remain unchanged; the old C1 lesson/gift behavior stays governed by C1.
  Plant omitted terminal guard or unrelated-receipt evidence acceptance.
- **Recovery gated by trust/hour:** walk all four new rooms, Read both details and
  return from Cell/Tower. At18:00,23:00 and next-day06:00 an untrusted/untrained
  actor can use the real chapel/village/fen/cellar route and recover the actual owned
  corpse/items. Plant a required-route trust/hour barrier and observe the journey fail.
  Perform actual patrol starts at those phases; elapsed-only delivery never moves Tobin,
  fails a reading pause or skips a leg. If existing focused coverage catches a break,
  retain it instead of adding source-text checks.

Death is proved with the existing fatal combat producer, not a synthetic surviving
flag; C3 hounds are not claimed installed. The player may finish a safe patrol without
combat. The four-checkpoint survival contract means no fatal event during the attempt.
Controlled temporary gates/faults do not add production keys/locks/danger.

## Save, checks, review and stop trigger

Use real cold reopen after every selected boundary and later consume that state:
activation, leader ahead, each join, pause, arrival before Rejoin, fatal failure,
player return, Restart and completion. Replay accepted transition receipts in
revision order and verify causal entries/death and current row in both directions.
Mutate exact identities/refs/scopes, cause/correlation, attempt/cursor/status/credit,
start/restart proof and terminal trust in actual SQLite rows; require typed
save_corrupt with file unchanged. Keep lawful player travel after completion and
pause/failure distinct from corruption; keep storage errors and release mismatch typed.

Failed COMMIT, unknown-not-committed, unknown-committed and lost reply must retain
all-old/all-new transfer/patrol/choice/quest/trust/head/receipt and no duplicate credit
or allocation. Test concurrent Wren escort/death and C1 lesson payments/reopen; new
patrol validation cannot reject those lawful independent state changes. No snapshot,
manual bookmark, migration or silent reset is introduced.

Run focused compiler/loader/short-ref/schema invalid cases, both-kernel composition
fixtures/differential when changed, patrol/dialogue/movement/Flee/death/quest/escort,
Book and real SQLite tests. Each changed schema gets its required/bound mutant sweep.
Report commands, exits, actual red controls and failures. The provisional lane uses
focused checks; full active mise check_all and red controls run once at accumulated
publication under the normal hook. Fresh primary plus required save/protocol opinion
applies; Astra audits runtime/proposal if touched. Later source changes require scoped
review. Browser proof walks the real Book route, refresh, pause/recovery and terminal
narration; no native or owner-save operation is authorized by this assignment.

Stop/escalate unreviewed dependency pins, a current-spec conflict, unsupported mortal
Tobin, blocked required recovery route, silent reuse of escort orientation, a second
location writer, unbounded route/history work, general objective machinery or a source
footprint larger than this complete outcome. Planning author review found no current
spec conflict: the archived swords/night/gate/Bram choices are explicitly amended.
Ponytail Review: lean; one concrete typed continuation, existing ownership/transactions,
no scheduler, reward framework or dependency. This is self-review, not independent approval.
