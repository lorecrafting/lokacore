# Review: property tags and the policy leaf set, toolbox row G1 (loka-kgd.17)

- Local branch `toolbox/m3-g1`, head `f993ede68e7dbcebc0c338f27c31235e55ec1910`, diff `origin/toolbox/batch-m3...f993ede6` (35 files); no PR yet. Protocol change (schemas, registry, invalid fixtures), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row G1 and slice process](../MECHANICS-TOOLBOX.md#toolbox-slice-process), [mechanics.md G1](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1), [cartridge.md tag declarations](../system/cartridge.md#tag-declarations), brief in Beads `loka-kgd.17`.
- Hosted CI on the head: ci 38024252128 and book-e2e 38024252163, both success.
- Verdict: **CHANGES REQUIRED** (one blocker: a mutant survives).

## Must be true

1. Items, barriers and rooms may declare tags from one closed vocabulary that both kernels check the same way.
2. `tags` and `has_tag` need `tags@1` in both kernels. Without tags, a cartridge keeps its bytes (Chapter 1 hash unchanged).
3. `has_tag` reads the named subject's definition: the target item, the actor's current room, or a named item, barrier or room. On the sampler, `burnable` holds on the wooden door and fails on the iron door.
4. The compiler expands and resolves each reference field of `has_tag`. The loader refuses an unresolved reference at the same member.
5. The leaf-set rule (naming, dispatch, parity tables) lets each later candidate leaf be added as one entry with no rework.
6. Tests use literal expectations, and each guarded behavior has a red control.

## Proof

- Baseline: `tags.test.ts` passed. `content_tags_test.exs` passed (1 test).
- Mutants caught: M1, the barrier subject reads the item table (`policy.ts`); M2, `LEAF_REFS.has_tag` without `room`; M3, `LeafRefs` `has_tag` without `room`; M4, room `tags` not owner-checked (`room_parts.ex`); M5, `case 'has_tag'` deleted, which fails `tsc` at the `never` default (backs the "fails the TypeScript build" claim).
- **Mutant survived:** M6, `subject: "room"` reads the hall, not `containers[body]` (`policy.ts:92-93`). `tags.test.ts` stays green.
- Chapter 1: `mix loka.compile cartridges/ashmere_chapters` gives a byte-identical artifact at base and head (sha1 `ee93f779`).
- Probe: short refs `room: "hall"` and `item: "rod"` expand to kinds `room` and `item`.
- Parity: TS `parts()` owner-checks `tags` on NPCs and details as well. The schema makes that unreachable, because `NpcDefinition` and `InspectableDetail` set `additionalProperties: false`.
- Cites rerun: `policy.ts:24` (holds) and `cartridge_refs.ts:168` (LEAF_REFS) match.
- Fixtures: `invalid.json` has one renamed field: room case `tags` became `labels`. It still expects `unknown_property` (now at `/labels`). This keeps the case's intent, since `tags` is legal now. The other changes add cases with literal answers.

## Findings

1. **blocker**, `kernel/ts/test/tags.test.ts:50-51`: every `subject: "room"` row runs with the actor in the hall, so M6 stays green. Failure: a regression that reads the entry room, or the target's room, ships unseen. Row 31 (`exposed` in rain) depends on exactly this read. Fix: add one row with the actor moved to `north_room` that expects `wooden` to be false.
2. **should-fix**, `docs/system/mechanics.md:1776` (leaf naming) against `docs/MECHANICS-TOOLBOX.md:99,107,151`: four committed candidates do not fit the rule.
   - `status_active {body, status}` and `position {body}` name the subject `body`, but the rule says `subject`.
   - `visited_count {room, compare}` and `population_count {plan, compare}` fit no name pattern, and their `compare` field is not `at_least`.
   - `population_count.plan` names a `population` definition. Both tables use the field name as the kind (`named(n[field], field)` and `ref(&1, f, m)`), so this leaf cannot be added as a table entry without rework.

   Fix: extend the rule (allow `<x>_count` and a field-to-kind pair in the tables), or rename the row texts now.
3. **should-fix**, `kernel/ts/src/content/cartridge_refs.ts:168` and `lib/loka/content/leaf_refs.ex:8`: two hand-kept tables with no check that they match. Failure: a later row adds `status_active` only to `LeafRefs`. The loader then admits an artifact with an unresolved status reference. Fix: derive both from `policy.schema.json`, because each leaf's DefinitionRef-typed properties are exactly today's table. A parity test also works.
4. **nit**, `protocol/entity.schema.json` Tag lists (item, room, barrier): these lists have no `minItems`, `maxItems` or `uniqueItems`, unlike the sibling lists (`affects`, `keywords`: 1 to 16). `tags: []` and `["wooden","wooden"]` both compile.
5. **nit**: there is no PR body yet, so there is no developer `/code-review` result to check. Report it in the PR.

Not a finding: the `kernel_api` bump is deferred to the PM (1.43 at the batch merge).
