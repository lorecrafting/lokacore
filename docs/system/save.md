# The local Story authority and the save

`mobile/authority/local-story/` decides Story play on the phone and saves it in one SQLite
file per story. The world lives in memory; a rule only proposes; the host commits the changed
rows plus a receipt in one transaction, then adopts the result, then replies (ADR-072;
`authority.ts:1`). `invoke` is synchronous on one connection, so commands run one at a time.

## Opening a story

`openStory(db, releases, host)` (`authority.ts:69`) takes the bundled releases newest first
(each a content hash and a fresh world) and the host: its `kernel_version`, a random UUID per
call (`newId`), an optional account binding read once when a run starts, an optional clock
for latency, and an optional random source shaped like `getRandomValues` (`:44`). It opens the
save on the release its pin names, or saves a fresh world of the newest release at revision 0 as
a new save: with a random source, under a world context and RNG seed drawn for the new lineage
(below), else the release's own fresh world.

Saved quest rows require valid `DefinitionRef` quest and `StateScope` scope fields before
receipt recovery. Malformed fields are `save_corrupt`; no quest is silently skipped.

Refusals, nothing written:

| Reply | When | New game offered |
|---|---|---|
| `unsupported_save_format` | the `save` row's format is `loka-save-vN` with N above 2 (a newer app's; checked first) | no: the player updates the app |
| `save_corrupt` | the head, a state row, the identity or the RNG does not parse; half a save (rows or receipts without their tables) | yes, in place; reports and the trace survive |
| `save_corrupt` | SQLite says the file is not a database or a page is malformed (`store.ts:157`) | yes, but `newGame` throws: the host deletes the file (below) |
| `pinned_release_missing` | the pin names a release the app does not carry | yes, on the newest release |

