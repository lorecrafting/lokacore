# D6 water depths — independent save/protocol second opinion

Exact provisional head: `4ea7ad6518780604aaf881849e9747578e7d4f2f`.
Implementation: `3bc06262`, based on the selected contract and published D1.
Independent second opinion; authored none of D6. Verdict: **APPROVE**.
This supplements the required primary review.

Governing requirements: [D6 brief](../briefs/chapter-one/d6-water-depths-brief-2026-10-05.md), [selected decision](../decisions/pm-decision-d6-water-depths-2026-10-06.md), [mechanics](../system/mechanics.md#d6-water-depths-and-owned-corpse-recovery-selected-pending-implementation), [protocol](../system/protocol.md#d6-water-movement-and-corpse-selection), [save](../system/save.md#d6-water-and-owned-corpse-recovery), and [storage](../lessons/storage.md)/[contract](../lessons/contracts.md) lessons.

- Entry commits debit, body custody, generation, original absolute deadline, one bound occurrence, room-entry evidence, head and receipt together. Reopen and fractional recovery never renew danger.
- Expiry at equality precedes input; applied positive-to-zero HP, typed drowning, original held/worn roots, same-body Chapel return and generation invalidation form one accepted proposal. Every death invalidates water; stale occurrences cannot kill a later dive.
- Chapel selects an actual actor-owned nonempty underwater corpse. Original roots transfer once to held custody, preserving descendants, empty corpse and forced overload. Foreign, forged, empty and isle corpses refuse.
- Failed and both uncertain COMMIT branches leave memory all-prior until confirmation. Replay writes nothing twice. Accepted historical actor, event, quest, fact, custody and cartridge evidence remains valid after later movement or death; malformed evidence refuses without repair/deletion.

## Findings

None in this scope. The changed-row mapping includes actor-keyed water and retains existing resource, container, created-identity, job, fact and quest rows, with head/receipt in the same transaction. Expiry completes its occurrence before the fatal sequence; the sequence clears occupancy and restores the same body. The recovery proposal contains direct-root transfers from the selected corpse, without new entities, rewards, equipment restoration or a second recovery ledger.

`store.load` validates typed occupancy/current-job consistency before receipt recovery. Water independently activates the existing revision-ordered accepted-history replay. Replayed commands prove the original admission, full decision/events and final state against the pinned cartridge/context/seed; later legal custody changes do not replace historical source/destination evidence. Reconciled adoption uses the same loader. The new Surface reservation compares occupancy generation after elapsed settlement, returning `stale_view` after death while permitting same-generation free Up.

## Independent proof

| Check | Result |
| --- | --- |
| `mise exec -- node --test kernel/ts/test/water*.test.ts mobile/authority/local-story/water.test.ts` | 21/21 pass; restored suite also 21/21. Includes file-backed cold reopen after entry/surface/expiry/recovery, original deadlines, two selected corpses, nested roots, overload, historical movement, expiry COMMIT fencing, replay and Book projection. |
| `mise exec -- mix test --force test/loka/core/water_contracts_test.exs test/loka/core/water_composition_test.exs test/loka/content_water_test.exs` | 5/5 pass, including thirteen literal and 200 randomized composition inputs. |
| Additional file-backed SQLite matrix | Nine entry/surface/recovery cases across known failed COMMIT, uncertain absent COMMIT and committed lost acknowledgement pass. Uses actual deferred foreign-key failure and actual connection close/reopen. Memory stays all-prior until confirmation; exact retry and reopened replay preserve all-next state and one occurrence/transfer. |
| Additional file-backed corruption controls | Seventeen altered inputs return `save_corrupt` with unchanged altered progress rows: command/receipt actors, scope/revision/command identity; death event actor/context/cause/room/credit/identity; corpse origin evidence; selected recovery target, transfer destination or omitted root; learned fact and malformed quest scope. |
| Surface-generation red control | Remove the post-settlement generation comparison: the focused cold-reopen/expiry test fails, reporting `saved` instead of `stale_view`. Source restored. |
| Corpse-owner red control | Remove exact death-origin owner comparison: the focused foreign-corpse test fails because a recovery offer appears. Source restored. |
| New schema guard sweep | Independently rerun all 64 removals: 51 caught by literal wire inputs; the remaining thirteen rejected by contract generation. Zero survivors. The direct fixture-only sweep exits 1 for those thirteen expected generator cases; the combined sweep passes. All schemas/generated outputs restored. |

Ponytail Review: lean already. Existing movement, resources, jobs, fatal sequence, containment and accepted receipt replay serve the concrete consumer. No extra clock, recurring drain, dependency, ledger or per-action whole-state copy was added. Actual diff self-review found no correctness or complexity finding. Review controls were confined to an isolated checkout and restored; this commit changes only this record and its index.

This approves the exact provisional behavior in the save/protocol scope. Intervening D4/C4/D3 and shared-seam reconciliation, independent final successor API/release/hash/ID pins, final accumulated active checks and exact-head hosted CI/publication remain pending. Actual browser Book navigation, details/remaining seconds/free Surface, controlled expiry, selected original belongings and cold-refresh proof remain pending. No hosted publication, browser/native session or owner-save access is claimed.
