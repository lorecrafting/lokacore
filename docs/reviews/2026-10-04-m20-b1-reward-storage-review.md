# M20-B1 atomic reward and usable storage — independent review

PR: #171. Reviewed commit: `6061cbc80a853a2e920148e556cc04411f42904d`.

## Requirements derived before reading the diff

- Five actual M6 deaths preserve independent typed credits before acceptance; resolving Maud transfers the original directly held key, adjusts bounded trust, assigns cleared, and resolves quest/choice atomically. Current objective, terminal status, live/present bound NPC, custody and 12000g carry are revalidated before effects; equality fits and overflow refuses the whole decision.
- Dialogue adjustment uses safe checked addition, sequence-local current values and authored bounds, then existing writer0 assignment; corrupt or reserved values fault. Existing acquisition/reaction joining remains intact.
- Put takes a concrete inventory-item/container pair, shares legality with projection, rejects wrong custody, inaccessible/closed/locked/full/cyclic destinations, charges enumeration and inspection to the existing query budget, and preserves item identity through ordinary Book invocation and save/reopen.
- Elixir compiler and TypeScript loader agree on references, reserved writes, API1.7 new vocabulary and narrowly reachable receive keys. Valid legacy artifacts and sampler 0.0.9/API1.6 retain compatibility and unchanged identity.
- Existing changed-row transaction saves all reward/storage effects with head and receipt; actual SQLite rollback, failed COMMIT and lost acknowledgement preserve prior/all-next state and fencing. No owner save or simulator intervention, new save format or foundation operation.

## Verdict

**CHANGES REQUIRED** — M20B1-R1 remains open.

## Findings

- **M20B1-R1 — blocker:** `kernel/ts/src/content/cartridge_dialogues.ts:84` and
  `lib/loka/content/dialogues.ex:270`: the API1.7 vocabulary detector inspects standalone
  action definitions but misses room action contributions. On the unchanged API1.6 sampler,
  author `rooms/drowned_lantern.json` with
  `"actions": [{"op": "union", "actions": ["put"]}]`. Both the compiler and the loader
  accept it, despite the explicitly authored command being unavailable on API1.6. This violates
  [Compiler](../system/cartridge.md#compiler) and the
  [PM compatibility clause](../decisions/pm-decision-m20-b1-reward-storage-2026-10-04.md).
  Include room contributions that resolve to the engine Put command in both gates; retain
  implicit installed Put for unchanged older cartridges. Add a shared controlled regression
  that rejects the room-only authored case below 1.7 and accepts it at 1.7.

## Independent verification

- Requirements above were written before reading implementation diffs. Reviewed real M6
  credit production through preacceptance, reward writer0 lowering, acquisition-quest joining,
  custody/life/presence/carry admission, safe bounded adjustment, Put pairs, Book freshness and
  changed-row SQLite save/fence/reconciliation. No named-content kernel branch or new storage
  machinery found. Frozen sampler content is unchanged; the permitted invalid-operation
  diagnostic change matches the new discriminator.
- Focused compiler/schema tests: 4 passed. Focused kernel/content/Put/SQLite/Book tests:
  16 passed. Existing cartridge/dialogue/quest/fact/barrier/invocation suites: 131 passed.
  These exercise actual file-backed rollback, deferred-FK failed COMMIT, lost acknowledgement,
  physical reopen and identity-preserving retrieval.
- Four independent temporary mutations failed existing tests: skip receive carrying
  (11901+100 wrongly accepted); replace trust addition with the amount (3+5 gives 5);
  remove Put lid classification (locked returns not_present instead of exit_locked);
  drop Book's second target (projected pair lost). Restored focused suite: 16 passed.
- Additional controlled persisted corruption: insert JSON null for saved trust before reward,
  reopen and choose. Result is precondition_failed with unchanged head, receipt count and
  corrupt row; it is not silently repaired. The room-only API gate probe above fails its
  expected rejection in the loader and independently compiles successfully in Elixir.
- Ponytail Review: no unnecessary abstraction, dependency or duplicate storage path to cut.
  Required trust-boundary checks remain necessary. No owner save or Simulator was used.

## Round 1 PM disposition: superseding owner policy

M20B1-R1 is **superseded**, not repaired by extending the detector. The
[owner's pre-production decision](../decisions/owner-decision-preproduction-compatibility-2026-10-04.md)
removes B1's feature-specific API compatibility requirement. The revised Compiler clause
keeps current API1.7 declarations, generic manifest validation and exact save-pin refusal;
the B1 detectors and their focused compatibility tests are removed.

The original finding and verdict above record the reviewed head and remain historical.
**Broad contract re-review requested** against the revised policy/spec and implementation;
this disposition is not reviewer approval.

## Broad contract re-review — source head 3ab0d23799b1f707dbc018b0b0b86ed0a3c2c1ce

Re-derived requirements before the implementation diff: the explicit owner decision removes
B1's feature-specific API1.7 rejection requirement, including room-only authored Put. Current
reward/storage content still declares API1.7. Generic manifest range/schema validation, semantic
role/type/reserved-fact checks, frozen conformance fixtures and exact save-pin refusal remain.
No save may be silently retargeted or deleted. The atomic reward, bounded adjustment, Put pair,
query budget, Book freshness, changed-row transaction and recovery requirements above still hold.

**APPROVE** at `3ab0d23799b1f707dbc018b0b0b86ed0a3c2c1ce`. No open findings.

- **M20B1-R1 superseded:** the explicit owner decision and amended governing specification
  remove its version-gating requirement. Accepting the former room-only case is now allowed.
  This closes the finding by a legitimate contract change, not by claiming the original
  detector was correct. The historical finding and initial verdict above remain intact.
- Inspected the complete revision diff and direct validation callers. Only B1 feature-version
  detection and its focused compatibility expectations were removed. Current semantic
  references, role/type/bounds/reserved-write guards and generic manifest/schema validation
  remain. Core reward/Put/Book/save implementation and protocol fixtures are byte-unchanged
  from the initially reviewed source head; no save migration or retargeting fallback was added.
- Re-ran compiler, current reward fixture and shared schema tests plus general content tests:
  **27 passed**. Current reward/content/Put/Book/SQLite, generic cartridge validation and saved
  release handling: **108 passed**, including five real preacceptance deaths, atomic reward,
  failure/reconcile/reopen, concrete Put invocation and exact missing-pin refusal.
- Two independent mutations failed existing tests: remove the bounded-fact semantic guard
  (malformed reward content admitted); replace exact-pin lookup with newest-release selection
  (missing-pin refusal and pinned-release preservation fail). Both were restored; the same
  **108 tests passed** afterward. No mutation, fixture change or owner-save access retained.
- Ponytail Review: deleting the superseded detector is the smallest compliant change;
  no unnecessary replacement machinery and no new findings.