The session controller adds `save_corrupt` causes with the new game in place after a story
opens: a world whose first screen cannot be built
(`mobile/authority/local-story/session.ts:60`), or a receipt response in the story's scope
that is not valid JSON or has a narration line without a key (`:71`). A stored Read command
that is invalid JSON or has no valid target also follows this corruption path. A
successful readable-recipe receipt also requires a valid committed Command bound to
`receipt.command_id`, the pinned recipe's action, and exactly one root-caused
`action_completed` naming that action and its canonical detail subject. Missing or mismatched
evidence follows the same corruption path. This structured receipt derives detail identity for
replay and reopen, without a new row or transcript. Unrelated receipts retain ordinary routing.
Riddle Choose narration also derives its original speaker from the committed command's
continuation and the saved ChoiceRow, which persists after resolution. Command identity,
choice ID, row source/beat/roles, outcome and root resolution evidence must agree; riddle
wrong receipts instead prove a bank-valid wrong answer with no root mutation/event. Conflict
or missing evidence is `save_corrupt`, even if the pending choice is already gone. No new
save table, format or transcript is introduced.
SQLite read failures such as locks and I/O errors retain their storage-error handling. Any other
valid-JSON response of the wrong shape still opens; its replay is a `conflict`
([receipts](#receipts)). Tests: `saves.test.ts` ("an app update reopens a save on its pinned release; new games pin the
newest", "a save of an unknown format is refused with nothing written and no new game"),
`recovery.test.ts`, `start_over.test.ts`.

During [pre-production development](../decisions/owner-decision-preproduction-compatibility-2026-10-04.md), old release/save
compatibility is not required. A save opens only when its exact release pin is available;
a mismatch is explicitly refused, never silently migrated, retargeted or deleted.

The [active chapter cutover](../decisions/owner-decision-actual-chapter-cutover-2026-10-05.md)
uses a distinct save file from the old sampler preview. It does not migrate or delete that
preview; active-save mismatches still use the refusal and confirmed Start over above.

## Receipts

Scope `story/<lineage_id>/<character>` (`save.ts:137`). A receipt (`store.ts:32`) stores
the invocation id, the CommandId, actor, `intent_digest_version` (`loka-intent-v1`) and intent
digest, the resolved Command (null for a rejection before one existed), the revision (unchanged
for a rejection) and the DecisionResult. Replay (`mobile/authority/local-story/invocation.ts:50`): a known invocation id
with the same digest version, a response that validates as a DecisionResult and the same
intent digest replays `{saved, replay: true}` at its revision without deciding again; any
other known id is `conflict`. A fault gets no receipt (`:174`). Known answers: `kernel/ts/test/lantern_proof.test.ts`, `mobile/authority/local-story/lantern.test.ts` (the frozen
Lantern traces and the 11 adverse cases). The latter projects kernel values onto the traces'
vocabulary by the R6P P4b mapping ([archived ROADMAP](../archive/ROADMAP.md), R6P row) as
changed by Quest from dialogue: action `activate` is gone; action `talk` with no target is the
talk Bram's GameView offers now (`bram_offer` before the quest, then `bram`); continuations
`offer-choice:offer` and `proof-choice:talk` are the minted ContinuationIds of Bram's `bram_offer`
and `bram` choices, and narration ids follow them; outcome `accept` is the kernel's.

## Replies

`Reply` (`authority.ts:24`): `invalid`, `unauthorized`, `conflict`, `fault {code}`,
`pending` (a COMMIT whose outcome is unknown; retry the same invocation), `stale_view` (a NEW
invocation whose `view_freshness_token` starts with `view:` and is not the current
`view:<run_id>:<revision>`, `:121`; any other token is not checked), or `saved {replay, revision, decision}`. Accepted invocation replies also identify their committed
`command_id` for exact narration recovery, including eventless wrong answers. A failed commit throws with memory and
storage unchanged.

## Commit, fence, reconcile

`commit` (`store.ts:245`) writes in one transaction: pending story point reports, and for an
accepted decision the head (revision, clock, RNG) and the state rows its delta targets wrote,
then always the receipt. `transaction` (`:265`) is `BEGIN IMMEDIATE` … `COMMIT`: true once
committed; a failed write rolls back and throws; a failed COMMIT, or a ROLLBACK that leaves the
transaction open, returns false: the outcome is unknown. Then the story is **fenced**
(`save.ts:41`): every call answers `pending` until `reconcile` (`transaction.ts:10`) rolls back and
reads the receipt (committed: memory adopts the saved head; not there: the attempt failed).
Memory never serves a state the store did not confirm. Tests: `faults.test.ts` (every fault
leaves the prior or next revision), `saves.test.ts` ("a new game whose COMMIT is unknown is
fenced; settling it moves play to the new run").

The [M20-B1 reward and Put](mechanics.md#dialogue1-mechanicsdialoguerulets-kerneltssrcmechanicsdialoguesharedts)
use these same changed containers/facts/quests/choices/head/receipt rows, with no new table or format.

## The save file (`loka-save-v1`)

`store.ts:46`, STRICT tables:

| Table | Rows |
|---|---|
| `head` | one row: `revision`, `clock`, `rng` |
| `state_row` | `(section, key) → value`, the State sections as canonical JSON |
| `receipt` | the receipts above; unique `(scope, invocation_id)` and `(scope, command_id)` |
| `save` | one row: `format`, `lineage_id`, `run_id`, `parent` (null: every save is a new game), `seed` (the run's initial RNG), `pin` (cartridge id, version, content hash, capability lock, rule_ir, `world_context_id`; numeric and RNG profile null), `binding` (account or null) |
| `report` | story point reports: `report_id`, `lineage_id`, `binding`, `report`, `disposition` (pending, accepted, rejected, needs_attention), `acceptance`, `tried` |
| `trace` | the game trace, `(ordinal, command_id, commit_state, record)` |
| `observation` | capped diagnostics and operations records |

The seed and the pin's `world_context_id` are the lineage's initial RngState and world
context: every id of the initial world is minted from the context ([ADR-075](../archive/decisions/adr-075-observability-proposal.md) §3 `seed`, §4
amendment A4; [10 §32](../archive/spec/10-mobile-commerce-release.md), a run pins its release). A
save from before c1-host has no `world_context_id`; it is never rewritten. The format stays
`loka-save-v1`, so a build from before c1-host opens a c1-host save under the release's own
context and rebuilds wrong ids (dev reinstalls only; no app is released).

Loading (`store.ts:95`) rebuilds the world from the release's cartridge under the pinned
`world_context_id`, or from the release's own fresh world when the pin has none (a save from
before c1-host), plus the rows: the head restores the saved RNG ([10 §31](../archive/spec/10-mobile-commerce-release.md)),
so a reopen replays the same luck. A `world_context_id` that is not a WorldContextId is
`save_corrupt`. Only sections with rows exist, so the state hash matches a headless run
(`smoke.test.ts`, the Gate R6 reference). Opted recovery player-body rows are required
and checked at this load boundary against the saved clock and the player's saved/default
position, using [resource@1's row contract](mechanics.md#resource1-kerneltssrcmechanicsresourcets).
Missing rows, malformed value/time/rate/remainder, full pools with fractional credit,
or an authored rate that disagrees with that position are `save_corrupt`; storage is
not repaired or rewritten. Reconciled adoption calls the same load path, before adopting
any committed candidate into memory. The existing no-read-open-transaction fence and
unknown-COMMIT handling remain required. Opted metadata is JSON in existing changed
rows and needs no format beyond the reviewed `loka-save-v2` elapsed format.

Explicit NPC HP overrides also require their exact legacy-shaped rows on load, validated
against each entity's pinned effective bounds and saved clock, as specified in
[resource@1](mechanics.md#resource1-kerneltssrcmechanicsresourcets). Missing or malformed rows
are `save_corrupt`, without fallback repair. Reopen derives the immutable spec map from
the pinned cartridge and context before loading rows; reconciled adoption uses this same
validation. HP writes persist complete resulting row JSON through the existing changed-row
transaction with head and receipt; no new table, save format or migration is introduced.


An app update that reopens an old save writes a new
trace segment header, its kernel version differing ([ADR-075](../archive/decisions/adr-075-observability-proposal.md) §4 amendment R6 S2).

## New game

`newGame` (`authority.ts:219`): after settling any fenced attempt, one transaction replaces the
save with a fresh world of the newest release at revision 0 under a new lineage and run (no
parent) pinned to it, with its own drawn world context and seed as in a new save, drops every receipt (old invocation ids are new again) and recreates the `save`
and `head` tables whatever shape a corrupt save left them in; `report` rows and the trace stay
(`start_over.test.ts` "an intact report table survives Start over in place"). If SQLite reports
the file, or the report table or its index, corrupt, `replace` throws (`store.ts:165`) and the
host's Start over deletes the whole file (`mobile/authority/local-story/session.ts:279`), so pending reports and the trace are
lost (`start_over.test.ts` "a corrupt … page: Start over gives a working save"; a PM decision in
the [R6P plan](../archive/decisions/owner-decision-r6p-plan-2026-10-01.md); index-only damage is carried
to R12, [ROADMAP](../ROADMAP.md#slices) SM2 row, P4A-2). Memory adopts only after the commit; an
unknown COMMIT fences like an invocation's. The host confirms with the player first.

## Narration on reopen

The latest committed narration is read from the receipts, never memory, so a crash before
display shows it again; no acknowledgement is stored (`save.ts:86`;
`start_over.test.ts` "the latest committed narration is read again on reopen, from the
receipts").

## Story points

An accepted decision's `story_point_reached` events become pending `report` rows committed
with the decision, each with a host id, the run, lineage, release and the run's binding
(`delivery.ts:96`); a replay adds none; a malformed report throws before anything is stored.
`deliver(db, submit, limit)` (`progress.ts:22`) sends pending reports with a binding (a
guest's wait), least tried first; the answer must be a StoryPointAcceptance of this report for
this account; `accepted` or `rejected` with a matching payload digest is stored as itself, else
`needs_attention`; an unreachable platform leaves the rest pending; an acknowledgement that
does not commit stops the batch. Tests: `story_points.test.ts`.

## The game trace

ADR-075 §4, derived, never authority (`trace.ts:1`): a `trace.run` header per run (ordinal 0)
and one `trace.command` entry per committed command (decision compacted to outcome, delta
digest and RNG state; the commit outcome and committed events), written after the gameplay
transaction in its own; a write failure is swallowed and caught up later from the receipts
(`:120`). Cap 5000 rows (`:77`): the oldest whole runs other than the current one are deleted;
a run alone at the cap writes no more and keeps its replayable prefix. `observation` keeps the
newest 1000 records (`:73`): `evaluation.budget_exceeded` (`save.ts:146`) and, when the
host supplies a clock, each NEW decision's `kernel.decision_latency` (`mobile/authority/local-story/invocation.ts:137`).

## The session controller and the phone

`session.ts` and `mobile/app/book/presenter.ts` are the controller under the book UI: the GameView, its text, the offered actions
as buttons carrying the view token they were drawn from, and a log of the last 200 lines
(`presenter.ts:145`); a press that throws is retried unchanged by the next press (`presenter.ts:153`, 03 §14). The host gives
`kernel_version` and the random source: the app passes expo-crypto's `getRandomValues` and
`loka-kernel@<commit>`, the commit stamped by `mobile/app/metro.config.js` when Metro starts, with
`-dirty` when the tree had changes ([ADR-075](../archive/decisions/adr-075-observability-proposal.md) §3, a dirty tree is never the bare commit) and always
in a development build (its bundle can change after the stamp); with no stamp, the all-zero
commit `-dirty`. CI checks the exported bundles of a clean tree carry the bare commit, not `-dirty`
(`.github/workflows/mobile-bundle.yml`). The stamp keys Metro's transform cache, so a cached
bundle never keeps an older one. Refusal and
outcome words live in `mobile/app/book/words.ts`
([owner rule](owner-rules.md#architecture-and-engine)).

## Planned combat/death persistence (M4/M5)

**Planned until M5/M6 implementation.** The [planned first encounter](../spec/conformance/first-encounter.md#actual-foundation-gaps-to-resolve-in-m5) requires entity-specific NPC HP and saved dynamic corpse identity/initial custody before lethal combat. M5 must extend changed-row adoption/save/reopen atomically with receipts and reconcile uncertain commits before input; a transient World.entities mutation is insufficient. Final fields/operation syntax are not frozen or implemented by M4-A.

## M1-A trusted elapsed receipts

The open authority also exposes trusted `elapsed({expected_run_id, from, until})` and `runId()`, for an authority driver, never a player invocation. No timer or anchor storage is installed in A. After settling the existing fence, compare expected_run_id with the current durable save run before receipt lookup: mismatch returns `stale_view` without writes.

For a matching run, build its actor/world-bound elapsed Command and deterministic domain CommandId. That UUID is the receipt invocation key in the existing save scope. `loka-elapsed-intent-v1` hashes the full canonical Command. Matching receipt/version/digest validates and replays the original response/revision before current-clock admission; altered or malformed stored receipts conflict. Malformed JSON in a stored command or response returns `conflict`; only JSON `SyntaxError` is classified this way, while genuine SQLite read failures remain storage errors. The existing receipt-integrity limitation remains in [known differences](DIFFERENCES.md). A new command passes `stepElapsed`, then the same changed-row/receipt transaction, adoption, reports and trace. Faults have no receipt; failed/unknown COMMIT keeps existing rollback/fence/reconcile behavior for both trusted and player delivery. New-game replacement keeps old callbacks stale even if the release template world context is reused. See [contract decision](../decisions/pm-decision-m1-a-elapsed-contract-2026-10-04.md).

## Durable elapsed sessions

[B1 adoption](../decisions/pm-decision-m1-b1-durable-elapsed-2026-10-04.md).
The local session requires wall/monotonic sampling for an elapsed profile. A STRICT singleton
`elapsed` checkpoint stores run, accounted wall milliseconds, remainder in 0..999 and target
at least confirmed head; debt is derived. Driver-managed saves use v2, legacy play-time v1. Low-level explicit-target authority
conformance may remain v1 without OS clocks. An explicit trusted v2 advance raises its target
atomically to at least the accepted head, preserving wall/remainder.
A same-pin elapsed v1 upgrade initializes at its saved clock without prior credit. Missing
pins stay refused; no save is retargeted. A managed elapsed session without clock functions refuses
`elapsed_clock_missing`, before writing an invented anchor. Missing/malformed v2 checkpoints are corrupt.

Accounting uses exact checked integer arithmetic, retaining fractions and existing target debt.
Active monotonic samples are floored absolute milliseconds; resume credits positive wall gaps
once and durably rebases negative gaps without rewind. Each captured horizon settles at the
earliest pending job boundary, yielding after 16 commits. Already-due jobs/faults surface
recovery and retain debt. Sampling never extends a reserved input’s finite horizon.

The existing managed resume pulse arms a private driver obligation synchronously before a
retained player attempt can consume that call. Arming samples no clock or storage. A new
reservation keeps receipt/identity/freshness preflight before sampling; after prerequisite
candidate settlement it captures resume wall evidence while that obligation remains, otherwise
active evidence. Consume the obligation only on actual resume candidate capture, retaining that
exact evidence through uncertainty. Reconciling an older candidate never consumes it.
When a prerequisite candidate/horizon consumes the turn, the new reservation stays unresolved
until its own horizon is captured; it cannot adopt the old horizon as its fixed target. Each
host turn still commits at most sixteen elapsed segments. An admitted A keeps its original
identity/horizon while resume remains outstanding; a different B cannot steal it.

Each accepted segment atomically saves checkpoint/head/changed rows/receipt before adoption.
Fraction-only accounting, initialization and wall rebases use metadata-only transactions:
no command, receipt, revision or trace. These run only after gameplay fences settle. Unknown
outcomes fence input/time; closed-transaction exact prior/candidate plus run witnesses resolve
metadata outcomes. Reconciliation reloads checkpoint and world together; no failed candidate
is resampled. New-game replacement cancels the old run’s driver/reservation.

A current input replays receipts before sampling and checks initial freshness, then privately
retains its identified intent/digest/run. Once its horizon settles, resolution uses the same
targets against confirmed state without checking its own prerequisite revisions as stale.
Preexisting stale input still refuses. Departed speaker answers refuse presence while existing
actor-owned continuation close remains valid. The session retains one attempt until terminal
completion; catching_up is distinct from pending unknown COMMIT. The retained session intent
is a private bounded snapshot. Different identified intent during catching_up conflicts without
releasing it; unknown-save pending retains the existing original-attempt retry behavior
([shared boundary](book-ui.md#shared-elapsed-statuscompletion-boundary)).

Supported local elapsed replay follows the [trusted replay contract](protocol.md#trusted-local-elapsed-replay).

Both gameplay and administrative reconciliation check durable run before receipt access.
After a transaction is proved closed, malformed/missing/unexpected same-run checkpoint
evidence, including missing elapsed-table columns, is terminal host `save_corrupt`, not permanent
pending. The managed Game pauses
clock/input continuation, retains the last confirmed projection as blocked, surfaces typed
recovery status/reply, and permits only explicitly confirmed Start over after closing the
transaction. Low-level explicit authority entry may propagate the one local typed recovery
error. Actual SQLite read/rollback failures retain pending/unknown semantics. A valid different
durable run invalidates the old session as stale/replaced; it never corrupts or overwrites
that replacement or accesses its receipts through the old continuation.

An elapsed session or refused opening binds explicit Start over to its observed durable header:
retain the original format/run-id scalar witness and distinguish no row from a row, without
inventing a valid run id. After transaction closure is proved, re-read that witness before any
destructive recovery. An unchanged witness permits recovery of that same refused save; a newly
present valid differing run returns `stale_view` and stays intact. A changed malformed witness
returns `save_corrupt` without writing: reopen to obtain a fresh recovery offer. Header read or
rollback failure remains `pending`; the old authorization never silently adopts a new witness.
This guard applies to elapsed saves and preserves explicit v1 authority behavior.

A loaded managed elapsed session binds its valid known run even while upgrading v1 before
its first checkpoint. That run comparison permits its own v1→v2 format transition; refused
openings instead use the raw header witness above. Explicit v1 authority without clocks keeps
its existing behavior.

Round-two recovery clarification: genuinely proven SQLite NOTADB/page corruption during opening
is distinct from an operational header-read error. No loaded metadata or header/run witness is
invented for that refusal. Explicit Start over first proves transaction closure. If SQLite still
proves the file corrupt, the existing confirmed host file-removal path applies; failed closure or
operational reads remain pending. If the header has become readable, the old corrupt-file offer
cannot destructively recover it or silently adopt a new witness: a valid supported run is stale,
a malformed header is corrupt, and a newer unsupported format stays refused, all without writes.

Loaded managed recovery accepts only its unchanged supported format or its own v1→v2 upgrade
under the same known run. Arbitrary same-run format drift does not grant replacement permission:
a higher loka-save-vN returns unsupported_save_format without writes/new game; malformed drift
returns save_corrupt. For changed refused-opening witnesses, malformed format is classified
before valid differing run/pin; a valid differing supported run remains stale. This is a bounded
recovery-header check, not a general save validator. Explicit v1 authority behavior stays intact.

## Created corpse rows (M5-B)

State `created` identity rows and containment use the existing changed-row transaction
with head, RNG and receipt. No corpse table or separate commit exists. Receipt replay
allocates nothing; subsequent genuine fatal occurrences preserve previous corpses.
Load/reconciliation validates identity shape, pinned corpse template, known victim and
owner, ID collisions, room custody and reachable acyclic custody before hydrating derived
entities. Invalid rows are `save_corrupt`, without repairs or skipped possessions.
Forced death custody does not apply a voluntary carrying ceiling. Unknown COMMIT
continues fencing input and elapsed work until the existing reconciliation confirms
all prior or all next rows. The exact release pin refuses a missing or mismatched release;
this addition uses existing save-v2 rows without a format bump or old-save migration.

## Live encounter persistence (M6-A)

Encounter rows and combat job binding/cancellation commit in the existing changed-row
transaction with HP, RNG, corpse identities/custody, credit facts, head and receipt.
Reopen validates participants, authored profile/room, round/current job relationship
and row shape before exposing play. A saved open encounter resumes its saved due time
and initiative. A living NPC may have lawfully left the encounter room through its daily
schedule while the current combat job remains pending. Reopen accepts that intermediate
state when the NPC is in a valid room; the player body must still occupy the encounter room.
The due round revalidates presence and closes the encounter without attacks or RNG when
the NPC remains absent. Closed/cancelled occurrences cannot attack after reopen. Unknown COMMIT
fences both input and elapsed work until complete prior/next state is reconciled;
replay allocates and credits nothing. This uses save-v2 without a table/format migration;
exact release-pin refusal prevents opening a mismatched save, without promising old development
save compatibility.


## Bound message return recovery

Non-riddle receive and hand_over narration recovers its original speaker from the
committed Choose command and retained bound row, with matching choice/outcome, original
item transfer, fact consequences and quest resolution when declared. Unrelated latest
receipts cannot supply authority. Load validates retained role identities and the branch
and terminal evidence against authored definitions: malformed rows, impossible custody,
or stays terminal status without the original message directly with the terminal NPC are
`save_corrupt`. Legal ground, held-container and corpse custody before turn-in remain
valid. No repair, transcript or save table is added; rollback and either unknown-COMMIT
outcome retain the existing confirmed-disk adoption fence.


## Escort and alternate return recovery

The existing state_row table persists actor-keyed escorts through the ordinary changed-row
transaction. Load validates each typed row against its actor/body, original start ChoiceRow
and quest instance, original living NPC and physical state. Following requires co-location;
separated permits player departure or later co-location before explicit Rejoin. Completed
requires the proven rescued terminal and NPC beside the terminal speaker. Every committed
intermediate state must reopen and reconcile under the same boundary.

## Bell-first return recovery

In the Q3-B release, load checks the retained bell, allegiance, Q3 terminal and
scene line together. An accepted Q3 requires its eligible Q2 row, even before Ring.
The scene line must be an integer in the compiler-generated scene fact bounds.
Resolved Q3/prior requires a committed Ring receipt whose stored command identity,
full fact references and scopes, Q3 transition, and resolved event quest/actor/cause
match that actor's save. The receipt must assign the bell and allegiance, resolve
that actor's Q3 instance and start the bell scene. A failed Q2/lost additionally requires the same Ring receipt to
fail that Q2 instance and assign lost child status; Wren's accepted meeting,
return selection and escort must be absent. A completed stays/rescued Q2 or an
active Q2 after the accepted Wren meeting remains legal after Ring. Missing or
contradictory quest rows, facts, scene state or receipt are `save_corrupt`, with
the existing Start over path and no silent repair. The saved Ring receipt and
every scene continuation use the existing changed-row transaction and unknown
COMMIT fence.

Bound return validation admits mutually exclusive alternatives: no branch keeps the message
with its original source; stays requires its original receive and optional stays handoff;
rescue keeps the message with the original source and requires its original escort path.
Branch, quest outcome, status, escort and own committed receipts must agree. The forged
terminal refusal applies before either selection. Missing/swapped/malformed roles or escort
rows, cross-branch evidence and impossible locations are typed save_corrupt without repair.
Own committed start/Rejoin/terminal receipts validate escort effects and derive original NPC
narration. The latest committed escort transition must match the stored relation; separated
requires the fatal transition's death event and player-body transfer. Unrelated latest
receipts and current room never prove success. Existing rollback,
unknown-COMMIT fence, exact retries and explicit old-pin refusal remain unchanged.
