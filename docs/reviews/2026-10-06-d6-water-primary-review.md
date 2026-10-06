# D6 provisional water depths — primary source review

Reviewed head: `4ea7ad6518780604aaf881849e9747578e7d4f2f`; base published source: `815f66f9039ca22f80d44112a1ff966eadb8381e`; selected contract plus captured-Surface amendment through `4892de1f`.

Independent reviewer authored none of the source, contract or developer evidence. No PR/publication is claimed.

## Requirements derived before source diff

- Exact reciprocal authored bottom edges share action/View admission. Acquired usable swim, living/standing/no encounter/no bound following Wren, nested/worn mass ≤6000g and MV≥10 admit entry and debit only 10 MV. All refused entries remain atomic. Living Up costs zero regardless of changed skill, mass, MV, posture or light.
- Entry owns one generation/deadline/current job. Duration 6000 at rate 50 means 120 real seconds. Expiry at equality precedes player input; MV zero alone is safe. Surface and every death invalidate the generation; stale/re-entry jobs cannot drown another occupancy. Captured Up retains generation through elapsed settlement and cannot become Chapel Up.
- Expiry applies positive-to-zero HP and the existing fatal sequence atomically: one conserved corpse, actual held/worn roots and descendants, same body at Chapel, null killer/credit, typed drowning.
- Chapel recovery selects only a real owned nonempty corpse currently in an authored bottom, transfers existing direct roots to held custody once, preserves descendants/empty corpse, allows forced overload, and excludes isle corpses so physical fare-waived recovery survives.
- Both bottoms are dark with known Up and actual conserved authored loot; the rescue remains dry/all hours. Confirmed remaining time and captured free Up appear on every underwater Book page.
- Changed-row SQLite persistence preserves each committed intermediate, original deadlines, receipts and historical custody through later transfers/deaths; genuine failed/unknown COMMIT and lost-ack replay fence input; malformed new rows yield save_corrupt without repair/reset/deletion.
- Typed compiler/loader/wire/foundation contracts and independent literal/randomized proofs remain bounded; frozen v030 pins stay unchanged. No recurring drain, extra clock, broad terrain framework or compatibility machinery.

## Verdict

**APPROVE — provisional source candidate only. No open findings.**

This verdict applies to the named source/evidence head against the selected contract. It does not approve publication or close a milestone gate. Successor release/API/hash/starting IDs, reconciliation with subsequently published D4/C4/D3/shared seams, independent save/protocol/foundation opinion, browser proof, accumulated active gate and exact-head hosted CI remain pending.

## Source and composition review

Reviewed the complete D6 change against published base, separating the selected planning amendments through `4892de1f` from implementation `3bc06262` and evidence head `4ea7ad65`.

- `kernel/ts/src/mechanics/water/shared.ts` owns only paired-edge admission, occupancy generation and its one absolute occurrence. `movement/sequence.ts` uses that same read-only admission as `view/view.ts`; exact `move` action-key admission preserves narrowed cartridge overrides. Entry replaces ordinary fare. Free Surface bypasses ordinary posture/fare/skill/mass admission. Existing escort, encounter closure, patrol and room-entry evidence remain composed.
- `water/expiry.ts` completes only the current bound occurrence, applies real positive-to-zero HP at the job's due clock and joins the existing `death/sequence.ts`. The latter clears water on every player death, retaining its original root transfer, descendants, same body/shrine and restored-resource owner. Ordinary proposal due-job sorting is unchanged; elapsed preflight settles equality before player input. `mobile/authority/local-story/invocation.ts` retains the captured Surface generation while allowing same-generation elapsed settlement.
- `containment/recovery.ts` and `view/water.ts` share actual death identity/owner/body/current-bottom/nonempty-root admission. Transfers preserve roots and descendants, permit forced overload and leave empty corpse identity. Existing accepted-receipt replay validates historical custody without comparing old transfers to later current custody. The D1 physical isle recovery test additionally rejects Chapel offers and still completes fare-waived recovery of the original belongings.
- Compiler/loader enforce authored paired routes, sole unbarred bottom Up, required owners and real-elapsed content. New portable composition and independent invariant checks have literal rows and randomized cross-kernel comparison. Changed schemas and generated contracts are consistent; published v030 frozen fixtures are unchanged.
- Actual Chapter 1 source adds only the two dark bottoms, reciprocal routes, 10g old coin, 2000g one-item chest and its 5g ring, initials and cartridge-owned water tuning. It preserves Sedge's acquired-swim lesson and dry rescue route. `mobile/app/book/Body.tsx` places confirmed remaining seconds and the captured Surface control above the existing page dispatch, including detail pages; corpse choices bind actual IDs and confirmed recovery narration. Headless presenter checks support this source inspection; they do not prove browser rendering or reading usability.

