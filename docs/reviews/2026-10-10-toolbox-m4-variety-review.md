# Review: narration variety and visit tiers, toolbox row W7 (loka-kgd.29)

- Branch `toolbox/m4-variety`, head `7e190023cdf77294b522477202ff9e8cd7016950`, diff `3f4705d0...7e190023` (38 files); no PR yet (batch M4). Save and kernel contract change (`VisitedRoom.count`, `visit.record.from`, both kernels' knowledge composition and invariant), so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row W7, slice process, traps 4 and 5](../MECHANICS-TOOLBOX.md#toolbox-slice-process), [G1 leaf-set rule](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1), [mechanics.md W7](../system/mechanics.md#narration-variety-and-visit-tiers-toolbox-row-w7), [CHECKS.md size](../CHECKS.md), brief in Beads `loka-kgd.29`.
- Hosted CI on the head: book-e2e success (38038083063); ci failure (38038083109) only at the inherited `checks.ex` size, fixed on the batch.
- Verdict: **CHANGES REQUIRED** (one surviving mutant on the save opt-in).

## Must be true

1. The alternate is chosen by a hash of (command id, key), never the authority RNG (trap 5); same command ids give the same lines; the world state is equal with and without alternates.
2. Every shown line is authored (trap 4); every key and alternate is in the catalog, checked by both the compiler and the loader.
3. Opt-in: without `variety@1` no count is written and saves are as before; Chapter 1 bytes unchanged.
4. The count is consistent in save, replay and recovery: both kernels' composition and invariant refuse a missing, stale or skipped count; old saves (no `count`) load.
5. `visited_count` follows G1: schema branch and invalid fixtures, one registry owner, one `holds()` case, `LEAF_REFS` and `LeafRefs` entries, kernel_api 1.45 floor in both kernels, each new field alone.
6. No source `size: allow` is raised.

## Proof

- Baseline: `variety`, `knowledge_composition`, `tags`, `d10_knowledge` (TS) and `content_variety_test.exs`, `core/knowledge_composition_test.exs` pass.
- Killed: M1 `% more.length` in `variety.ts` (variety.test.ts); M2 TS compose without `same(before, op.from)` (knowledge_composition.test.ts); M4 Elixir invariant without the count check (knowledge_composition_test.exs).
- Survived: M3, `if (!world.cartridge.lock.capabilities.variety) return [];` deleted from `kernel/ts/src/mechanics/knowledge/shared.ts:43`; green on `variety`, `d10_knowledge`, `d10_presentation`, `e1_knowledge_effects`, `chapters`.
- Floor: both kernels have a row per field alone (`variety.test.ts` last two rows; `content_variety_test.exs` `plain` and `Map.delete("alternates")` rows).
- Chapter 1: `mix loka.compile cartridges/ashmere_chapters` byte-identical at base and head (sha1 `ee93f779`). Host rows are JSON values (`mobile/authority/local-story/knowledge-save.ts`), so `count` persists with no schema migration; an old row reads as 1.
- Fixtures: `knowledge_composition.json` and `invalid.json` additions only; no frozen answer touched. Test oracle for the pick is node `crypto`, independent of `foundation/sha256.ts`.
- Trial merge onto `origin/toolbox/batch-m4` (fd34b635): conflicts only in `docs/system/mechanics.md`, `docs/system/cartridge.md`, `docs/system-graph.gen.json` (matches the developer's claim); `bin/check_size.exs` and `bin/check_ts_size.mjs` exit 0 on the merged tree (proposal.ts at its raised 341).

## Findings

1. **blocker**, `kernel/ts/test/variety.test.ts:76` (`plain` blanks `alternates` but keeps the `variety@1` lock): M3 stays green. Failure: a refactor drops the lock check and every knowledge@1-only world (Chapter 1) writes `from`/`count` on each re-entry, breaking "a world without variety@1 saves exactly as before" (mechanics.md W7 Save). Fix: one case re-entering a room with knowledge@1 but not variety@1, expecting no second `visit.record` and no `count`.
2. **should-fix**, `kernel/ts/src/runtime/proposal.ts:3`: `size: allow 340` raised to 341, against `docs/CHECKS.md:47-49`. Fix: split (e.g. move the narration assembly or `join` out).
3. **should-fix**, `docs/MECHANICS-TOOLBOX.md:99`: row W7 still `todo`; the slice process flips it in the same change (rows 11 and 30 show `done (batch M4)` on the batch).
4. **nit**, `kernel/ts/src/content/cartridge_variety.ts:27`: `visited_count` without knowledge@1 loads and is always false, with no diagnostic (documented). Failure: an author's tier variant never shows, silently. A one-clause refusal in each kernel would close it.
5. **nit**: the developer's `/code-review medium` result is not reported in the Beads hand-off.

## Brief questions

- Hash pick, receipt stores the picked key: right; no RNG draw, the M1 oracle and equal-state assertion pin it.
- A room entered twice in one command counts twice: correct, two entries (`now(p)` applies the first record before the second); fixture `two-entries-in-one-delta-count-twice`.
- Same key twice in one command shows the same line: acceptable, documented.
- Question: the `knowledgeLast` comment (`knowledge/shared.ts:47`) says no rule consumes these rows mid-command, but a same-command reaction or recipe policy can now read `visited_count`; which count does it see? The spec says "the current entry included"; state it or adjust the comment.

## Fix re-check (2026-10-10), head `2899b8a8dce46ca7a0a62bdf0adea1a5eb181c96`, diff `7e190023..2899b8a8`

Verdict: **APPROVED**. Hosted CI on the head: book-e2e success (38039615814); ci failure (38039615810) only at the inherited `lib/loka/content/checks.ex` size allowance, fixed on the batch (d7978157).

- F1 fixed: `kernel/ts/test/variety.test.ts:103` drops `variety` from the lock and re-enters the garden. Red control M3 (delete the lock check, `kernel/ts/src/mechanics/knowledge/shared.ts:43`) now fails that case; restored, `variety`, `knowledge_composition`, `d10_knowledge` pass. No Elixir twin needed: `lib/` has no `visit.record` producer (only `core/compose*.ex` and `core/invariants*.ex` consume it).
- F2 fixed: `populationDeadlinePairs` moved verbatim to `kernel/ts/src/runtime/proposal_deadlines.ts`; `proposal.ts:3` back to `size: allow 340` (file 317 lines); `bin/check_ts_size.mjs` exit 0. Tightening is in `loka-kgd.40`.
- F3 fixed: `docs/MECHANICS-TOOLBOX.md:99` row W7 `done (batch M4)`.
- N4 fixed: `VISITS_UNRECORDED` warning in `lib/loka/content/variety.ex:24-36`, enum and description in `protocol/cartridge.schema.json:1097,1136,1145`; `elixir bin/contracts.exs --check` exit 0. Red control (match `knowledgeX`, so the warning always fires) fails `test/loka/content_variety_test.exs:42`. Adding a code to the closed `DiagnosticCode` list touches only compiler output (`Diagnostic`, and the `content.diagnostic` observation); no compiled cartridge or save carries a code, and the loader never emits it, so older cartridges are unaffected and no `kernel_api` bump is needed (same shape as `TOUCH_LINK_MISSING`).
- Question at `shared.ts:47` answered: the comment says a same-command reaction sees the entry already recorded, which matches `join` (`proposal.ts:154-158` records into `p.ops` before reactions run).
- Once or twice: both are true, at different scopes. `enteredActors` is a Set per admitted sequence and `record` reads the final container, so within one sequence a body counts at most once (pre-existing D10 shape). Separate sequences in one command (the root, then a reaction) each record, chained through `now(p)`; the fixture `two-entries-in-one-delta-count-twice` pins that composition. Not a defect: no current rule moves one body into the same room twice within one sequence. The `mechanics.md` W7 sentence "two entries in one command count twice" is broader than this and goes to `loka-kgd.40`. Neither `loka-kgd.40` item blocks: counted visits without `variety@1` are produced by nobody now (pinned by F1), so only a forged delta reaches the lenient composer.
