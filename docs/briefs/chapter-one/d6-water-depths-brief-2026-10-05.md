# D6 — Real underwater access, qualified swim and recoverable drowning

> **Selected PM contract, 2026-10-06.** The [PM decision](../../decisions/pm-decision-d6-water-depths-2026-10-06.md) adopts the replacement deadline, admission, loot and recovery policy. Historical local reviews cover only their old heads; fresh independent scoped review and publication remain pending. This planning adoption claims no source implementation or player proof.

Proposed source branch: `chapter1/d6-water-depths` (not created by this task).

## Goal and exact dependencies

Add real optional `well_bottom` and `pool_bottom`, with reciprocal shaft/bank
Down and free Up. D6's two rooms do not complete unmerged D3/D4 room work or
certify all 57 rooms. C6/S27 is never the first way to acquire its required swim.
Governors: [selected mechanics](../../system/mechanics.md#d6-water-depths-and-owned-corpse-recovery-selected-pending-implementation),
[cartridge](../../system/cartridge.md#d6-bottom-rooms-and-water-tuning-selected-pending-implementation),
[protocol](../../system/protocol.md#d6-water-movement-and-corpse-selection),
[save](../../system/save.md#d6-water-and-owned-corpse-recovery),
[Book](../../system/book-ui.md#d6-water-exits-and-chapel-recovery), archived00a
§§2/5/7/11, no-wait and Legend's reachable-death-recovery gate.

Re-pinned published main **815f66f9039ca22f80d44112a1ff966eadb8381e** includes D1
[#231](https://github.com/lorecrafting/lokacore/pull/231), merge **c20addb0**,
chapter **0.0.30/API1.26**, hash **dbff57ba20305dffa4a0679ab58d480574fbc3fd93fddeb3bf08d48d78e057b9**,
**149 starting IDs**. Actual Sedge free lesson and cold reopen are proved;
B4/D5/C1/carrying/death/transport source findings and consumers are in the
[source re-pin](../../decisions/pm-decision-d6-water-depths-2026-10-06.md#published-dependency-re-pin).
Do not regenerate frozen v030 fixtures. Re-pin again after intervening D4/C4
publication before assignment. D6 source/successor/API/hash/IDs/PR are **null**.

## Adopted contract

Use D1's acquired swim and current vacuous qualification; no new CON/DEX gate,
percentage or teaching action. Entry requires living/standing/no encounter/no
bound following Wren, load≤6000g and MV≥10; debit 10 MV replaces ordinary move fare.
A living actor below surfaces free regardless of skill/load/MV/posture/light.
Both invoke `action_key: "move"`, `target_ids: []`, input direction `down`/`up`.
One read-only exact-edge admission serves GameView and direct execution, including
an actual captured Up invocation after eligibility changes.

One generation/absolute deadline/one due occurrence owns danger; surface and
every death invalidate it. The [selected deadline](../../decisions/pm-decision-d6-water-depths-2026-10-06.md#selected-deadline-and-rejected-timer-options)
is 6000 logical seconds (120 real seconds at rate 50), with no periodic drain and
no drowning from MV 0 alone. Expiry settles before equal-time input, including Up,
then positive-to-zero HP and existing same-body corpse/Chapel return commit once.
Null killer/credit, no fake NPC/loot. Ordinary recovery remains unchanged. Prior
5 MV/150-second timing is rejected: MV 10 entry can drown after three real seconds.

At Chapel, use `recover_corpse`: actual selected owned nonempty corpse
currently in `well_bottom` or `pool_bottom`,
`target_ids: [corpse_id]`, `input: {}`; transfer its direct roots to held body
custody once, preserve descendants and empty corpse, permit forced overload,
no auto-equip or restored rewards/deadlines. Refuse foreign/forged/empty corpses.
Isle corpses are ineligible: preserve D1's fare-waived physical return
and prove an owned nonempty isle corpse offers no Chapel recovery. Both dark bottoms have known Up; ordinary loot uses actual B4 light.
The PM decision adopts duration, item values and the underwater-only Chapel fallback;
copy follows the selected Book contract.
Show remaining time and free Up on every underwater page, including details.

## Composition and scope

Movement owns transfer/entry; skills reads usable acquisition; containment owns
all nested/worn mass and existing root transfers; resources owns debit/recovery/
HP loss; water owns only occupancy/deadline/current occurrence; death owns corpse
and same-body return; host commits changed rows plus receipt before adoption.
Keep budget/structural-sharing discipline and ordinary elapsed/job ordering;
water expiry must settle before equal-time input as specified above.
Inspect actual current job and save owners before choosing their new typed shape.

In: two bottoms, real old coin/chest/ring/initials, ordinary dark item/container
interactions, water declaration/admission/jobs, typed drowning and narrow Chapel
recovery, necessary compiler/loader/protocol/save/projection/Book seams. Out: new
sunken lantern, wet/chill/drift/ghost physics, tides, swim escort, percentages/XP,
ancestry stats, fishing, sale/chapter-two effects, global terrain rewrite.

## Required source proof

Name each realistic break; expected answers are literal, fixture or hand-checked,
never derived by the implementation. First apply mutants to existing focused
suite; add a new case only for a distinct missing regression.

- Admission: unlearned, load 6001g, MV 9, seated/encounter/following Wren refuse;
  learned/load 6000g/MV 10 enters at MV 0. Failed admission changes nothing. Captured
  Up works at MV 0, overload, missing swim, altered posture and darkness; no second
  ordinary movement debit. Main rescue remains dry/all-hours.
- Timing: duration 6000/rate 50, clock 64800→deadline 70800; at 70799 Up succeeds,
  at 70800 expiry wins. Zero MV with time remaining is safe to surface. Prove
  stale/canceled/re-entry generations, unchanged non-standing recovery, elapsed
  catch-up/reopen and exactly one current expiry. Drowning creates one corpse/
  actual roots, same body/Chapel and no credit; all deaths invalidate water.
- Custody: actual owned underwater corpse, nested light/fare/key, original roots,
  held return, mass>12000g forced overload, multiple eligible corpse selection,
  foreign/forged/empty/isle refusal, and D1 waiver still available for an owned
  nonempty isle corpse.
- Real SQLite: cold reopen after each committed entry/surface/expiry/recovery;
  failed COMMIT, uncertain committed and absent branches, lost acknowledgment,
  replay, later item movement/second death and malformed new rows yielding typed
  `save_corrupt` without reset/repair. No duplicate roots or split custody.
- Red controls: over-load entry, ordinary fare/posture blocking Up, stale drowning,
  wrong corpse owner, copy instead of transfer and malformed typed state. Restore
  green after each real mutation; run schema mutant sweep for changed contracts.
- Later isolated browser Book: free lesson before S27, each bottom, real chest/coin,
  free surface, remaining time on every bottom detail, controlled expiry, Chapel
  selection/original belongings and cold refresh. Existing status/exit warnings, pending/refusal/history/Back controls;
  actual SQLite fault proof is separate. No preview is authorized by this planning adoption.

Use `mise exec --`, relevant mechanics/storage/contracts lessons, normal focused
kernel/host/compiler/Book checks and one final full gate with exact-head CI. Fresh
primary plus required save/protocol/foundation opinion; Ponytail and correctness
self-review before handoff. Native/mobile/simulator/owner saves stay paused.

Stop before source for missing fresh scoped adoption approval/publication,
absent typed state/cause/custody contract, unsafe return,
frozen-fixture conflict, incompatible latest published dependencies or broader
framework/scope. Split at a complete safe player outcome, never bottom placeholders.