Ponytail Review: lean already. Existing movement/skill/mass/resource/job/fatal/custody/receipt primitives carry the behavior; the narrow water owner and recovery helper have actual consumers. No dependency, recurring timer, duplicate gameplay writer, terrain framework or recovery ledger was added. The empty-corpse holder index preserves the existing query budget without rescanning custody for each empty historical corpse. No actionable complexity finding.

## Independent checks and red controls

All commands ran under `mise exec --` in the reviewer's isolated checkout. Source and generated files were restored after each plant; only this record/index are committed.

| Check | Result |
|---|---|
| `node --test kernel/ts/test/water*.test.ts mobile/authority/local-story/water.test.ts kernel/ts/test/world.test.ts kernel/ts/test/combat_flee.test.ts kernel/ts/test/death.test.ts kernel/ts/test/transport.test.ts mobile/authority/local-story/transport.test.ts` | Exit 0; 54 passed, zero failures. |
| `mix test --force test/loka/core/water_contracts_test.exs test/loka/core/water_composition_test.exs test/loka/content_water_test.exs` | Exit 0; five passed, including 13 literal vectors and 200 randomized differential inputs. |
| `npm run typecheck` in `kernel/ts` | Exit 0; source/test/play checks pass. |
| `elixir bin/contracts.exs --check` | Exit 0. |
| Retained developer evidence `shasum -a 256 -c SHA256SUMS` | Exit 0; all 58 retained-file hashes verify. |
| Independent schema guard-removal sweep | Direct sweep exits 1 intentionally: 51 of 64 guard removals change the literal fixture answers; all 13 remaining removals independently fail contract generation. Zero surviving combined guards. |
| Remove complete current-occurrence matching from `water/expiry.ts` | Exit 1; `captured free Up survives changed eligibility and old generations cannot drown reentry` fails, detecting a stale occurrence affecting another dive. |
| Disable captured Surface generation check in authority invocation preflight | Exit 1; `water entry/surface/expiry/recovery reopen with original deadline and custody, then replay once` fails, detecting old Surface being interpreted after expiry. |
| Restore source and rerun focused water/compiler/contract/SQLite/presenter tests | Exit 0; 21 passed, zero failures. |
| `git diff --check` after restoration | Exit 0; no source diff remains. |

An exploratory removal of only the redundant expiry generation comparison stays green because exact current job identity, body, deadline and custody still reject the old occurrence; it introduces no behavioral stale-occurrence break on valid committed state. Removing the complete occurrence binding above gives the meaningful red control. The first Node attempt occurred before Mix dependencies were installed and failed during fixture compilation; after dependencies/compilation, the full independent focused run passes as recorded above.

The real-SQLite checks exercise entry/surface/expiry/recovery intermediate reopen, original elapsed debt, genuine deferred-constraint COMMIT failure, uncertain absent/committed outcomes, lost acknowledgement, pending fences, receipt replay, later item movement, second death, multiple corpse selection and malformed rows with unchanged on-disk progress. Controlled teacher/gear/hazard locations are declared fixtures; no native session, owner save, preview or hosted check was run.

