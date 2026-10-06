# C4 — Hound response to aggression, real pack help and wounded flight

**Adopted PM plan; independent plan review and dependency re-pin required before
source GO.** Source branch `chapter-1/c4-hound-behavior`, isolated developer worktree.
Planning base `10b023e827cba4f056aa82870764afb07236938c` has chapter0.0.19 declaring
kernel API at least1.17. C1 and C3 source are not complete. [C3's independent plan
review](../../reviews/2026-10-05-c3-living-hounds-plan-review.md) approved corrected
fix `0127bf4c9c02f944941008d3962982c1144fd2e2`;
[C1 plan review](../../reviews/2026-10-05-c1-tobin-plan-review.md) is approved.
Re-pin actual integrated reviewed C1/C3 source and intervening release edits before
assignment. C4 successor release/API/hash/fresh IDs, source head, PR, independent
verdicts and runtime/browser/SQLite/native proof: null. This is docs-only planning.

## Player outcome and governing contract

C4: deliberate Attack makes exact living hounds respond as one bounded pack;
helpers supply real rotating attacks, and wounded hounds leave through legal
area exits with their actual pelts. Follow [PM selection](../../decisions/pm-decision-c4-hound-behavior-2026-10-05.md),
[mechanics](../../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract),
[parameters](../../system/cartridge.md#c4-pack-response-and-wounded-flight),
[composition](../../system/protocol.md#c4-pack-encounter-and-flight-composition),
[save](../../system/save.md#c4-pack-and-flight-recovery) and
[Book](../../system/book-ui.md#c4-pack-response-and-enemy-flight-details).
Installed combat/death/Flee/elapsed and selected C1/C3 clauses remain governing
except for the explicit roster/rotation/flight extension. One-rat no-defense
[A/B/C answers](../../spec/conformance/first-encounter.md#frozen-input-sequence)
remain current combat regression contracts.

The earlier provisional night-auto-aggression recommendation is explicitly
deferred. Attack alone initiates; entry, reading, elapsed/night and corpse recovery
never do. This is the current roadmap's response-to-aggression consumer, not a
generic AI framework or automatic hostile-room system. No late helper admission,
retarget player command, pursuit, new verb, bleeding, spawn or population redesign.

Read [mechanics](../../lessons/mechanics.md), [storage](../../lessons/storage.md),
[contracts](../../lessons/contracts.md), [evidence](../../lessons/evidence.md) and,
before Book/authority work, [mobile](../../lessons/mobile.md) lessons. Apply Ponytail,
Ponytail Review and actual-diff correctness self-review. Native work stays paused.

## Immediate Book fight, flight and custody path

Use C1's all-hours swords lesson and exact gifted rusty sword; if C2 integrated,
use original Tobin's reachable Watch Post route. Equip before Attack. Ferry Landing
south → Reed Path south → Reed Bank east → Hound Run, then east to Adder Nest if
adjacent Scan shows the existing hounds there. Their current C3 members, not a
replacement/day wait, provide the first proof. Inspect separate instance entries,
Attack one, see exact helpers admitted and observe each member's real attack slot.
The attacked member remains primary until actual death/departure, then the new
primary is explicit. No shop/shield purchase is required to exercise this fight.

Run an actual controlled injured-hound Book branch to show legal flight and no
old-room attack/loot. Its same pelt remains held by the survivor in the adjacent
area room; no corpse or Carrying reward is shown. Other pack members keep Combat
open; no survivor means immediate World restoration. Flight is an optional outcome,
not a reason to chase or wait for wandering. Outside an open encounter, the same
survivor is deliberately retryable at its actual reachable location now.

For actual loot, C1's fixed3 rusty hits can kill the HP8 primary through8→5→2→0,
never leaving a live HP below2. Actual misses, dodge and due order still apply.
After the whole pack closes, open each real public corpse and Take its original
pelt; overload uses ordinary Drop/Put and immediate retry. A fled member's pelt
never appears in another member's corpse. No Sell/skin/rare loot is introduced.

Prove lethal player loss → same-body chapel return → chapel_steps → north_gate →
village_green → well_lane → ferry_landing → reed_path → reed_bank → actual death
room (Hound Run or reachable Adder Nest) → owned corpse recovery. No hound engages
during that return; ordinary nested/worn/overload recovery preserves real items.
Player Flee retains standing/exit/fare checks and closes the whole occurrence
without retaliation when admitted. Required rescue/bell routes never need this
optional fight, gear, Flee, pelt, night or replacement.

## Composition, agent identity and scheduler boundary

Follow [composition](../../system/architecture.md#building-mechanics-by-composition).
**Consumer:** one exact attacked hound, its co-present plan mates and actual flight.
**Reads:** command actor/body, exact C3 slot/generation/provenance/HP/custody,
encounter active roster/primary/cursor/current job, legal adjacent area edges,
posture/C1 eligibility and shared query/RNG/work budgets. **Writes:** checked
encounter/job transition, actual attack HP/events, same-group flight custody and
that member's last-flight slot clock, or fatal victim slot/corpse/pelt; player
escape/death closes every active opponent. **Owners:** combat owns encounter,
rotation/closure and due job; movement owns validated NPC flight; population owns
fixed membership/replacement and its one job; death owns custody/return; proposal
owns ordering/conflicts/causation; authority commits/adopts once; Book projects.

Internal run_job binds the validated encounter CharacterId/body and each exact
attacker/target EntityId; it never substitutes `world.character`, a definition's
first instance, a slot's replacement generation or a template-name match. Helpers
come only from the attacked hound's full pinned plan, at admission time. Pack
membership grants no S1 credit. Only actual positive HP loss is evidence for any
future C5 consumer; assistance/flight narration is insufficient.

Use one encounter and current round job. Snapshot canonical eligible members once,
initial primary/cursor = attacked ID. Lock one opponent per round; if killed/fled
before its slot, skip it, then rotate next round. Missing/departed members prune
without off-room hits; no refill from the population. Actor opportunities still
re-read actual state; player death closes before revival. NPC flight reads legal
area movement without using the player's stance, held key or MV as an animal
resource. Shared budgets cover every candidate and the complete round.

The only population-state extension is nullable `last_flight_at` per existing slot.
Set it on actual flight in the combat group; retain through death and reset only
for new generation. C3 wander skips engaged members and a member whose flight
clock equals this occurrence, avoiding same-deadline double transfer in either
allocated job-ID order. Population writes no unchanged slot. No priority override,
new cooldown, per-hound scheduler, history scan, duplicate roster ledger or
cross-writer conflict exemption. Generic checked encounter/slot transition fields
need both foundations' literal fixtures and differential proof; story logic stays
TypeScript until its first server consumer.

Likely in scope: C3 plan pack/flight settings and text; minimum combat helpers,
schedule skip query and current slot field; encounter/state/delta/job/invariant
schemas and both foundations where generic semantics change; compiler/short-ref/
loader/generated contracts; real local-story validation/fault/reopen tests;
GameView and existing Book Combat projection/history. Inspect callers before any
necessary proposal change. Out: C3 births/caps/wander algorithm/new rooms, C5,
deer/crows, Tobin mortality, unsolicited aggression, pursuit, generic intent engine,
NPC defense catalog, per-helper swings, native work, UI style/navigation redesign.

## Independent literal acceptance and red controls

Freeze independent valid fixture UUIDs with canonical H1 < H2 < H3 (up to H6),
their paired pelts L1..L6, body P and plan A/B. These symbols denote test identities;
production fresh IDs remain null. Use S0..S4 from the independent raw/state table
linked above, zero controlled recovery, accuracy100/fixed damage1 on both sides,
no defenses, playerHP10, each hound maximum/startHP8 and threshold25 unless a case
states otherwise. Keep inputs distinct from production tuning. Expected results
are literal, not computed by combat helpers or the other kernel.

Each new test names its plausible break. Apply its mutant to the old focused
same-layer suite first and add only a missing regression; actually observe each
claimed new guard fail, restore it and rerun. Reuse C1 defense/Flee and C3
spawn/slot/death tests rather than duplicating their breaks.

1. **Helper selection aliases a template or accepts remote members:** Attack H2
   at clock0 with H1/H2 co-present A members admits roster[H1,H2], primaryH2,
   cursorH2, one pending job due5, unchanged HP/S0 and original pelts. H3 in the
   other room, foreign B member, dead/retired or already engaged never joins.
   A later entrant does not join. Reverse insertion order: identical active
   identities/primary/cursor. Remove exact-plan/co-presence/generation/engagement
   validation separately, or choose a template's first instance, and observe the
   relevant literal case fail. Entry/reading/night alone opens zero encounters.
2. **Assistance gives extra swings or never reaches a helper:** Attack H1 at0
   admits[H1,H2], primary/cursorH1, due5. Round1: player hits H1 with raw11520,
   H1 hits P with raw0; P9/H1=7/H2=8, S2, nextH2, due10. Round2: H2 hits P
   with raw5927040, player hits H1 with raw70819200; P8/H1=6/H2=8, S4,
   nextH1, due15. Exactly four accuracy draws and two real distinct NPC attackers.
   Six-member pure round fixture with resting P/HP10 and zero recovery selects
   H1,H2,H3,H4,H5,H6 then H1, one enemy opportunity each: final P3/all hounds8,
   exactly seven incoming results, no player result or flight. Mutate per-helper attacks,
   skipped rotation or insertion selection; require failure. Old non-pack
   no-defense A/B/C keeps literal answers.
3. **Dead selection inherits a helper strike or revived player is hit:** start
   round1 with H1HP1/H2HP8, selected/primaryH1 and S0. Player kills H1: P10,
   H1=0/H2=8, S1, same L1 in one H1 corpse, active[H2], primary/nextH2,
   next job due10; H2 does not strike in the lost H1 slot. For even round2 start
   playerHP1 standing, H1/H2HP8, selectedH2, S0: H2 kills P, S1, one owned
   corpse, closed empty encounter/no successor, restored authored HP/MV/body
   at chapel and no player/H1 opportunity. Pin actual restore values from the
   integrated predecessor independently. Plant slot substitution or omitted
   whole-pack closure. A slot replacement never joins an old occurrence.
4. **Threshold equality flees or flight grants phantom loot:** with nonstanding
   sitting P (no player draw), H1HP2/max8 selected in round1, it does not flee:
   H1 stays2, P9, S1. With HP1, one legal area edge Hound Run east→Adder Nest:
   P10, H1=1 at nest holding L1, S0, slot last-flight5, empty closed encounter,
   no successor/corpse/credit. With two legal area exits in a small controlled
   route, choose canonical direction first, no RNG. With no legal exit,
   H1 remainsHP1/home holding L1, P9/S1, nextH1/due10, last-flight null.
   Mutate `<` to `<=`, bypass a barrier/area, charge P's MV, allocate a corpse,
   drop L1, or attack after flight; each applicable focused break must fail.
5. **Equal-time population wander undoes flight or repeats a custody write:**
   controlled six-live A at200, wander10/delay240/calendar24×10, H1HP2/max8,
   H2–H6HP8, all co-present at home, zero recovery, fixed1/accuracy100, interval5.
   Attack H1 at205 admits all six. Round210 and A population210 must both commit
   in either actual allocated job-ID order. H1 flies to nest with L1/HP1, P10/S1,
   active[H2,H3,H4,H5,H6] remain home, primary/nextH2, next round215. All six
   original generations/pelts persist, slot1 last-flight210, other last-flight
   values null, no replacement/corpse; control has one successor due220.
   At a strictly later wander boundary, unengaged H1 may move normally. Use two
   frozen valid lineage/command inputs producing opposite allocated job orders,
   not forged IDs. Cold reopen/exact receipt retry preserves the answer. Remove
   same-clock skip: combat-first must expose the wrong move/conflict and fail;
   remove engagement skip: population-first must fail. Independently valid two
   different-group same-slot writes still return `conflicting_write` with target
   `{kind: population_slot, plan: A, slot: 1}` and no adopted changes. Include
   this boundary in real failed and both unknown COMMIT controls.
6. **Stale jobs/absence/budgets silently change world:** reopen lawful H1 departure
   before round1/due5 with roster[H1,H2], primary/cursorH1 and S0. Prune H1,
   select H2: P9/H2=7/S2, primary/nextH2, successor10, no H1 attack/draw. If all
   members departed, P10/S0, closed empty roster/no successor. Cancelled/old
   occurrence replay changes nothing: zero moves/draws/admissions. A shared
   query-budget exhaustion across enemy exits and an eight-raw-draw round
   exhaustion adopt no HP/RNG,
   flight slot/custody/encounter/job changes. Reuse existing controlled budget
   failures where they exercise this path; otherwise independently pin rejection/
   defense inputs and plant per-candidate/per-helper resets. Player Flee's zero/
   one/multiple-exit controls now assert whole roster closure/no retaliation,
   not changed selection or fare formulas.
7. **Saved membership/flight proof is forged or COMMIT splits state:** real
   SQLite cold-open after admission, both selected-member rounds, primary death/
   reselection, flight, lawful departure, final withdrawal, whole-pack Flee/death
   and equal-time orders. Independently mutate duplicate/foreign admitted ID,
   primary/cursor outside roster, mismatched character/body/job/round, wrong
   flight clock/slot/member/generation/receipt cause/correlation or custody one
   at a time: typed `save_corrupt`, unchanged bytes. Lawful later wander/death/
   replacement/Take retains historical proof; an absent/dead member with valid
   intervening evidence awaits due pruning rather than being falsely corrupt.
   Real failed COMMIT, unknown-not-committed, unknown-committed and lost
   acknowledgement yield complete all-old/all-new rows plus receipt; fenced
   retry re-admits/rotates/transfers/draws nothing twice. Remove binding/atomic
   flight persistence as red controls. Exact release mismatch refuses with no
   deletion or automatic Start over.
8. **Book hides escape or substitutes a corpse/instance:** execute real C1 lesson
   → C3 adjacent Scan → exact Attack → distinct helper attacks → wounded flight,
   whole-pack Flee, lethal loss/owned worn/nested/overload recovery, and rusty-sword
   real corpse/Take. Repeat chapter-required rescue/bell route and hound-room corpse
   return at calendar19:59,20:00,23:00,06:00 with zero unsolicited engagement.
   Preserve current Combat actions/primary, once-only committed Combat history,
   and pending/fault/refusal honesty across reload. Plant automatic night Attack,
   stale detail target substitution or missing whole-pack close and require the
   focused journey to fail. Browser proof does not certify native/SQLite faults.

## Checks, review and scope triggers

Focused source checks: compiler/loader/short refs/schema generation and required/
bound mutants; both checked transition/creation/composition twins and differential;
pack/rotation/flight/population equality/clock/combat/death/Flee/action/view tests;
real SQLite saved-state binding/reopen/failed/both-unknown/lost-ack/receipt suites;
changed Book/browser interaction. Keep simulator enabled and run appropriate
regression seeds. Use the pinned `mise exec --` toolchain and task-local writable
mise state. The provisional lane runs focused checks first; full active
`bin/check_all.sh` and planted controls run at accumulated publication via the
normal hook. Report exact commands/exits and red failures, never claim proof here.
Fresh primary and separate protocol/save/foundation review are required for source;
Astra audits `runtime/proposal.ts` if touched. Docs-only plan gets one fresh short
independent review. No implementation, merge, push or native action in this task.

Stop/escalate unresolved C1/C3 predecessor/release order, unplanned automatic
hostility/late joining/pursuit/per-helper swings, new jobs/framework, failure to
accept a lawful saved prefix or reconcile whole flight/encounter state, same-time
writer collisions, unbounded historical scans, or a required journey/owned recovery
needing a time/gear/loot gate. Split only if the actual footprint exceeds one
complete bounded pack/flight outcome; never split by kernel/content/presenter.

Planning Ponytail Review: one encounter/job and C3 slots cover the concrete consumer;
no behavior engine, spawning duplicate, corpse-immunity mechanism or new dependency.
Correctness self-review checked selected-member death, primary/cursor repair,
same-clock flight/wander, strict threshold, pelt custody, whole-pack closure and
lawful cold states. This is author review, not independent approval or executed proof.
