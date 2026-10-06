# C3 — Living Fen hounds, bounded persistence and real fight loot

**Adopted PM plan; dependency re-pin and independent plan review required before
source GO.** Source branch `chapter-1/c3-living-hounds`, isolated developer worktree.
Inspected local base `98cc60b1647d031eed790ca085681bbe62af9d73`, chapter0.0.18/API1.16.
B1/B3 are integrated; C1 source is active. B5 source and other intervening release
edits are not pinned here. B5 is not a hound mechanics dependency, but serialize
shared cartridge/schema/save edits and record the actual reviewed predecessor.
C3 successor release/API/hash/fresh IDs, source head, PR, verdicts and proof: null.
This docs-only plan runs no runtime, browser, SQLite or native acceptance.

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
C3-P1 (the sole open finding, review record commit `3c0a81632934e0f5297757fefc4115d5e4447388`)
is addressed by separate slot/control targets, preserved equal-time ordering and
the literal collision controls above; same-reviewer scoped recheck remains pending.
This is author review; independent plan/source approval remains ahead.
