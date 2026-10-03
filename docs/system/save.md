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
(below), else the release's own fresh world. Refusals, nothing written:

| Reply | When | New game offered |
|---|---|---|
| `unsupported_save_format` | the `save` row's format is `loka-save-vN` with N above 1 (a newer app's; checked first) | no: the player updates the app |
| `save_corrupt` | the head, a state row, the identity or the RNG does not parse; half a save (rows or receipts without their tables) | yes, in place; reports and the trace survive |
| `save_corrupt` | SQLite says the file is not a database or a page is malformed (`store.ts:129`) | yes, but `newGame` throws: the host deletes the file (below) |
| `pinned_release_missing` | the pin names a release the app does not carry | yes, on the newest release |

The session controller adds two `save_corrupt` causes, both with the new game in place, after a story opens: a world whose first screen cannot be built (`mobile/authority/local-story/session.ts:55`), or a receipt response in the story's scope that is not valid JSON or has a narration line without a key (`:60`). Any other valid-JSON response of the wrong shape still opens; its replay is a `conflict` ([receipts](#receipts)). Tests: `saves.test.ts` ("an app update reopens a save on its pinned release; new games pin the
newest", "a save of an unknown format is refused with nothing written and no new game"),
`recovery.test.ts`, `start_over.test.ts`.

## Receipts

Scope `story/<lineage_id>/<character>` (`save.ts:101`). A receipt (`store.ts:23`) stores
the invocation id, the CommandId, actor, `intent_digest_version` (`loka-intent-v1`) and intent
digest, the resolved Command (null for a rejection before one existed), the revision (unchanged
for a rejection) and the DecisionResult. Replay (`authority.ts:162`): a known invocation id
with the same digest version, a response that validates as a DecisionResult and the same
intent digest replays `{saved, replay: true}` at its revision without deciding again; any
other known id is `conflict`. A fault gets no receipt (`:182`). Known answers: `kernel/ts/test/lantern_proof.test.ts`, `mobile/authority/local-story/lantern.test.ts` (the frozen
Lantern traces and the 11 adverse cases). The latter projects kernel values onto the traces'
vocabulary by the R6P P4b mapping ([archived ROADMAP](../archive/ROADMAP.md), R6P row) as
changed by Quest from dialogue: action `activate` is gone; action `talk` with no target is the
talk Bram's GameView offers now (`bram_offer` before the quest, then `bram`); continuations
`offer-choice:offer` and `proof-choice:talk` are the minted ContinuationIds of Bram's `bram_offer`
and `bram` choices, and narration ids follow them; outcome `accept` is the kernel's.

## Replies

`Reply` (`authority.ts:25`): `invalid`, `unauthorized`, `conflict`, `fault {code}`,
`pending` (a COMMIT whose outcome is unknown; retry the same invocation), `stale_view` (a NEW
invocation whose `view_freshness_token` starts with `view:` and is not the current
`view:<run_id>:<revision>`, `:121`; any other token is not checked), or `saved {replay, revision, decision}`. A failed commit throws with memory and
storage unchanged.

## Commit, fence, reconcile

`commit` (`store.ts:210`) writes in one transaction: pending story point reports, and for an
accepted decision the head (revision, clock, RNG) and the state rows its delta targets wrote,
then always the receipt. `transaction` (`:265`) is `BEGIN IMMEDIATE` … `COMMIT`: true once
committed; a failed write rolls back and throws; a failed COMMIT, or a ROLLBACK that leaves the
transaction open, returns false: the outcome is unknown. Then the story is **fenced**
(`save.ts:28`): every call answers `pending` until `reconcile` (`store.ts:254`) rolls back and
reads the receipt (committed: memory adopts the saved head; not there: the attempt failed).
Memory never serves a state the store did not confirm. Tests: `faults.test.ts` (every fault
leaves the prior or next revision), `saves.test.ts` ("a new game whose COMMIT is unknown is
fenced; settling it moves play to the new run").

## The save file (`loka-save-v1`)

`store.ts:37`, STRICT tables:

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

Loading (`store.ts:86`) rebuilds the world from the release's cartridge under the pinned
`world_context_id`, or from the release's own fresh world when the pin has none (a save from
before c1-host), plus the rows: the head restores the saved RNG ([10 §31](../archive/spec/10-mobile-commerce-release.md)),
so a reopen replays the same luck. A `world_context_id` that is not a WorldContextId is
`save_corrupt`. Only sections with rows exist, so the state hash matches a headless run
(`smoke.test.ts`, the Gate R6 reference). An app update that reopens an old save writes a new
trace segment header, its kernel version differing ([ADR-075](../archive/decisions/adr-075-observability-proposal.md) §4 amendment R6 S2).

## New game

`newGame` (`authority.ts:269`): after settling any fenced attempt, one transaction replaces the
save with a fresh world of the newest release at revision 0 under a new lineage and run (no
parent) pinned to it, with its own drawn world context and seed as in a new save, drops every receipt (old invocation ids are new again) and recreates the `save`
and `head` tables whatever shape a corrupt save left them in; `report` rows and the trace stay
(`start_over.test.ts` "an intact report table survives Start over in place"). If SQLite reports
the file, or the report table or its index, corrupt, `replace` throws (`store.ts:137`) and the
host's Start over deletes the whole file (`mobile/authority/local-story/session.ts:154`), so pending reports and the trace are
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
(`authority.ts:231`); a replay adds none; a malformed report throws before anything is stored.
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
newest 1000 records (`:73`): `evaluation.budget_exceeded` (`save.ts:110`) and, when the
host supplies a clock, each NEW decision's `kernel.decision_latency` (`authority.ts:209-211`).

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
