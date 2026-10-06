# C3 — Living Fen hounds, bounded persistence and real fight loot

**Adopted plan, source dependencies re-pinned; integration order still required.**
The [independent plan review](../../reviews/2026-10-05-c3-living-hounds-plan-review.md#scoped-fix-recheck--round-1)
approved corrected plan `0127bf4c9c02f944941008d3962982c1144fd2e2`; C3-P1 is
closed. This approves the contract, not executed C3 or source/publication proof.
Source branch remains `chapter-1/c3-living-hounds`, in its own developer worktree.

Historical published B7 baseline `547f809ccdd587498dee86cb14822f564efee642`,
[#209](https://github.com/lorecrafting/lokacore/pull/209), contains reviewed B1 clock,
B3 commerce, C1 lessons/armed combat, B4 light and B5 herbs. Its cartridge is
`ashmere_missing_child@0.0.22`, API1.20, SHA-256
`0f744a6c12e8cde1c70cac454e16c733bf5ec27265fc6ad2cd7ad1b025e9dbf8`,
with [independent release answer](../../../protocol/fixtures/missing_child_b7_hash.json)
and [96 initial IDs](../../../protocol/fixtures/missing_child_b7_ids.json). B7 final
source `d24b6f8917fa46e171fbf1791e3ed2c3bd848109` has approved
[primary](../../reviews/2026-10-05-b7-waterskin-primary-review.md#scoped-fix-round-1--approve)
and [save/protocol](../../reviews/2026-10-05-b7-waterskin-save-second-review.md#scoped-book-fix-recheck--2026-10-05)
reviews. B5/B7 supply is not a semantic hound dependency; preserve their installed
rows, carrying mass and save history in the successor.

Current published source predecessor is B6 Wisp plus the reviewed B8 brief in
[#210](https://github.com/lorecrafting/lokacore/pull/210), merge
`c912134556993da33a362be82ba9ee3bfcb25d32`; roadmap-only follow-up
`71c2f9ae31905f5110c40fa7d553ff2a74c21709` changes no source pin. B6's exact source
`e7aeace7f369254e3fb4b3f197dc1b641b6e6e87` and evidence
`76f2ed59b76833d0f938fcc93f48da986a9f543d` have approved
[primary](https://github.com/lorecrafting/lokacore/blob/c912134556993da33a362be82ba9ee3bfcb25d32/docs/reviews/2026-10-05-b6-wisp-primary-review.md)
and [save/protocol](https://github.com/lorecrafting/lokacore/blob/c912134556993da33a362be82ba9ee3bfcb25d32/docs/reviews/2026-10-05-b6-wisp-save-second-review.md)
reviews. Current release is `ashmere_missing_child@0.0.23`, API1.21, SHA-256
`e7333f694e6ec2c9f02a39944d994d4452f26fffc5534ff217346504471e4c71`, with
[independent release answer](https://github.com/lorecrafting/lokacore/blob/c912134556993da33a362be82ba9ee3bfcb25d32/protocol/fixtures/missing_child_v023_hash.json)
and [103 initial IDs](https://github.com/lorecrafting/lokacore/blob/c912134556993da33a362be82ba9ee3bfcb25d32/protocol/fixtures/missing_child_v023_ids.json).
Exact labelled Talk selection and bounded choice attempts are installed. B8 source
and the final reviewed C2 integration remain separate upcoming predecessors;
publication of B8's brief certifies no service implementation. C3 source is unbuilt.
Its successor release/API/hash/fresh IDs, source head, PR, verdicts and runtime proof
remain null. This docs-only re-pin runs no source, browser, SQLite or native work.

## Player outcome and governing contract

C3: encounter bounded persistent Fen hounds, deliberately fight one and Take its
actual pelt from its real corpse. Follow [PM adoption](../../decisions/pm-decision-c3-living-hounds-2026-10-05.md),
[population mechanics](../../system/mechanics.md#c3-bounded-living-hounds-selected-contract),
[chapter parameters and route](../../system/cartridge.md#c3-hound-population-and-loot),
[creation/composition](../../system/protocol.md#c3-spawned-bundles-and-population-composition),
[save](../../system/save.md#c3-living-population-recovery) and
[Book](../../system/book-ui.md#c3-living-hound-and-loot-details).
The installed combat/death/custody/clock clauses and
[approved C1 contract](../../decisions/pm-decision-c1-tobin-training-2026-10-05.md)
remain governing. This explicitly reconciles archived
[00a populations](../../archive/spec/00a-chapter-one-content.md#populations) and
[M17-B](../../NEXT-MECHANICS.md); it does not implement provisional C4 choices.

Read [mechanics](../../lessons/mechanics.md), [storage](../../lessons/storage.md),
[contracts](../../lessons/contracts.md), [evidence](../../lessons/evidence.md) and,
before Book/authority work, [mobile](../../lessons/mobile.md) lessons. Apply Ponytail
before implementation, Ponytail Review and actual-diff correctness review before
handoff. Native builds/Simulator/device work stay paused.

## Real all-hours fight, loot and recovery path

Use C1's all-hours original Tobin lesson and gifted rusty sword; if C2 already
landed, use his reviewed Watch Post route rather than adding another Tobin. No
shield/shop purchase is necessary. From Ferry Landing go south Reed Path, south
Reed Bank, east Hound Run. Inspect gnawed bones, the exact living NPC entry and its
Attack action. The fresh plan guarantees four initial hounds even during daytime.
If they have wandered, use adjacent Scan and go east to Adder Nest now; never
wait for their home-room return. Wear/learning occur before Attack; combat retains its existing focused actions.
Kill that one hound through actual due rounds, open its public corpse, Take the
same original pelt and show it in Carrying. If carrying would overflow, ordinary
Drop/Put and retry are immediately available after combat; no replacement loot is
minted. Return west to Reed Bank, or inspect reachable Adder Nest east and return.
No proposed Sell/skin/rare-ring consumer is part of this result.

Also prove real lethal player loss and recovery of actual worn/nested possessions:
chapel_nave south → chapel_steps south → north_gate south → village_green south →
well_lane south → ferry_landing south → reed_path south → reed_bank east → hound_run,
and east to adder_nest only if that is the recorded death room. Use ordinary
post-return recovery/carry admission; no fare, equipment, key, hostile automatic
engagement, tide or night gate. The same surviving hound is retryable immediately;
a killed hound leaves recoverable loot immediately. Rescue, bell and patrol do not
need this optional fight, pelt or respawn. Never wait for replacement in the Book
walk. Due-boundary and 30-day proofs drive trusted elapsed with controlled clocks.

## Source readiness and parallel boundary

Semantic prerequisites are installed clock/segmented jobs, ordinary movement,
C1 single-opponent armed combat, HP/death/corpse custody and checked identities.
Neither Wisp/ward, patrol/trust nor Maud service/bed entitlement is required to
spawn or fight hounds. Preserve their actual source rather than invent substitutes.
B6 has now built Marsh Light; C3 retains its adopted two-room area and adds no
Marsh Light connection merely because that room now exists. C4 remains separate.

At the initial readiness pass, C2's developer reported `slice/c2-watchmans-rounds`
checkpoint `9ee1bbbd1a5932686ce4416710ca085604a6766f` with its B6-selector merge
unresolved. That is a historical reported checkpoint, not the final reviewed
combined head; re-confirm actual C2 source/reviews before assignment. C2 moves
the same original Tobin to Watch Post and adds fatal patrol reset. It reports creation/hydration and `runtime/proposal.ts` untouched. Wait for
the reviewed B6→C2 integration before changing their overlapping seams or deriving
any successor pin; keep both C2 failure and C3 victim-slot updates in the actual
fatal writer group without adding a second Tobin location writer.

| Work | May proceed independently | Must serialize or be checked on the combined head |
|---|---|---|
| C3 versus active C2 | This plan, controlled birth/slot/job oracles, template/route prose, owned population/creation module design | State/delta registries and both composers, runtime rows/dispatch, movement/death hooks, content/compiler/loader, save replay, Book and release pins |
| C3 versus queued B8 | After C2 is stable, population/bundle/creation work and service-specific rule/stock work in separate feature worktrees | Shared command/action/feature generation, chapter manifest/text/IDs, dispatch/content/save entrypoints and Book; choose merge order before source assignment |

Recommend queued B8 then C3 for the shared successor pins. This is scheduling,
not a new semantic prerequisite: PM may select the reverse order before assignment.
After the order is selected, disjoint domain work can run concurrently in isolated
worktrees; defer conflicting shared-file integration and final fixture generation
until the predecessor lands. Do not call either partial layer a complete slice.
The final C3 head must include actual predecessor source and pass its affected
C2 patrol/death and B8 service/liquid/receipt checks alongside C3. Parallel branch
checks alone certify no combined head. Until C2's actual reviewed head and
successor order are confirmed, full C3 source assignment remains queued; planning
can continue.

Installed seams still requiring the C3 consumer: `runtime/created.ts` hydrates
room-fixed corpse items only; `foundation/creation.ts` admits death origins and
room-only initial placement; `combat/shared.ts` maps `npcRef` through the one-authored
instance map; `death/sequence.ts` selects the default NPC corpse and requires a
known killer. Extend those actual guards for proven spawned members, dynamic HP
and per-plan corpse selection, preserving default rat/player behavior. Schedule
currently dispatches encounter, deadline and daily NPC jobs; add only the exact
plan-owned dispatch. Do not silently treat schema `spawned` as installed support.

B7's `receipt-save.ts` already invokes `receipt-history.ts` through `liquid-save.ts`:
it replays accepted commands/elapsed in revision order and compares full decisions
and final state. Extend this existing path to valid spawned hydration/genesis and
population slot/control evidence; reuse it for C3 historical custody, HP and jobs.
No second population history ledger or gameplay writer. Ensure replay is invoked
for C3's opted plan rather than accidentally relying on an unrelated vessel to
trigger it, and retain the documented linear cold-recovery limit. Every lawful
complete birth/partial injury/death/loot/replacement state must reach this verifier;
prefix hydration during a proposal remains distinct from complete-save validation.

## Book action and route readiness

Reuse the [Book component language](../../BOOK-UI-COMPONENTS.md): World→exact living
hound Thing/NPC detail→Combat foreground→World→corpse Thing detail→pelt child detail.
The selected NPC entry uses the offered `attack` key (or its actual authored alias),
resolved command
`attack {actor_id, target_id}`, ordered targets `[hound_id]`, empty input. Contents
uses `take`, resolved `take {actor_id, item_id}`, `[pelt_id]`, empty input. Preserve
an authored alias key while resolving the same command; projection and execution
use the same bounded admission checks, including actual dynamic life/presence,
combat precedence, visibility and Take carrying/custody. No new population verb.

One loaded alias case must run the advertised view→ActionInvocation→command and
observe the literal admitted/refused result; reuse existing same-layer checks when
they catch it. Combat owns hit/fatal history; item detail owns confirmed Take history.
A departing/dead generation prunes its exact route; a new same-named hound cannot
inherit the old target. Pelt Back returns to its corpse, then World; combat closure
restores World. Walk this complete browser interaction with two same-named hounds,
actual pelt Take and refresh, plus lost-ack/refused controls. Fix misleading results,
stale targeting and dead-end nested returns in this slice; the later chapter polish
pass does not defer them. Amend canonical Book rules only if actual interaction
changes beyond the existing selected C3 contract.

## Composition and minimal implementation

Follow [composition](../../system/architecture.md#building-mechanics-by-composition).
**Consumer:** one living population, per-instance fight and real pelt custody.
**Reads:** declared plan/bundle, calendar, bounded current slots/job, exact member
origins/HP/rooms, encounter, legal edges and shared custody. **Writes:** checked
identities/placements/HP, separately keyed slot generation/death eligibility and
plan control/current job, ordinary movement and existing encounter/HP/death/corpse/
loot consequences.
**Owners:** population owns bounded membership and replacement; creation owns
immutable identity/bundle proof; movement owns edges; schedule owns dispatch;
combat/resource/death own lethal consequences; authority alone owns receipts,
changed-row transaction/adoption. The presenter has no spawning or countdown writer.

Reuse IdSource, registered job ordering/segmentation, structural sharing,
resource/containment/death, dynamic corpse hydration and C1 resolver. Missing
invariants are exact paired spawned provenance, fresh template-only NPC/item
creation, slot/generation binding and plan-owned dispatch. Current `created.ts`
hydrates only room-fixed corpse items, and authored `entityIds` is one-to-one:
repair those actual seams rather than treating generic `spawned` schema as support.
Initialize new worlds through the checked bundle sequence after the existing
birth allocations; independently re-pin current known answers. All six slots use
one job; no member scheduler or generalized behavior tree is needed. Fatal combat
writes only its victim slot; population dispatch writes separate control and only
actual birth/replacement slots, never no-op slot transitions. The fixed declared
ordinal range is the only slot index; control stores no member/count mirror. Require
wander <= replacement delay so the existing job is early enough without a death
control write. Preserve canonical job-ID order and distinct groups at equal times;
same-slot cross-group writes remain conflicting_write. Runtime
reads current slots without scanning historical corpses. Derived maps copy only
when creation changes them; ordinary actions retain existing structural sharing.

Likely in scope: chapter manifest/two rooms/template NPC/pelt/hound corpse/plan and
text; minimum protocol identity/state/delta/job/content schemas/registry/generated
contracts; both foundation creation/compose/precondition/invariant twins; compiler
and TS loader/short refs; runtime fresh/created/dynamic resource/target/view;
population rule and schedule dispatch; combat/death dynamic victim and corpse
selection; local-story state/receipt validation and real SQLite tests; existing
Book NPC/corpse/item projection only where needed. Inspect proposal callers before
any necessary change. Out: C4 aggression/assist/flee, C5 status, deer/crows, herb
regrowth, bell disable, corpse decay, rat respawn, shop restock, new player verbs,
random loot, server adapters, native work and navigation/style redesign.

## Independent controlled acceptance and red controls

Every new test names a distinct realistic break and uses literal expected values.
Apply its mutant to the old focused suite first; add only a missing same-layer
regression. Actually observe each claimed new guard fail when broken, restore it
and rerun. Fixtures freeze their own literal UUIDs for H1–H7, L1–L7, plan A/B and
rat R; production IDs remain null until allocation is independently checked.

1. **Population count ignores location and ownership:** controlled calendar24×10,
   birth180, night[20,6), wander10, delay240; birth creates H1–H4/L1–L4 in home,
   count4. At190 the same four move to nest, still4. At200 H5/H6 and L5/L6 fill
   the two never-used night slots; total6. Replay/reopen stays6; dawn300 retains6.
   B's hound and R neither count nor move for A. Remove whole-area/owner/cap
   validation separately and require the relevant controlled case to fail.
2. **Respawn bypasses death due or reuses an identity:** kill H1 at205 in a real
   fatal round. Its same L1 goes to one real corpse, A count5, due445; Take L1.
   At444 there is no H7/L7; at445 H7/L7 fill slot1 generation2 and count6.
   L1 remains player-held; H1 stays HP0. Exact receipt/job retry creates no H8.
   In a separate six-live fixture, H5 dies at310: due550 is daytime, so its
   extra slot stays empty at550 and fills generation2 at night680. Remove
   delay/generation/occurrence guard; never reuse another slot to evade its delay.
3. **Instances share HP or template-target selection:** controlled two hounds HP6,
   S0, playerHP10, zero recovery, accuracy100 both sides, player fixed3/NPC fixed1,
   no defenses. Attack H1 changes no HP/RNG. After round1: player9/H1=3/H2=6,
   S2. After round2: player8/H1=0/H2=6, S4, encounter closed, one H1 corpse
   holding L1, H2 still holding L2. Compare to independent raw/state literals in
   the [first-encounter oracle](../../spec/conformance/first-encounter.md#frozen-input-sequence).
   Plant definition-level HP/first-instance targeting or missing dynamic victim
   admission. Reuse C1's distinct dodge/block tests; do not duplicate them here.
4. **Malformed spawn accepted:** reject duplicate/colliding ID, wrong plan/bundle/
   template/role, orphan/extra pelt, swapped member/parent/generation, missing HP,
   out-of-area birth, source-not-null placement and stale prior slot/job binding
   atomically. Both portable twins match independent current creation fixtures
   before differential comparison. Break the new initial-parent/provenance and
   row-prior checks. Existing corpse/default rat behavior remains independently
   pinned; changing obsolete release IDs is not backward-compatibility work.
5. **Wander attacks remotely or stale jobs spawn:** at a boundary move only a
   living unengaged member along the legal edge, not an engaged/dead one. A
   blocked edge stays put; no draw/player fare. Cancelled/old plan occurrence
   creates/moves/draws nothing. The later exact-bound combat round and cold load
   accept every lawful saved intermediate state. Plant missing encounter/edge/
   current-job guard; actually run the later consumer, not just inspect topology.
6. **Persisted rows can forge birth/eligibility/loot:** cold reopen at birth,
   wander, night/dawn, Attack, partial injury, fatal/take, pre-due/due and after
   generation2. Change one real saved origin/slot/job/HP/receipt linkage at a time;
   require typed save_corrupt and unchanged bytes. Real failed COMMIT, both unknown
   outcomes and lost acknowledgement preserve all-old/all-new bundles, HP, RNG,
   custody, jobs, head/receipt; retry allocates/transfers nothing twice. A pin
   mismatch refuses without file deletion. Exercise lawful post-Take pelt custody
   and an old dead victim after its slot advances; original-parent validation
   must not reject them. Break atomic slot/bundle/receipt binding as red controls.
7. **Equal-time fatal and population deliveries conflict:** use the six-live
   controlled setup at200, HP6/player10, zero recovery, accuracy100, fixed player3/
   NPC1, no defenses, combat interval5. Attack H1 at200; round205 leaves player9/
   H1=3/H2–H6=6, S2. At210 round2 and population wander are both due. Use two
   frozen controlled lineage/command inputs whose actual allocated job IDs put
   combat first and population first respectively; do not forge IDs or provenance.
   In both runs require accepted elapsed210, player8/H1=0/H2–H6=6, S4, one closed
   encounter, one home-room corpse holding the same L1, slot1 generation1/memberH1/
   replacement due450, live count5, H2–H6 at nest with their original pelts and
   one pending plan successor due220/next wander220. No H7/L7 is created at210.
   Control names only that successor, with no duplicate membership index; exact
   slot keys1–6 stay present and all other slot generations/members stay unchanged.
   Committed event/operation order follows actual job IDs; require the same stated
   conserved result, not identical receipts across the two lineages. Cold reopen
   and exact receipt retry preserve it without another corpse/slot write. Include
   this boundary in real failed/unknown COMMIT controls.
   Red control: make population emit a no-op transition for slot1 while advancing
   control; each ID order must fail instead of accepting the combined elapsed.
   Independently compose two otherwise valid transitions of the same slot from
   different groups, using the first transition's resulting row as the second's
   expected prior row: require literal fault code `conflicting_write` and target
   `{kind: population_slot, plan: A, slot: 1}`, with no adopted changes. Do not make
   different-group writes legal to pass the equality test. Distinct control/slot
   targets must compose to their independent literal rows in both foundations.
   Compile and load the otherwise valid controlled plan with wander241/delay240:
   both must refuse; wander240/delay240 is admitted. Remove only this period guard
   and observe the invalid-plan test fail, protecting the untouched-control proof.
8. **Bounds or Book path silently fail:** run 30 controlled world days with
   scripted deliberate fights and autonomous elapsed/wander between them; sample
   every committed boundary, cap <=6 and exactly one current pending plan job.
   Retain command/seed/fault identity and literal expected generation/loot rows for
   the selected trace; cold-reopen splits produce the same answers. Run the real
   chapter Book fight/Take plus lethal recovery and required-story journeys at
   day/night, showing separate hounds and exact corpse/pelt. Raw stale Attack,
   pending saves/refusals/faults claim no success; combat and Take history appear
   once after reload. Plant a route gate/definition substitution and observe the
   focused journey fail. This is C3 proof, not complete R8/R10/native certification.

## Checks, review and stop trigger

The provisional developer run is recorded in [C3 local evidence](../../evidence/2026-10-05-c3-living-hounds/README.md); independent source review and publication remain separate gates.

Run focused compiler/loader/short-ref/schema, both creation/composition twins and
population/clock/combat/death/target tests, changed Book tests and real SQLite
reopen/fault/replay suites. Run generated-contract and docs checks; schema changes
need required/bound invalid fixtures and the mutant sweep. Keep simulator enabled.
Use task-local writable mise state with the pinned toolchain. Provisional local
source work uses focused checks first; full active `mise exec -- bin/check_all.sh`
and planted controls run at accumulated-head publication under the normal hook.
Report exact commands/exits and actual red failures, not claimed proof. Require
fresh primary review and separate protocol/save/foundation opinion; Astra audits
`runtime/proposal.ts` if touched. No remote push/merge/native run here.

Stop/escalate unresolved reviewed dependency/pin order, unplanned multi-opponent
combat, broader spawn tree/cleanup/disable behavior, inability to hydrate a lawful
bundle prefix or reopen its complete commit, unbounded per-action history work,
main route/loot recovery requiring respawn/night/equipment, or a footprint beyond
one complete persistent deliberate-fight/loot outcome. Split by an independently
playable result, never by compiler/kernel/UI layers.

Planning self-review: the new primitive has its first actual living/loot consumer;
no separate inventory/population balance ledger or speculative behavior framework.
Ponytail Review: lean; one owned job and fixed slots reuse existing time/death/
custody/receipts. Correctness review checked surplus, extra-slot eligibility,
post-death identities, stale invocation and honest delayed optional replenishment.
C3-P1 is closed by the linked independent scoped plan approval; preserve its
separate slot/control targets and both literal equal-time job-ID order controls.
This source-readiness update changes no population behavior or tuning. Its short
fresh docs review and later independent source reviews remain required. Self-review
found no new framework: use installed replay, current Book patterns and the exact
creation/hydration gaps above. Current predecessor integration and pin order remain
the scheduling gate; source proof is still ahead.
