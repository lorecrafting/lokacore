# Review: Editor walk P2 (PR #686, loka-wfrgk.61-.64, .67-.71, .80)

- PR: [#686](https://github.com/lorecrafting/lokacore/pull/686), branch `fix/editor-walk-p2-2026-11-06`
- Reviewed commit: `dd24b30f90302804ce1f33885f2204a1933305a4`
- Governing: [Author preview](../system/cartridge.md#author-preview), [entity and pair facts](../system/cartridge.md#entity-and-pair-fact-declarations), [E6d review](2026-11-05-e6d-story-review.md) (the card bar: a card that writes what the compiler refuses is not a nit; an author-error guard is), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice. Out of scope by brief: PR #685.
- CI at the reviewed head (`gh run list --commit dd24b30f9...`): ci success, book-e2e success, graph-diff success.
- `/code-review`: reported in the PR body.

## Verdict: CHANGES REQUIRED

## Must be true (written before the diff)

1. The panel never offers or writes what the compiler refuses; each gate cites the compiler and goes both ways.
2. `subjectless` refuses what the loader's FACT_SCOPE_UNSUPPORTED (cartridge_scoped_facts.ts:80) refuses, no more, and each op it names is tested.
3. Pickers and `/set` offer an area file its own area, the root and any room (area_rules.ex:27), bundles included.
4. Starters keep key order; a provider starts at its currency's `start`.

## Findings

1. **Blocker (test gap)**: `lib/loka/content/policies.ex:46-47`. Hand mutants green against content_explain, content_scoped_facts and content_access tests: guard narrowed to `~w(fact_compare)`, and `subject` added to time_since's fields. No test anywhere pairs `per_subject` with `fact_at_least` or `time_since`. Fix: one explain case for a subjectless `time_since` (or `fact_at_least`) and one for `time_since` with only `subject`.
2. **Should-fix (open item a)**: `kernel/ts/play/card.ts:322` and `tools/author-panel/src/edit/Generic.tsx` adder. Add edible on oilskin, then blur any field: the draft `edible: {label:{prose:'~'}, narration:{prose:'~'}}` is schema-valid, so `fresh()` holds nothing and it is written. Compiling fed_sampler with that edible gives SCHEMA_VIOLATION invalid_value (food.ex:21-23). Fix: hold `edible` in `apart` until it has resource, cures or applies.
3. **Should-fix (open item c)**: `kernel/ts/play/world_card.ts:22-27`, `scene_card.ts:37,58`. An NPC in an `areas/a.json` bundle counts as the root's, so an `areas/b/` file is offered it, and `/set` writes it. The compiler refuses this (area_rules.ex:27). Bundles are a documented shortcut, not an author error.
4. **Should-fix (PR text)**: The PR body .68 says "`--from` no longer writes to the repo root". Commit 4519bac76 says it did not reproduce, and no hunk touches it. Fix: correct the body and the .68 disposition.
5. **Nit (open item b)**: `Generic.tsx:47-53`. `fresh()` compares paths, so after a Remove shifts indices an old error reads as new. This needs an already schema-broken file, and a held edit writes nothing.

Open item d, no finding: a world switch reloads the page (`tools/author-panel/src/world.tsx:19`), so the module-level `undos` is gone. A stale id gets 404 (write.ts:163).

## Checks that held

- `bin/mutate_diff.sh origin/main`: 67 mutants. SURVIVED policies.ex:47 and :49, as in the PR table. TIMEBOX 10 panel E2E rows, which the PR table reports red. 55 red-narrow, including world_card.ts:14.
- Hand mutant `per_subject => true` to any fact: red.
- Claim rerun: the allowed.ts edible/container rows (:60, :63, :70) are red-narrow in this run, as claimed.
- `subjectless` field lists match `fieldsOf` (cartridge_scoped_facts.ts:44-45) and are no stricter.
- `Parts.starts` reads the root `resources.json` that `first` picks from (`@single`).
