# C4 hound response — independent primary review

**CHANGES REQUIRED.** Exact provisional source
`252eb45624a27d5eb90c89a2eff7159e09f9b613`, evidence/head
`11fa757947061b4fa077847d85c3a05b1cb100cf`, reviewed readiness base
`b092d5a3a7587da541e134e562e425a5c16ce0ec` (published C3/status ancestry).
The reviewer authored none of C4 and worked in a separate detached worktree.
This review commit changes only its record and index; source and developer checkout
remain untouched.

Read the [brief](../briefs/chapter-one/chapter-one-c4-hound-behavior-brief-2026-10-05.md),
active [mechanics](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract),
[protocol](../system/protocol.md#c4-pack-encounter-and-flight-composition),
[declarations](../system/cartridge.md#c4-pack-response-and-wounded-flight),
[save](../system/save.md#c4-pack-and-flight-recovery) and
[Book](../system/book-ui.md#c4-pack-response-and-enemy-flight-details), with
AGENTS/workflow and the relevant mechanics/storage/contracts/mobile/evidence lessons.
The actual diff received correctness and Ponytail reviews independently of the
reported developer result.

## Findings

### C4-R1 — blocker — even-round helper flight removes the player opportunity

`kernel/ts/src/mechanics/combat/round.ts:154` at the reviewed source; the shared
selected-member presence test at line 130 also needs to distinguish opportunities.
The flight branch breaks out of both opportunities. On an even round, a wounded
selected helper can flee before the standing player attacks a healthy unchanged
primary. The contract retains the player-vs-primary opportunity; flight replaces
only that selected opponent's attack.

Independent controlled reproduction uses two co-present current hounds, 100%
accuracy, fixed damage 1 and no defense. Attack H2, then execute the first odd
round: primary H2 has HP7 and cursor H1. Set helper H1 to HP1 at the accepted
second-round prefix, keeping primary H2 healthy. At due clock 64810, H1 correctly
flies to Adder Nest with its original pelt, but **zero attack results** are emitted
and H2 remains HP7. The literal answer is one player attack on H2, HP6 and one
accuracy draw. The existing 14 pack tests pass; the separate appended independent
case fails on that HP assertion. No repository source was changed.

Keep the player opportunity after a selected helper's flight while opponents
remain; revalidate the actual primary/presence before that opportunity, repair a
removed primary and close only an empty occurrence. Preserve the locked opponent's
single slot and the existing selected-death/no-substitution rule. Retain a focused
literal regression and demonstrate red then restored green.

### C4-R2 — blocker — controls can pass while helpers never attack

`kernel/ts/test/c4_pack.test.ts:188` at the reviewed source. The named round control
checks round/cursor/job but does not prove that the helper supplies its real attack
opportunity. Mutation of the pack-round attack call from `attacker` to
`attacker === row.body_id ? attacker : current.npc_id` preserves cursor rotation
while making every NPC turn use the primary. All **25** retained pack, pack-composition,
single-combat and SQLite cases still pass under this realistic break.

A separate two-round literal probe with 100% accuracy, fixed damage 1 and no defense
expects actual attacker IDs `[P,H2]` then `[H1,P]`, final P8/H2=6/H1=8 and frozen
RNG S4 `[27274249,25704967,31982592,12605441]`. It passes unmodified source and fails
the substitution mutant at the second-round attacker assertion. Retain the minimum
same-layer behavior control that catches this break; cursor state alone is not
proof of assistance. This is a distinct regression from R1: no member is wounded
or fleeing in this case.

### C4-R3 — should-fix — claimed retained evidence is unavailable at the frozen head

`docs/evidence/2026-10-06-c4-hound-behavior/README.md:20` at the reviewed head says
the failed gate result is retained, and its tables claim red/green runs. The folder
contains only this README: no raw log, checksum inventory or verification artifact
is committed. The evidence lessons require retained raw output to be hashed.
Consequently this review can independently reproduce bounded behavior, but cannot
inspect or verify the claimed retained gate/red-control results. Preserve the actual
failed gate, focused red/green and restored outputs with their checksum inventory
and verification; link them from the record. Do not replace failed evidence with
an aggregate success claim. Parent/developer confirmed this evidence fix is pending.

## Other reviewed behavior and independent proof

Admission snapshots the exact bounded plan slots, canonical current-generation
co-present living members and excludes already engaged helpers. The primary starts
as the attacked instance. No public action, entry, reading or night initiates an
encounter automatically. Existing opportunity resolution, one round job, pruning,
whole-pack Flee/death and same-item corpse custody are reused. Strict flight chooses
an existing legal in-area exit without player fare or RNG; same-group custody and
slot stamp prevent equal-time population wandering from undoing flight. Different
writer groups retain ordinary conflicts. Generic portable guards and independent
observations check roster/primary/cursor transitions rather than trusting only the
story consumer. Save/foundation audit remains separately owned.

Independent bounded results:

- The retained focused TypeScript/Book/SQLite line passes **39/39** on exact source.
  Portable composition and original encounter tests pass **7/7 ExUnit**, including
  their literal fixtures and differential checks. These greens do not close R1/R2.
- Source-free import-hook controls on pinned Node 24.21.0 independently fail the
  strict-threshold, same-clock flight/wander and engagement/wander tests at their
  behavioral assertions. The helper-substitution control instead survives the
  retained 25-case subset; the independent actual-attacker probe fails it and
  restores **15/15** on unmodified source. The independent even-flight probe has
  **14 pass/1 fail** on original source, documenting R1.
- Independently reconstructed provisional artifact bytes with Python JSON/SHA from
  unchanged published C3 v029 plus the two authored C4 content deltas, matching the
  compiled artifact. Its observed content hash is
  `c39f120e18f9a412e275f48d37c184a0d038ba1b9659a46b4d27c7eeb91245e0`;
  this is an observed provisional build answer, not an assigned successor release.
  Published C3 v029 fixture bytes remain unchanged.
- Actual compiled-source Game/presenter routes pass at **19:59, 20:00, 23:00 and
  06:00**: C1 lesson and rusty sword, exact second-instance Attack, real corpse,
  whole-pack Flee, passive return and Take of the same original corpse pelt.
  Day/night starts admit the current four/six hounds without waiting for replacement.
  This is headless component/session behavior, not browser layout proof.
- `git diff --check` passes. No temporary source mutation or retained evidence byte
  was written by this review. No broad publication gate was rerun.

Ponytail Review: no separate complexity finding. Reuse of C3 slots, existing combat,
movement/death, delta algebra and Book is appropriate; no extra job, stock ledger,
generic AI framework, dependency or compatibility adapter was introduced. Correct
R1 in the shared round flow and add only the distinct missing controls.

## Provisional boundaries

The source still carries C3 v029/API1.25 and its published 140-ID fixture while
changing content. Its compiled pin failure is expected provisional dependency;
this review does not approve that pin as a final C4 release. Published D1 integration,
independent successor release/API/hash/ID answers, the combined full gate and a
scoped carryover review remain required after findings close. Preserve C3 corpse
Take/detail recovery and D1's shared World/Combat routing during integration.
The evidence README's full-gate result is developer-reported and unavailable as
raw retained bytes at this exact head. Browser/native/owner-save work was not run.
