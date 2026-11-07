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

## Fix round at 22f22f0fb07d0f80b35d7cad17989fb47ba26ce1

Commits 58fbf137f, d889c4f7c, 22f22f0fb only. CI at the head: ci, book-e2e and graph-diff all success (`gh run list --commit 22f22f0fb07d…`).

**Verdict: APPROVE WITH NOTES.**

### Dispositions (hand mutants, `bin/mutate.sh` narrow commands, all red-narrow)

1. Fixed. `policies.ex:46-48` uses one field list for every op. The schema refuses `subject` on time_since (Policy `time_since`: additionalProperties false; fields npc, item). Red: the guard narrowed to `fact_compare`, with `fact_at_least` dropped, and with `time_since` dropped (content_explain_test).
2. Fixed. `allowed.ts:118` `unfed`, in `Generic.tsx:116`. Red: `some` ignores `[]`, `applies` dropped (story_card.test), and `unfed` dropped from commit (cards.test.ts browser test, which is green unmutated).
3. Fixed. `world_card.ts:28` and `scene_card.ts:41` read `todo.ts bundled`. Red: each fallback dropped (world_card.test, scene_card.test).
4. Fixed. The PR body .68 now says `--from` did not reproduce and stays open.

d889c4f7c is sound. Red: the bundle room's area set to null and `held ?? {}` dropped (story.test). `openAt` falls back to `<bundle>:1` when the key has no line in the file (prose.ts:72-76). `key ?? ref` restores the non-ref open.

### Dispute: parts.ex:32 `stock` with a nil start

Upheld, no finding. ResourceSpec requires `start` (protocol/resource.schema.json), so a nil start needs a resources.json the compiler already refuses (an author error). `first` picks from that same file (starters.ex:228).

### Open items: all nits, to Beads

- `Generic.tsx:125`: a refused Undo also drops a held draft the compiler had refused. That needs an outside save, and it writes nothing.
- `storylist.tsx:104`: Bind over-refuses short refs only while the compile is refused. It writes nothing wrong.
- `Generic.tsx:50`: the shared undo map is keyed by file. A world switch reloads the page (finding d above).
- Bundles re-read on each call: this is cost only.
- `allowed.ts:55`: a redundant check, with no behaviour change.

Round-1 nit 5 is unchanged and stays a nit.
