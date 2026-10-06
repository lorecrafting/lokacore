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

## Bell choice return recovery

In the Q3-B release, load checks the retained bell, allegiance, Q3 terminal and
scene line together. An accepted Q3 requires its eligible Q2 row, even before Ring.
Each bell scene line must be an integer in its compiler-generated scene fact bounds.
Resolved Q3/prior requires a committed Ring receipt whose stored command identity,
full fact references and scopes, Q3 transition, and resolved event quest/actor/cause
match that actor's save. The receipt must assign the bell and allegiance, resolve
that actor's Q3 instance and start the `bell_rung` scene. A failed Q2/lost additionally requires the same Ring receipt to
fail that Q2 instance and assign lost child status; Wren's accepted meeting,
return selection and escort must be absent. A completed stays/rescued Q2 or an
active Q2 after the accepted Wren meeting remains legal after Ring. A retained
Q2/lost transition against a current non-lost Q2 row is contradictory.

The Q3-F release extends this check for a silent bell. Resolved Q3/fox requires resolved
Q2/rescued or Q2/stays with the corresponding retained child status, bell false,
allegiance fox, `scene_bell_rung` still 0 and `scene_bell_silenced` started or
ended. Its own committed Silence receipt must identify the actor, exact Belfry
bell detail and action, assign player-scope allegiance unknown → fox, resolve
that actor's Q3/fox from the fact-change consequence and start
`scene_bell_silenced` from the matching quest-resolved event. It may not change
Q2, child status or bell, or emit a story point. The original Q2 terminal
evidence remains required; a forged Q2 row does not become valid through a
Silence receipt. Before either choice, both scene facts are 0; after Ring, the
silent scene fact stays 0. A retained opposing scene, changed bell or allegiance,
or a Q3 outcome inconsistent with its causal receipt is contradictory. An exact
receipt replay cannot start a second scene or reverse the terminal choice.
Missing or
contradictory quest rows, facts, scene state or receipt are `save_corrupt`, with
the existing Start over path and no silent repair. Both choice receipts and
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

## Green finale recovery (planned A3)

