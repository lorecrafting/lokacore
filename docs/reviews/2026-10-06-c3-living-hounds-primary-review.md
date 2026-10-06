# C3 living hounds — independent primary source review

**Verdict: CHANGES REQUIRED.** Exact source/evidence head
`a692a2b8b83bdc16ed34aa5e41d4feec7a261a47`. Fresh reviewer; authored none of
the source. Reviewed C3 core/completion and equal-time proof with published
B8, D5, D2 and the owner’s PR224 corpse-detail decision integrated.

## Requirements derived before source review

The [C3 brief](../briefs/chapter-one/chapter-one-c3-living-hounds-brief-2026-10-05.md)
and active [population](../system/mechanics.md#c3-bounded-living-hounds-selected-contract),
[cartridge](../system/cartridge.md#c3-hound-population-and-loot),
[composition](../system/protocol.md#c3-spawned-bundles-and-population-composition),
[save](../system/save.md#c3-living-population-recovery) and
[Book](../system/book-ui.md#c3-living-hound-and-loot-details) clauses require:
fixed exact slots and one current plan job; delayed fresh-generation replacement
with night-only extra-slot eligibility; exact-instance passive combat and conserved
original pelt/corpse custody; safe all-hours travel and recovery; confirmed-only,
once-only corpse pickup history with corpse return and Back across retry/remount.
The [owner’s Take decision](../decisions/owner-decision-corpse-loot-take-detail-2026-10-06.md)
is governing. Foundation/save review remains a separate opinion.

## Findings

- **C3-R1 — blocker — `mobile/app/book/Book.tsx:70`.** A remounted uncertain
  corpse Take completion restores a route only when its outcome is `read`.
  Controlled actual-component reproduction: kill a hound, open corpse then pelt,
  lose the Take COMMIT acknowledgement, unmount and remount Book with the same
  pending Game, clear the failed reads and call `pulse('active')`. Take settles,
  but the Book stack is `[]` (World), rather than the exact corpse detail
  `[108d31a9-ff68-88c5-a9c4-55932025bd2f]`. The retained test retries within the
  same mounted Book and misses this path. Restore the confirmed receipt’s corpse
  route on pending completion after remount and retain a focused component test.
- **C3-R2 — blocker — `kernel/ts/test/hounds.test.ts:168`.** The population
  regression suite does not protect night-only replacement eligibility after a
  death. Replacing the birth guard `slot > target` with
  `slot > target && row.generation === 0` leaves all eight hound tests and the
  complete non-simulator kernel unit suite green. An independent controlled route
  kills slot 5 at clock 108150: due 194550 is daytime; at the next wander 198000 the
  mutant wrongly advances to generation 2, whereas the required literal answer is
  generation 1 until next night 244800. Correct source passes that oracle, and the
  mutant fails it (`actual: 2`, `expected: 1`). Retain this distinct behavior test
  and red control. The current thirty-day case contains no fights or replacements;
  it cannot serve as the brief’s death/replacement stress proof.

## Independent validation

- `mise exec -- node --test --experimental-strip-types` on kernel hounds/population
  composition, Book hounds/polish and real-SQLite authority hounds: **28/28 pass**.
- `mise exec -- mix test test/loka/content_missing_child_test.exs
  test/loka/core/population_composition_test.exs
  test/loka/core/corpse_creation_test.exs --force`: **11/11 pass**, including
  both portable literal population answers and their differential check.
- Controlled loaded chapter starts at hours 0,6,12,18,20: actual offered actions
  take the Watch Post Tobin lesson, wear his original sword, travel to Hound Run,
  select the second same-named hound, kill it and Take its same pelt. Literal initial
  counts 6,4,4,4,6 and exact corpse result owner pass. No light or hour gate appears.
- Removing engaged-member wander suppression independently fails the real
  equal-time test; restoring source returns hound tests to **8/8 pass**.
- All seven entries in C3 `SHA256SUMS` verify. The current provisional pin is
  v0.0.28/API1.24, hash
  `eb1e069d3ab049cb389bb525ece5ad596909967dda9432ad530b861433cc177f`,
  with 140 initial IDs. A later integrated successor still requires its own pin.
- Actual diff reviewed for population, dynamic combat/death/custody, loader/compiler,
  hydration/composition and Book result owners. Ponytail Review: lean already;
  no added dependency, population ledger or behavior framework to cut.

All temporary source/test mutations were restored. Review record only.
No new browser/native session or full accumulated-head publication check ran;
the existing browser screenshot predates the remount path. These focused proofs
are not hosted CI, native certification or complete lethal/nested recovery proof.
Both findings remain open; save/foundation concerns are owned by the separate opinion.


## Scoped fix recheck — APPROVE

Exact final fix source `2dbf55b51cf7ae6bf930a550bb2dd61327a4127e`, frozen evidence
`ea3e39166a7acdb15f34a4cb9d5cf224270ba58f`. The evidence commit changes no
source. Scope: C3-R1/C3-R2 fixes and their direct Book/result/recovery callers;
S1/S2 and the `runtime/proposal.ts` audit retain their separate reviewers.

- **C3-R1 closed.** Remounted pending Take completion binds the exact confirmed
  saved command’s corpse pickup before restoring its currently reachable detail.
  The retained real component case checks the selected corpse route, one local
  pickup, no World pickup, original pelt in Carrying and Leave to World. Existing
  corpse Take retry/refusal/history and D2 remounted Read paths still pass.
- **C3-R2 closed.** The retained controlled extra-slot death pins fatal clock 108150,
  due 194550, generation 1 at daytime 198000 and a fresh generation 2 at night 244800.
  It protects the missing night-only replacement case without duplicating the
  existing base-slot delay/loot test. The old thirty-day case remains a no-kill
  successor-bound check; it is not claimed as death/replacement stress proof.

Independent exact-head command:
`mise exec -- node --test --experimental-strip-types
--test-name-pattern='extra-slot|remounted pending pelt|corpse Contents|Book restores'
kernel/ts/test/hounds.test.ts mobile/app/book/polish.test.ts
mobile/app/book/priory.test.ts`: **5/5 pass**. Independently replanting the original
night-only eligibility break fails (`generation 2` versus `generation 1`), and
misrouting the remounted Take completion again fails (`[]` versus the selected
corpse route). Both focused controls exit 1; restoring source returns **5/5 pass**.
No source edit is retained.

All 12 C3 evidence checksums match. The retained final full active line passes 358
Elixir tests and reaches the remaining contract/kernel/docs/architecture/size/format
checks successfully; it was inspected, not rerun by this scoped review. The
optional broad mobile run’s predecessor-pin and pre-existing Combat Flee failures
remain disclosed in the evidence, outside these two fixes. Final ordered release
pins, hosted CI and fresh browser/native proof remain separate publication work.
Ponytail Review: lean; exact saved receipt routing and one distinct behavioral
regression are sufficient. No primary finding remains open.


## B9 integrated successor carryover — APPROVE

Exact source `f96e0245ab6086dacfaa276e338405f1710a0b8d`, frozen evidence
`33163a1bca6de9d8b5e0e0bf0cf45134542b77fb`. Both published B9 predecessor
`b9dd1d9c80cf25d46823f0c3df28830e2af8afdb` and approved strict C3 source
`2dbf55b51cf7ae6bf930a550bb2dd61327a4127e` are ancestors. The evidence commit
changes no source. Scope: R1/R2 carryover, shared Book/dream/navigation and
receipt owners, successor pin and evidence; no broad re-review of published B9.

**R1/R2 remain closed; no findings.** The merge retains the exact receipt-bound
remounted corpse Take route and the night-only replacement branch/regression.
B9’s dream pages remain nested under the real bed, while corpse pickup remains
owned by its real corpse. The shared navigation checks combat, chapter and room
changes before dream/detail continuity; exact saved command routing keeps dream
and corpse receipt owners distinct. Frozen B9 v028 answers remain byte-for-byte
unchanged.

Independent current-head proof:

- Standard-library Python reconstruction from frozen B9 v028 plus the reviewed
  C3 content delta matches the complete v029 value, canonical bytes and SHA-256
  `f49de549377f7068fac51896ccd1f177241712ed064baaef0fefc14c6c05d67e`.
  Independent Python UUID allocation matches all 140 frozen answers and all 140
  actual fresh-world identities. Manifest and installed API are 1.25; release
  is 0.0.29. `mise exec -- mix loka.compile` emits the exact independent artifact.
- Kernel hounds, Book hounds/dream, real-SQLite hounds/dream and app chapter tests:
  **25/25 pass**. Entire touched Book polish suite: **15/15 pass**, including
  corpse Take retry/remount and Combat Flee. The two existing D2 remounted Read
  cases also pass. No old app-pin mismatch remains in the checked app path.
- A temporary copy of the real Book dream harness outside the repository runs
  both routes against the actual v029 successor, with its independently pinned
  bed identity: paid Rest, nested Close/Resume, choice, acknowledgement and cold
  World resume; uncertain paid Rest remount opens only after settlement.
  **2/2 pass**. This checks integrated data as well as current code; the original
  standalone B9 tests retain their frozen v028 consumer.
- All 13 C3 evidence hashes match. The retained exact-head full active line is
  green with 360 Elixir tests and the remaining contract/kernel/docs/architecture/
  size/format checks; inspected rather than rerun for this carryover review.
  `git diff --check` passes. No source edit or new source mutant was made.

The earlier provisional release-pin carry is resolved. Ponytail Review: lean;
no new framework or dependency, only the declared successor data and existing
Book owners. This carries forward the primary approval; hosted publication checks
and browser/native proof retain their separate scope. No owner save, preview or
native session was opened.
