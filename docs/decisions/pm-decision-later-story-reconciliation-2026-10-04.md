# PM-selected future policy: later Ashmere story reconciliation

2026-10-04. **Source-only planning draft; implementation and publication review pending.**
The root PM selects these five resolutions under the
[owner's mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md).
Owner request, paraphrased: use Astra to resolve the five later-story conflicts.
Astra supplied read-only design advice pinned to merged main `6d9712ef`; it authored
this design and is not its independent reviewer. The governing [Legend/chapter reconciliation](pm-decision-legend-mechanics-reconciliation-2026-10-04.md)
is now merged in [PR #136](https://github.com/lorecrafting/lokacore/pull/136);
its original research/formula alternatives remain historical. This decision changes future planning
only, without changing installed contracts, the active M1–M23 sequence or archive text.

The [provisional queues](../LATER-MECHANICS.md) own candidate boundaries and acceptance;
[the ending table](../LATER-ENDINGS.md) owns exact ending selectors, semantic text,
ports/defaults and proof limits. Unspecified numeric tuning and registered encodings wait
for their actual consuming briefs. Literal narrative text is review copy, not a claim of
owner-approved final literary prose. Existing archive clauses are retained as history:
[first-cartridge design](../archive/spec/00-first-cartridge-design.md) §§2–5,11 and
[primitive catalog](../archive/spec/21-composable-world-primitives.md) §28.

## 1. King in the chamber; vault after defeat

Q4's aura, half-health summon and quarter-health withdrawal all occur in
`kings_chamber`. Withdrawal is against its closed vault door; the King remains targetable.
A lethal hit wins over later phase actions, and each crossed phase latches once. No boss
phase crosses the vault barrier. Defeat atomically sets future `barrow.king_status` to
`king_slain` and produces one unique crown in the chamber through declared loot/custody.
Q4 turn-in uses that durable defeat state, without consuming or equipping the crown.
Its bound Aldric/Sedge giver remains available despite reputation; both are noncombatant
essential providers for this chapter. Turn-in enables high_pass; final acknowledgement,
not defeat/turn-in alone, completes chapter two and exports once. Q4 requires neither
magic, blessing, S28 nor rings; ordinary entry/return must work without the moon portal.

S28 needs actual crown custody and local vault discovery for first unlock. Equipped
custody counts; memory does not. Unlock consumes no crown and permanently unlatches
this one-shot seal. Later opening/closing cannot relock it; inside egress and re-entry
need no crown. Safe flooded/deep corpse return still needs its separate route proof.
The curse restricts voluntary removal/drop/give while worn, without blocking unworn
carrying or key use. M5 death transfers the real crown once and removes its effect from
the dead body. S26 blessing clears curse without consuming crown; Aldric offers it in
the public nave to either bell history. The optional rite adjusts Priory reputation,
never the immutable bell choice. Its fee/effects remain content tuning.

**New future seam, C2-M10/C2-C05:** declare the single reachable loot-key producer and
extend compiler/loader key validation only enough to prove a non-key-dependent defeat
and drop route. Reject a crown produced only inside its own locked vault. The adviser
identified static initial-key reachability as insufficient; verify that seam at briefing.
No fabricated initial crown, duplicate key or globally disabled reachability guard.

**Crown continuity, CC-M03:** explicitly permit the actually held crown's compatible
instance/provenance and curse/equipment state; no full inventory import. Keep
`memory.vault_unlatched` separate from inscription discovery. A true imported seal memory
preserves access after crown loss. A prior import never fabricates a lost/non-held crown
from king history. Only a no-prior chapter-three start places one unclaimed chamber crown,
with a latched seal and false vault memories, as declared starting fiction. Optional
unavailable vault loot cannot block completion. A separately acknowledged, versioned
post-ending checkpoint may refresh the source export before destination creation;
subsequent source changes never mutate an existing destination or its pin.

## 2. First ring from S8; matching ring in chapter three

S8 alone awards the first fen ring. S28 completes on acknowledged vault-inscription
reading, granting vault memory and a lead to the matching ring at the chapter-three
mine's drowned shrine (`flooded_level`). It neither requires nor awards a pair or a
second first ring. Chapter one's ordinary silver_ring stays distinct. Two distinct
real ring definitions/instances, `fen_ring_first` and `fen_ring_second`, establish pair
custody; memory or two copies of one ring do not. No set-bonus primitive is required.

Chapter three includes S8's old shrine puzzle. CC-M03 may transfer an explicitly declared
first-ring instance only when held at the chosen source checkpoint. Carry S8 resolution
separately: unresolved + transferred first ring is invalid; resolved + absent is valid
loss/disposition and gives no replacement award. Without prior item state, S8 remains
unresolved/available and its ring absent; vault memory defaults false. Neither optional
ring loss nor failure to own the pair blocks S28 or campaign completion. Snapshot schema,
compatibility and deduplication remain future CC-M02/03 work.

Consumers: C2-C02/C05, C2-M05/06, C3-C03 mine access/recovery and CC-M01–03/CC-C01.
This replaces the archived S28 pair promise without moving the second ring or adding
a 30th mechanic candidate.

## 3. One local Maren and lesson per artifact

Chapter two places resident Maren in the existing scriptorium and titles S25
**Words in the Scriptorium**. Books, identification and the lesson are local; Harrowgate
is not a runtime dependency. Chapter three places the single Maren in its library/reading
gallery, with no duplicate Priory Maren. An unfinished lesson remains available there;
imports carry declared knowledge/quest outcomes, without her old entity/dialogue state.

Select ward and light, with one authored ward + light exercise. S4's ward topic is not
a learned word. Already learned identities are neither charged nor granted twice,
including optional Aldric light teaching through the same acquisition semantics.
Qualification/cost/cooldown/effect tuning stays in C2-M08/09's brief; no class or spell
catalog. Q4 and vault access require no cast. Identification reveals knowledge while
real item mechanics apply throughout. Consumers: C2-C04/M06/M08/M09 and CC-M02/03/C01.

## 4. Physical jail, one body and real routes

S19 uses watch_house ↔ jail ↔ dungeon_cells, the hidden east tunnel to fence_cellar,
and its ordinary stair to fence_alley. Ashmere's watch_cell is a separate place.
There is no jail overlay, copied map/body/inventory or extra authority. Initial arrest
is local: Crown-wanted actor and bound Brann are co-located in watch_house; entry or
voluntary settlement may start one trial. Other guards may warn/direct, without a forced
escort framework. Revalidate actor/guard/location/jurisdiction; pending trial prevents
repeat arrest of that occurrence while elapsed world time continues.

Fine atomically checks/debits payment and clears wanted, without imprisoning. Failed
payment leaves the choice and funds unchanged. Jail commits one typed sentence occurrence,
adjacent custodial admission and real body transfer, then closes the door. Initial custody
is unsearched: held/worn possessions stay real, with no confiscation/escrow copies.
Confinement admits inspection, journal/readables, self-care/posture, present conversation,
internal stair and selected search/lockpick/escape; forged outward/recall/remote-service,
attack/theft/cast bypasses refuse. Health, resources and jobs continue.

Select one authored world day for the first sentence, using the normal elapsed clock,
including absence; show remaining time, without Wait/Skip. Due release uses the declared
one/two-edge route back to watch_house, validating both edges and active occurrence.
Guard assistance permits release at zero MV. Escape needs actual held picks/qualification,
opens and traverses the real tunnel, cancels that sentence, then writes a declared Crown
escape offense and Cutpurse story affiliation once. Stale sentence work cannot clear the
new wanted state. This narrow legal offense producer is separate from witnessed theft.

Admission settles due harm first and refuses dead actors. Later status death uses M5,
ends the sentence without acquittal and retains wanted; old due work cannot erase later
crime. Select public watch_house corpse-recovery anchor plus temporary re-arrest exclusion
until recovery or its explicit decline. C3-M09 must name exact M5 signals/encoding before
code; this is admission protection for recovery, without invulnerability or new resurrection.
The window finale needs the live body in jail. Cells allow ordinary return to its stair;
wanted actors outside custody get the free/wanted variant. Release/death/arrest invalidates
stale finale presentation, preserving pending Q5 and once-only current-context acknowledgement.

Consumers: C3-M07–09/C04/C05, M1/M5/M16/M19/M21/M22 and C2-M01. C3-M09 splits
custodial admission from release/escape if needed. Typed sentence/custodial operations,
confinement admission and cancellation are explicit **future** invariants, not installed
schema. Rooms, duration, hatch, provider and possession policy remain content.

## 5. Exact histories and independent legal/faction presentation

[The ending table](../LATER-ENDINGS.md) defines the selected five base histories and
separate legal/faction paragraphs, with immutable imported child/bell history. Later S7/S26
choices change reputation/affiliation, never history. Only king_slain completes Q4 and
admits Q5; waiting remains chapter-two progress. No unsupported spare/bind/depose ending.

Select a **future** single Priory/Fen reputation axis and separate Crown reputation,
each integer −10..10, default 0. These are proposed consuming M15/continuity schemas,
not installed field names or changes to the current M15 queue. S7's future Fen/Priory
choice maps to negative/positive axis adjustment; S26's rite moves toward Priory.
Magnitudes and current M15 reward contracts require explicit reconciliation at their
consumer. Archived numeric sign-producer paths are not current reachability proof.

Q5 road arrival in market_square schedules the next authored dusk. Offscreen Lantern
Night leaves completion pending indefinitely. No side quest, ring, house, trial, paid
service or optional living NPC is a prerequisite. Present at the real green/window anchor
when alive/safe and free of competing mandatory scenes, then acknowledge/export once.
High_pass does not emit chapter-three completion. Defaults never overwrite valid imports;
item defaults and imported custody follow §§1–2. CC-M01–03 must reconcile typed versioned
ports with the actual merged chapter-one export contract; no unversioned renaming.

## Implementation proof and publication

Each consuming brief uses the [existing composition/emergence rule](../archive/decisions/owner-decision-emergence-2026-09-25.md).
Future controlled behavior proofs must catch: boss entering its own locked-key vault;
circular loot-key validation bypass; relocking after crown-corpse death; duplicated ring
or default crown; absent/duplicate Maren or duplicate learned words; second body/inventory,
stale sentence clearance and forged confinement bypass; stale legal-context acknowledgement,
child collapse, invalid lost/fox, import fallback and pre-acknowledgement export.
Use independent literal expectations and actual red controls under existing test discipline.
The private planning enumeration validates only selector coverage (see table proof note),
not runtime routes, schemas, custody, saves, clock or completed independent review.
Normal required checks, fresh docs review and exact-head CI precede publication; normal
spec-first consumer slices precede implementation. No archive or active M15 edit is authorized here.