The five [Green outcomes](cartridge.md#a3-green-finale-planned) extend the same
receipt-backed return proof. A begun epilogue requires its own committed Begin
receipt with the selected recipe, actor at Green and exact `market_cross` event
subject; an unrelated action cannot evidence its scene start. Load admits every
lawful intermediate: terminal Q2/Q3,
acknowledged bell, eligible Green, begun epilogue at each shown line, acknowledged
end with one pending or later delivered report. It rejects lost/fox, mismatched
bell/allegiance or scene pair, two active epilogues, unacknowledged bell with begun
epilogue, and any early or inconsistent completion memory, marker or report. A final
marker must agree with the ended scene, three memories, exact pair and outcome;
the original Q2/Q3 evidence remains required. Contradictions use typed
`save_corrupt` and Start over, never silent repair.

Only an accepted bound final Continue produces the three player memory assignments,
reserved story-point marker and `story_point_reached` event. Changed rows, scene end,
marker, report and receipt commit in one transaction before memory adoption and UI
confirmation. Exact replay keeps its original receipt and cannot allocate a second
report. Failed or uncertain COMMIT follows the existing fence and reconciliation;
uncommitted effects never present as completion. Offline delivery leaves the one
report pending and does not undo completion. Reopen observes saved state and never
starts the epilogue by itself.

## Selected S2 recovery (pending implementation)

The B2 S2 occurrence, bound actor/Peg/Aldric/ledger, expiry job and any explicit
participating penny rows are saved as ordinary changed rows with the same receipt as
their accepted decision. Reopen validates the original IDs against the pinned release,
quest terminal state against `priory.tithe_delivered`, the pending/cancelled job against
the occurrence, exact participating balances and a retained choice/receipt against
its actual transfer and outcome. A missing, malformed or contradictory row refuses
as `save_corrupt` without guessed repair. Unknown COMMIT stays fenced; receipt replay
cannot duplicate the ledger, payout or penalty. The deadline keeps running through
death and reopen. See the [selected S2 mechanic](mechanics.md#s2-chandlers-debt-selected-contract-pending-implementation).
This is a selected next-release recovery rule, not a claim about current saves.

## B3 shop recovery

The selected [B3 exchange](mechanics.md#pegs-immediate-shop-b3-selected-contract)
changes the exact item's containment row and both penny rows with one receipt.
Failed or unknown COMMIT follows the existing fence and reconciliation path. Reopen
validates the offered item identity, current custody and participating balances;
it does not rebuild stock from an independent count or mint a missing shelf item.

B3 extends B2's S2 balance/receipt validator, including its unaccepted, active,
resolved and expired branches. For pennies in this chapter, reconcile the actual
accepted B3 exchanges and the optional S2 payout in saved revision order from the
authored player, Peg and Aldric starts. Each receipt's exact debit/credit must match
the balances at *that commit*, its bound participants, price or payout and item/
quest outcome; the final replayed balances must match the current saved rows.
An S2 payout receipt may therefore begin after a Buy or end before a later Buy.
Do not compare its historical `from`/`to` directly with current balances, or
require a player still to hold the authored start or start-plus-reward. Reject
missing, reordered, forged or unexplained transfers, wrong recipients and
contradictory custody/outcome evidence as `save_corrupt`. Use the existing receipt
and changed-row trust boundary, not a second money ledger or save migration.
Receipt replay cannot pay or move the item again; malformed current-build truth
leaves the save intact.

## C1 learned-skill and lesson recovery

**API1.18 recovery contract.** [C1 acquisition](mechanics.md#c1-training-and-armed-defense-selected-contract)
uses changed fact, resource, containment and choice rows with the same head/receipt
transaction. No table or save-format change is required. Derive current qualification
again from the pinned cartridge policy on every open/use; do not save or repair it.
Cold reopen must accept every legal state after Talk, each lesson, Wear/Remove,
Attack, defended round, opponent death, player death and possession recovery.

Extend [B3's revision-ordered balance recovery](#b3-shop-recovery) with Tobin's
authored penny start and accepted lesson payments. Validate each historical payment
at its own revision, its exact bound teacher, skill/choice and amount, and both
debit/credit; subsequent commerce/S2/other accepted transfers may change current
balances. Validate each true acquired fact against exactly one accepted typed grant
for that character/declared skill, binding command, continuation, source dialogue,
choice, roles, root cause and consequence. The swords grant proves its exact
incoming item identity at that commit; lawful later Wear/Drop/Give/death custody
must not be compared to the original body-held destination. Ordinary current custody
validation still applies. False/omitted membership is legal only without a successful
acquisition receipt; reject contradictory receipts or missing acquired rows.

Null/non-Boolean facts, wrong skill/actor/teacher identities, duplicate successful
grants, forged payment or gift evidence, unexplained balances, or a defense event
inconsistent with its hit/loss produce typed `save_corrupt`, leaving the file intact.
Closed/replaced encounter jobs remain harmless after reopen. Do not cache weapon
or defense eligibility in an encounter: the later due consumer re-reads saved custody,
membership, qualification, life and posture.

Real failed COMMIT and both uncertain-COMMIT outcomes prove all prior or all next
cost/membership/custody/choice/HP/RNG/job/head/receipt state. Fence input and elapsed
work until reconciliation. Lost acknowledgement and exact receipt replay charge,
grant, draw and narrate no second time. Existing pin refusal and explicit confirmed
Start over remain; C1 supplies no old-save migration or silent deletion.

## B5 stock and repeat recovery

[B5](mechanics.md#s9-infirmary-herbs-b5-selected-contract) stores ordinary authored
item custody, the latest bound S9 occurrence and its bounded contribution fact.
Stock is derived from custody; there is no persisted harvest count or reward mint.
Every changed custody/fact/quest/choice row and its receipt use the existing single
transaction, failed-COMMIT fence and unknown-COMMIT reconciliation. Exact retry
returns the committed result without transferring stock or adjusting faction again.

Reopen accepts lawful empty patches, partial harvests, storage/drop/death custody,
active S9 with temporarily missing herbs, every resolved occurrence and the next
explicitly accepted occurrence. Validate exact eligible/reward identity sets,
latest actor/Wick binding and occurrence transitions, distinct exchange IDs,
receipt-bound transfers and actual S9 contribution. Reconcile S9 contributions
and B2/unrelated lawful faction adjustments at their own saved revision; do not
compare an old faction result or item holder with only today's rows. Ordinary
Take/Drop/Put/Give/death transfers can lawfully change post-exchange custody and
must not be classified as corruption. The actual current rows must agree with the
receipt-evidenced sequence; a resolved exchange requires its whole transfer and
quest evidence, and an old completion cannot justify a later active occurrence.

Malformed/out-of-range contribution, reused occurrence, missing/duplicate item,
forged transfer or contradictory current rows yields typed save_corrupt without
repair or deletion. B3's penny/S2 reconciliation remains intact: S9 never changes
pennies. Lost acknowledgement, both uncertain COMMIT outcomes and reopen must
produce all prior or all next truth. No migration, save reset, fresh replacement
item or receipt-derived second ledger is introduced.

For API1.17 explicit repeats, a committed `quest.retire` removes the prior
resolved quest row in the same changed-row transaction as the new activation.
Only that typed operation deletes a row; receipts retain prior occurrence proof.

## B4 fuel and dark recovery

[B4 fuel](protocol.md#b4-fuel-composition) rows initialize once from the
pinned current release (authored charge, unlit, at the fresh-world clock), then
persist independently of custody. Source/supply
changes and their bound receipt commit together before memory adoption or success
narration. The loader validates required exact authored instance rows, safe bounded
charge, valid source/supply binding, boolean lit, supply unlit and timestamps not
later than the saved clock. Missing/wrong-item rows, charge overflow or impossible
metadata yield typed `save_corrupt` without repair, refill, deletion or repinning.
A stored lit source whose confirmed fuel has exhausted is lawful; its effective
state is unlit, and reopening does not restart its interval.

Reconcile accepted fuel-changing receipts in saved revision/clock order from the
authored initial rows, binding command ID, actor, exact source/supply IDs and their
historical custody. Each full prior row and settled replacement must match that
command's burn/ignite/douse/refill semantics; the resulting stored rows must match
the current save. Reject a missing debit, fabricated refill, wrong participant,
reordered receipt or unexplained bounded charge as `save_corrupt`. Read historical
fuel at its commit, not at today's clock; time/custody receipts do not refill rows.
Reuse the existing accepted-receipt replay through the kernel's pure fuel transition
at this trust boundary. Its activation includes a declared fuel source or supply,
including cartridges without a repeated exchange. No second replay writer or
additional event ledger is created.

Real SQLite proof covers fresh/unlit, lit, doused, partially refueled, exhausted,
sold/bought-back, nested and corpse-held states. Failed COMMIT retains all prior
rows; both unknown-COMMIT branches reconcile all prior or all next rows, including
supply debit. Lost acknowledgement and exact receipt retry never consume oil or
fuel twice. B3/S2 receipt and balance reconciliation remains intact.

Prove a real controlled lethal combat occurrence in an opted dark room with the
only light and a nested bag among the actual corpse roots. Reopen before recovery,
walk the shrine's equipment-free route, inspect only the owned corpse and Take the
same roots/descendants through existing carrying and lid checks. Repeated death
retains previous corpses and exact fuel custody. This is fixture-driven combat,
not a new production Well Shaft danger or public death command. Keep the existing
production cellar recovery proof green; darkness adds no dependency on lost gear.

## B7 liquid recovery

**Selected, pending implementation.** [B7](mechanics.md#b7-well-and-waterskin-selected-contract)
uses the existing state_row transaction for exact vessel liquid rows, head and
receipt. No liquid table, second ledger, save-format migration or automatic
refill/reset is added. Initialize empty rows only when creating the pinned fresh
world. Every opted authored instance requires its row even while ground, nested,
Peg-held, sold back or corpse-held. Load rejects missing/extra/wrong-item rows,
unknown kinds, noninteger/negative/over-capacity quantities and null/positive
mismatch as typed `save_corrupt`, keeping the file intact.

Bounded revision-ordered validation starts from authored initial rows and checks
each accepted liquid-changing receipt's exact command ID, actor, source/vessel
identities, historical custody and full prior/replacement quantities. Fill must
prove the declared current-room source, compatible free capacity and resulting
carrying admission at that commit; Pour must prove eligible custody and both
equal debit/credit; Drink must prove the exact kind and serving debit. Reuse pure
transition validation, not a second gameplay writer. Ordinary transfers preserve
liquid and may lawfully change historical holders. The final validated quantities
must agree with current saved rows; an unrelated latest receipt or merely
bounded current quantity is not provenance. Preserve B3/S2 penny reconciliation
and any merged B4/C1/B5 consumers without imposing today's custody on their old
receipts. Do not invent receipt fields; extend the actual bounded verifier as
needed to reconstruct relevant historical rows.

Real failed COMMIT retains all prior liquid/custody/head/receipt state. Both
uncertain-COMMIT branches fence input and elapsed work until reconciliation proves
all prior or all next truth. No committed Fill/Pour/Drink is narrated before
adoption. Lost acknowledgement and exact receipt replay return the original
result without another Fill, debit, item allocation or benefit. Real SQLite
reopen covers fresh, filled, partially poured, drunk-empty, nested, sold/bought
back and death/recovered states; explicit release mismatch refusal and Start
over authorization remain unchanged. Unknown successor pins stay unknown until
the final integration release is compiled and independently re-pinned.
## C2 patrol attempt recovery

**Local source implemented; independent review pending.** The [typed patrol](mechanics.md#s3-finite-watch-patrol-c2-selected-contract)
uses existing changed-row state storage and receipts. Load/reconcile validate its
original actor/body/Tobin, exact S3 instance/activation choice, attempt start or
restart command identity, bounded route cursor/status/credit and revision-ordered
transition evidence. Each credited checkpoint must trace to that attempt's accepted
player movement, expected edge and co-present original leader; the leader's own
entry alone is insufficient. Rejoin never retroactively supplies missing entry proof.

Together requires co-location; awaiting permits leader at the cursor destination
and player at the preceding source. Paused/failed permit lawful later player travel,
including co-location before explicit recovery. Leader stays at the saved route
cursor in all states. Completed requires all four proven distinct entries, S3's
own resolved `completed` receipt and matching reserved trust. Historical final
co-location must not reject later player travel, gear loss, lesson payments or death.
No patrol row exists before activation; failed attempts keep S3 active and credit
empty, with a same-body fatal event/return receipt. Restart has its own new attempt
identity and cannot reuse historical credit. Completed trust and retained rows must
agree in both directions; current co-location/trust is never terminal proof.

Cold reopen each boundary: start, leader ahead/player behind, joined checkpoint,
pause, arrival before Rejoin, failed death, player return, Restart and completion.
Cross-check full definition refs/scopes, choice/command IDs, event cause/correlation,
transfer source/destination and complete prior/result rows. Malformed/missing rows,
unknown or duplicate credit, impossible cursor/location, swapped leader/actor/quest,
forged terminal or old-attempt credit return typed `save_corrupt` without repair or
file rewriting. Existing storage-error and pin-mismatch distinctions remain.

Failed COMMIT, unknown-not-committed, unknown-committed and lost acknowledgement
prove all-old/all-new movement/attempt/quest/trust/head/receipt. Exact receipt retry
moves, credits, restarts and rewards nothing twice. Reconcile lawful intermediate
states with the later consumer, including concurrent Wren following/separation;
no new snapshot, periodic checkpoint, migration or receipt ledger is introduced.

## B6 discovery, sitting and ward recovery

[B6](mechanics.md#s4-all-hours-wisp-b6-selected-contract) retains discovery,
S4 state and topic knowledge in ordinary typed player facts/quest rows; only an
opted riddle adds its typed continuation count. Persist changed rows and receipt
atomically. Cold reopen at zero/one/two mistakes restores the exact continuation,
opening revision, actor, original wisp, dialogue/choice/quest references and count;
exact-selector Talk receipts must justify the selected dialogue source;
a third mistake restores a closed sitting and immediate Ask again, never an active
count-at-limit pending row. Unsent tiles are not saved. After correct answer,
restore resolved S4, both narrative truth and known ward, and the original bound
success line once; repeated receipt replay adds no grants or attempts.

Validate each attempt at its historical revision against its source, answer-bank
validity, exact prior count, actor, participants, causal command/receipt and closure
or resolution, then reconcile with current rows. Close/death/current light changes
cannot retroactively invalidate a lawful historical answer. Discovery requires
successful owned Seek evidence; wrong/malformed answers justify no answered fact
or ward grant. Reconcile topic truth with actual declared grants, including an
already-known ward, rather than assume S4 is its only possible future source.
Missing/null/corrupt bounded counts or bindings, forged wrong receipts, unjustified
facts and pending-at-limit states refuse `save_corrupt` without repair/deletion.
No defaulting a missing counter to zero on load.

Light changes, location changes and death may make the pending answer unavailable;
Close stays usable. Death preserves discovery, knowledge and active/resolved S4;
after ordinary same-body recovery, Close if needed and Talk to the same reachable
wisp immediately. This adds no item requirement or new danger. From the shrine,
all new walking routes and the owned-corpse exception remain gear-free. Failed
COMMIT, both uncertain-COMMIT outcomes and lost acknowledgement retain the existing
fence/reconciliation rules; prove them with real SQLite at attempt, final wrong
and correct transitions. Current-release mismatch remains explicit; no adapters,
silent counter repair or save deletion is authorized.

## C3 living population recovery

[C3 composition](protocol.md#c3-spawned-bundles-and-population-composition)
saves immutable spawned identities, containment, HP, separately keyed slot rows
and plan control/current job, RNG, encounter/death changes, head and receipt through
the existing changed-row
transaction. Genesis binds the same checked initialization to revision0; later
origins bind their exact accepted creation command/job occurrence. No loader
reconciliation spawns an animal, heals HP, replaces an identity or repairs a slot.

Validate full pinned plan/bundle/template refs, slot/generation/member/role and
creation occurrence, paired initial parent, actual HP rows and current job/due
binding. Require exactly the declared ordinal slot keys; control stores no duplicate
membership index. A fatal receipt changes only its bound slot, while a plan-job
receipt advances control and actual birth/replacement slots. Equal-time combined
receipts keep their canonical job-ID order and distinct writer groups; cold reopen
and uncertain-COMMIT reconciliation accept both legal orders with the same conserved
fatal slot/corpse/pelt and one current plan successor. No-op rewrites of other slots
are not valid transition evidence. Later ordinary pelt custody may be its hound,
public corpse, room, player, bag or other legal owner; validate revision-ordered transfer/death evidence rather
than requiring its original parent forever. Old HP0 hound identities remain valid
corpse victims after their slot advances. A due time must trace to that member's
positive-to-zero fatal event at fatal clock + declared delay. Fresh/never-used,
living and replacement-eligible slots have the mechanics' distinct row shapes.

Require matching causal command IDs, full refs/scopes, writer groups, event cause/
correlation and complete prior/result slot rows for creation, fatal eligibility
and replacement. Reopen accepts every lawful complete intermediate state, including
live members in either area room, partially injured or engaged members, retained
dawn surplus, dead slots before/at due and old pelts already taken after replacement.
Invalid/missing HP, orphan bundle, swapped plan/parent/generation, impossible member
or job/receipt proof is typed `save_corrupt`, with no rewriting or skipped rows.

Real failed COMMIT, unknown-not-committed, unknown-committed and lost acknowledgement
must reconcile all-prior/all-next identities, slot/generation/due, custody, HP,
RNG, jobs, encounters, head and receipt. Fence input and elapsed until resolved;
receipt replay allocates/transfers/schedules nothing twice. Exact unavailable or
mismatched release pins refuse explicitly; only explicit Start over replaces the
save. No save migration, periodic checkpoint or second population receipt ledger
is selected. Browser reload/Book evidence is distinct from real SQLite faults.

## C4 pack and flight recovery

**Selected, pending implementation.** [C4](protocol.md#c4-pack-encounter-and-flight-composition)
persists the encounter's exact active roster/primary/cursor/job, selected attacks,
HP/RNG/death, enemy movement and per-slot last-flight clock with ordinary changed
rows, head and receipt in one transaction. Reopen validates current pin, complete
prior/result transitions and causal Attack/run_job/flight/death evidence; replay
never re-admits helpers, rotates again, transfers a pelt or rolls again.

Validate bounded unique same-plan current-generation IDs, original attacked
primary/admission evidence, current primary/cursor membership and exact current
job/round/due relation. Bind flight to the selected living hound, actual departure
room/legal edge, threshold, slot generation and occurrence clock; later legitimate
wandering, death, replacement and pelt Take do not invalidate historical flight.
`last_flight_at` is null or a proven flight clock not greater than the saved clock,
not a freely forgeable timestamp. Old HP0 victims remain valid historical corpse
identities after C3 replacement; no loader heals, moves, deletes or repairs them.

Accept lawful partial states after Attack, each helper's turn, primary death/
reselection, successful or blocked flight, final withdrawal and whole-pack player
Flee/death. A member may lawfully be absent before a pending round through another
registered movement consumer; as in installed combat, validate its actual legal
custody and evidence rather than require historical co-presence forever. The next
round prunes it without remote attack, repairs selection and closes when empty.
Unknown/malformed membership, forged flight/primary/cursor/slot/job or missing
receipt linkage is typed `save_corrupt` without rewriting bytes.

At equal flight/population deadlines, retain and reopen either lawful allocated
job-ID order, including the same-clock wander suppression. Real failed COMMIT,
unknown-not-committed, unknown-committed and lost acknowledgement reconcile the
complete prior or next encounter, flight clock, custody, slots/control, HP/RNG,
jobs, head and receipt. Fence input and elapsed until resolved. Pin mismatch is
explicit refusal, with no silent deletion or compatibility adapter. Browser Book
reload remains separate from real SQLite transaction/fault evidence.

## D1 ferry and lesson recovery

One accepted crossing commits changed actor/Sedge penny balances when positive,
body and eligible follower custody, normal room-entry evidence, head and receipt
together before memory adoption/reply. Free return and owned-corpse recovery
crossings have no penny write. Reopen and reconciliation validate the original
endpoint/route/quote/recipient, prior/result balances, corpse ownership and
nonempty isle custody at the original accepted revision, and exact body/follower
transfer from one source room to one destination. Later corpse retrieval, death,
Wren separation or other payments cannot invalidate a valid prior crossing.
Missing charge, charge without move, extra charge, wrong-owner waiver, forged
recipient/endpoint, or fabricated room entry yields typed `save_corrupt` with
in-place Start over; no repair or silent deletion.

Sedge's free lesson uses C1's skill/dialogue receipt and reserved acquired fact
validation. A replay cannot teach twice; an unlearned or learned fact cannot be
inferred from dialogue prose. Check a real failed COMMIT and both uncertain
COMMIT branches at paid outbound, free return, recovery and lesson boundaries.
Until resolution, input remains fenced and the visible Book claims no success.
Cold-open every legal committed stage, including death at the isle and actual
owned-item recovery from the current Chapel Nave shrine route.

## B8 service recovery

**Implemented locally, publication pending.** [B8](mechanics.md#b8-mauds-immediate-services-selected-contract)
stores only changed balances, entitlement, meal stock, ale row and settled MV
plus head/receipt in the existing transaction. No service ledger/table, save
migration or reset-on-open exists. Reopen/reconciliation validates the exact
original actor/body/provider/service/quote, full refs/scopes, causal command and
prior/result rows against authored initial truth and revision-ordered receipts.
B3/S2 payment history and B7 liquid history must recognize the new service
producer without weakening their own checks. Merely plausible bounded stock,
MV or paid=true is insufficient evidence. Lawful later movement, death, elapsed
recovery and other payment producers cannot invalidate an old service receipt.

Room proof requires its unique paid transition and matching exact payment;
meal proof requires one exact stock debit/payment and independently valid capped
MV settlement; drink proof requires historical provider-owned exact vessel/kind,
complete serving debit/payment and MV settlement. Missing/extra malformed opted
rows, altered bounded stock/quantity, forged entitlement, swapped provider/service,
wrong price or omitted benefit/payment yields typed `save_corrupt`, preserving
the file. Never grant, refill, delete, heal or repin to repair a save.

Real failed COMMIT and uncertain-not-committed reopen all prior state; uncertain
committed/lost acknowledgement reopen all next state. Input and elapsed remain
fenced while unknown; exact invocation replay charges/consumes/grants nothing
again. Reopen unpaid, paid-before-Rest, meal-used, ale-partial/empty and actual
same-body death/recovered states, then invoke their next consumer. Confirmed
service narration is retained once at the original Maud detail through the
committed command identity, never inferred from an unrelated latest receipt.

## D2 book knowledge and Read recovery

Planned [D2](mechanics.md#d2-held-books-and-public-priory-selected-contract) stores
ordinary custody, schedule locations and B6 typed knowledge facts; it adds no book
cursor, transcript, topic ledger or snapshot. Reconcile a grant with the exact
historical Read command/receipt: actor/body, original item and pinned readable/topic
metadata, lawful held/open-ancestor custody at that revision, causal assignment and
prior knowledge. A lawful B6 grant also justifies ward; neither source requires the
other. Already-known Read supplies narration without a new grant. Later Drop, Put,
lid closure, travel, schedule movement or death cannot invalidate historical Read.
Current fact truth must agree with the lawful grant history in both directions.

Real SQLite reopen must accept every legal committed intermediate: ground books,
directly held, open nested holding, closed nested holding, each learned topic,
already-known reread and later stored/dropped/dead states. Reopen the novice overlap
and departure, then exercise the next ordinary Read/Talk/move consumer. Missing or
malformed topic mapping/fact, forged actor/book/source/cause, grant from unheld or
closed custody, omitted required grant or unjustified knowledge returns typed
`save_corrupt`, with existing in-place Start over and no silent repair/deletion.
Operational read failures keep their existing storage-error handling.

Failed COMMIT, both committed and absent uncertain-COMMIT outcomes, and lost
acknowledgement preserve all-prior or all-next knowledge/receipt state. Exact retry
replays the original response and grants nothing twice, including after later
custody changes. Retained Read narration routes once to that exact book detail;
restore its currently reachable parent chain only when projected, with normal
scene/chapter precedence. An unavailable book yields no invented visible route or
World/other-book narration fallback. Current-release pin refusal remains explicit.
Historical replay must also run when readable items are the only content requiring
it; the isolated gate control is traced in the
[D2-S1 review](../reviews/2026-10-05-d2-priory-books-save-second-review.md).

## B9 dream recovery

**Current consumed source; independent review pending.** The [S10 Rest/dream](mechanics.md#s10-lantern-rest-and-dream-b9-selected-contract)
uses existing fact, quest, choice and receipt tables. There is no snapshot, new
save format, dream ledger or save-on-display. First-Rest credit, S10 activation
and scene beat1 start commit together even when presentation is deferred.
Each Continue/branch writes its checkpoint/choice with its receipt.
Final end, `dream_seen=true`, S10 `resolved/acknowledged` and receipt commit in one
transaction before adoption and confirmed narration. No dream completion report
is allocated. Closing or resuming presentation never manufactures an end.

Cold reopen and reconciliation validate the exact revision-ordered chain: B8
paid entitlement/payment before the qualifying Rest; stored root Rest command,
actor/body/prior position/actual Inn Rooms, full refs/scopes and causal event;
first-Rest fact and unique S10 instance; scene start and each bound beat/choice;
final acknowledged scene end and its sole memory/quest resolution. Bounded
current facts alone do not prove history. Choice source/beat/anchor/actor,
continuation id, root cause/correlation and branch must agree with receipts;
a swapped unrelated Continue cannot justify the memory. Check evidence in both
directions so a terminal receipt cannot justify today's active S10 or vice versa.
Lawful later payment, travel, elapsed, body death/return and other modal scenes
must not invalidate original anchor/body proof. Ending preserves the chosen
branch; neither reopening nor death changes it or resets entitlement/credit.

Admit unseen/unpaid, paid-before-Rest, started/deferred, each shown narration,
pending choice, each selected final line, closed/away/combat/returned and ended
states, then exercise their next actual consumer. Wrong/null rows, impossible
cursor/branch, duplicate S10/start/end, forged paid/Rest/memory, missing/wrong
receipt event, early memory or mismatched terminal quest yield typed
`save_corrupt`, preserve the file and offer existing recovery; never silently
repair, export, delete or repin. Explicit missing-release refusal still applies.

For qualifying Rest, choice and final acknowledgement, real
failed COMMIT and unknown-not-committed reopen all old; unknown-committed/lost
reply reopen all new. Fence both input and elapsed until reconciliation. Exact
invocation replay preserves the original result and adds no credit/branch/memory.
Confirmed narration restores to the actual bed/dream nesting by committed command
identity; when away, retain honest history and Resume availability on legal return,
never an invented Inn Rooms backdrop or unconfirmed completion.

The consumed source uses the installed revision-ordered accepted-receipt replay,
already required by the real B8 entitlement producer. It introduces no second
history checker. Ordinary dialogue/finale validators select dialogue-owned
choices and leave the scene-owned row to that replay. Continue/Choose narration
recovers to the UI-only `dream:<actual bed id>` detail owner from the retained
scene binding; this is local history routing, not a saved row or invented entity.
After the ordinary chapter Continue, cold launch stays at World. Resume is offered
only at the projected safe bed, and retained history appears in its dream child.
## D4 finite food and terminal custody recovery

**D4 source recovery contract.** [D4 food](mechanics.md#d4-homes-finite-apples-and-eat-selected-contract)
persists ordinary item containment and the adjusted recovery row with the Eat
receipt in the existing changed-row transaction. The immutable consumed-holder
ID/kind is reconstructed from the current cartridge and independent allocation;
no mutable food-count or new persistence table is selected. Loader validation
admits only opted edible identities in that holder, with terminal entry justified
by the revision-ordered exact actor/item/source/destination/benefit Eat receipt.
Reconstruction rejects transfer out, forged entry, mismatched holder or benefit,
a consumed item restored into circulation, and unsupported pins as typed corruption
or explicit mismatch, without silent repair/deletion.

Narration reconstruction classifies an accepted Eat as a World result, never a
consumed-item detail. Its saved command must match the receipt command ID and
actor, typed `eaten` item, same-item body-to-consumed transfer, recovery adjustment
and that item's authored narration key at the accepted history prefix. Return the
existing narration record with this exact `command_id` and lines, omitting
`detail_id`; do not infer routing from current item presence or unrelated latest
narration. Live recovery requests the sent Eat command; ordinary cold reopen
selects the latest saved narratable receipt and preserves its validated identity.
No new history table is selected. Forged command/item/narration linkage yields
typed `save_corrupt`, not a fallback success sentence.

Prove real SQLite reopen at fresh stock, each harvest, stored/dropped/given food,
owned-corpse custody, consumed food, each NPC schedule departure and each child
variant (including following/separated escort). Exercise later actual Eat after
retrieval/reopen. A genuinely failed COMMIT leaves both custody and MV unchanged;
uncertain COMMIT must reconcile committed and absent branches. Lost acknowledgement
and same-invocation replay return one confirmed Eat, never another benefit; a new
invocation on that spent ID refuses. Preserve pending-save input refusal, exact
current-release mismatch handling and in-place explicit Start over for corruption.

## D5 route and Read recovery

[D5](mechanics.md#d5-dry-deep-fen-exploration-selected-contract) adds no state
schema or new writer. Ordinary current-room custody, original Q2 message/escort
rows and exact Read receipts remain authoritative under the new source pin.
Reopen must retain every new location, original separated Wren at its actual
location, and original message custody without granting knowledge or Q2 credit.
A failed/uncertain movement or Read COMMIT and exact invocation replay use the
existing receipt rules; no source-change migration or repair is selected.

## D6 water and owned-corpse recovery

**PM-selected contract; selected-docs review approved, implementation pending.** Accepted descent atomically
commits entry MV debit, bottom custody, occupancy generation/absolute deadline/
one due job, room-entry evidence, head and receipt before memory adopts/replies.
Ordinary resource recovery continues; no periodic MV drain is stored. Current
expiry commits positive-to-zero HP loss, drowning event, corpse roots and
same-body Chapel return together and invalidates occupancy. Surface commits
free movement/entry evidence and generation invalidation together.

Cold reopen preserves the original deadline/current occurrence and settles
trusted elapsed debt. At/past expiry, death settles before any subsequent action;
reopen never renews the deadline. Canceled jobs cannot kill a surfaced or later
re-entered body. Unknown COMMIT fences later input/elapsed delivery until the
committed or absent branch is reconciled.

Recovery receipt binds original actor/actual corpse, its eligible underwater
room location at acceptance, existing roots and their source/destination custody. Replay transfers nothing twice. Later movement or
another death cannot invalidate valid historical custody; emptied corpse remains.
Malformed occupancy/deadline/job/cause/ownership yields typed `save_corrupt` with
in-place Start over, no reset/repair/deletion. Prove cold reopen at every committed
entry/surface/expiry/recovery intermediate, genuinely failed COMMIT, uncertain
committed/absent COMMIT, lost acknowledgment and replay using real SQLite;
browser refresh is separate proof.

## D12 lesson, careful Harvest and discount recovery

**Selected, pending implementation.** [D12](mechanics.md#d12-practical-skill-consumers-selected-contract) uses C1 reserved acquired facts and dialogue choice/history, B3 participating balances and B5 ordinary item custody. Each lesson, careful Harvest or Buy commits its complete changed rows, head and one receipt before memory adoption/reply; no skill table, saved qualification, quote row, stock count or extra money ledger is introduced.

Extend revision-ordered skill/payment reconciliation for the exact original Sedge/Peg lesson bindings. Validate one typed acquisition and the exact payer debit/teacher credit at the accepted revision, including lesson choice resolution; free swim retains its independent evidence. An INT/DEX/MV-unqualified lesson acquisition is legal. Historical careful Harvest proves its method/action/target, acquired and current qualification at that settled revision, the complete selected distinct eligible room-held IDs, combined carrying admission, every transfer and matching acquisition event. Historical Buy recomputes its effective bound quote from the pinned declaration, acquired state and settled MV at that original revision, then validates conserved payment and exact item transfer. Today’s MV, balances, skill state or post-action herb/shop custody cannot invalidate lawful old evidence; the replayed resulting rows must still match current saved truth.

Cold reopen covers each legal Talk/Choose, learned-but-unqualified, careful two-item transfer, ordinary stock-one Harvest, shop exchange, storage/drop/death/recovery and later S9 state. Missing or duplicated herb transfer/event, false acquisition/payment evidence, stale or forged discounted price, unexplained balance or invalid current rows is typed `save_corrupt` with in-place Start over, leaving bytes intact. Prove real failed COMMIT, uncertain absent/committed outcomes, lost acknowledgement and same-invocation replay at all three new boundaries: all prior or all next truth, fenced input/elapsed until reconciliation, no second fee, transfer, grant or narration. Pin mismatch remains explicit refusal with no silent reset; frozen fixture histories remain unchanged.

## C5 bleed and bandage recovery

**Selected planning contract; source pending.** Persist the typed C5 status row, HP, current job, exact item custody, skill fact and receipt with the normal changed-row transaction before memory adoption/reply. Reconstruct the current release's inactive generation tombstone or active instance from revision-ordered accepted producers, refreshes, ticks, cure, expiry and deaths. Require actual positive nonfatal C3 hound loss for an application, monotone generation, preserved next due on refresh, one matching live job, ordered tick/expiry and same-body death cleanup. An old hound may have died or fled after applying a valid bleed. Null/malformed fields, impossible time/job/producer/body, unexplained HP loss or active postdeath bleed are typed `save_corrupt`; no silent repair.

Extend D4 terminal-holder recovery for the exact C5 bandage path. A historical accepted `bandaged` must bind its saved command ID/actor, the directly held opted item at that revision, acquired and then-current qualification, active matching effect generation, same-item transfer to the existing consumed holder, status/job removal and authored narration. Later qualifications, HP or item custody do not retroactively invalidate that accepted history. No unrelated item can enter or leave the holder. Cold reopen routes the confirmed bandage line once to Combat if the same encounter remains open, otherwise the World log; neither an inaccessible item page nor unrelated latest receipt may supply success. Pending/refused/faulted commands add none.

Cold reopen after application, refresh, each tick, expiry, cure and fatal return, then exercise a later real consumer. Reopen both canonical same-due bleed/round orders after Flee and re-engagement, including round-first refresh of a former expiry and tick-first fatal cleanup. A forged paired occurrence, second bleed successor or missing current round/bleed job is corrupt; a foreign same-target job retains ordinary conflict refusal. Real SQLite failed COMMIT leaves all prior HP/status/job/item/encounter truth; uncertain absent/committed COMMIT fences input and elapsed until reconciliation. Lost acknowledgment and exact invocation replay consume the bandage once and never rerun cure. Unsupported release/API/hash refuses explicitly; preserve bytes and in-place Start over. Browser refresh and headless simulation supplement, not replace, this durability proof. Owner-save access and native testing remain paused.
