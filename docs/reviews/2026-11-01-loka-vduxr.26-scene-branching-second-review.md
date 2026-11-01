# Second opinion: scene branching, PR #557 (loka-vduxr.26, kernel_api 1.142)

- PR [#557](https://github.com/lorecrafting/lokacore/pull/557) `engine/scene-branching` at `280fe76d003fd46c09f3e13d2739604876ff7390`.
- Governing: [cartridge.md, written order](../system/cartridge.md), [writing-the-game](../guides/writing-the-game.md), [dialogue cookbook](../guides/dialogue-cookbook.md), [contracts lessons](../lessons/contracts.md), [storage lessons](../lessons/storage.md). Follows [the first review](2026-11-01-loka-vduxr.26-scene-branching-review.md); view formed before reading it.
- Reviewer: independent; authored none of the work.
- **Verdict: CHANGES REQUIRED.**
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success.

## Must be true

1. Artifact bytes of existing cartridges do not change.
2. `entry: false` is never a candidate or fall-through target in either kernel; `entry: true` semantics do not change.
3. A mid-conversation reload continues at the same node.
4. `once` and `asked` names do not depend on numbering; every consumer of a choice id sees the numbered name consistently.
5. `choice_order` and `once` are source-only, schema-visible and absent from the artifact.
6. The `kernel_api` bump and pin behaviour are explicit.

1, 2, 3, 5 and 6 hold. 4 fails (below).

## Findings

**blocker** `lib/loka/content/choice_order.ex:11`, `:22`. Numbering rewrites dialogue choices, `riddle.choice_id` and story_point outcomes, but not reaction `choice_resolved.choice`, `quest_resolved.outcome` or quest `journal.outcomes` keys, which `docs/guides/writing-the-game.md:69` and `dialogue-cookbook.md:13,:369` tell a writer to name by id. Run: cookbook cartridge plus a scene written "Yes, done / All done", both `quest: resolve errand`, a reaction on `choice: yes_done`, journal outcomes for both. It compiles with exit 0 and no diagnostic. Offered `c001_yes_done,c002_all_done`; after the pick the reaction has not fired (`bell_heard` undefined) and the journal shows `resolved`, not the outcome text. Control written in sorted order: `bell_heard` true, journal `outcomes.yes_done`. `quest_resolved outcome: yes_done` is also left unmatched in that artifact (inspected, not played). Moving one choice out of alphabetical order renames every id in that scene (`source.ex` `written_marks`), so working reactions and journal text die silently. The PR lists this as open and untested. Fix: rewrite those references too, or refuse a reference to a numbered choice at compile time, with a test either way.

**nit** `lib/loka/content/scene_files.ex:135`. `or -> and` on the first `or` stays green against every scene test file. Failure: a child under a link with no choice stays visible and adds noise to an already refused compile.

## Asked: a saved `once` or `asked` when a writer edits a scene

- A save is pinned to `content_hash`, so an edit means a new hash. The save stays on its old release if that is installed; otherwise `mobile/authority/local-story/authority.ts:94-103` gives `pinned_release_missing` and only Start over. No migration exists, so saved state never meets the edited scene today. Post-release patches therefore end runs unless the old release ships too.
- Numbers are stable across recompiles: the numbered probe cartridge compiled twice is byte-identical (`c001_yes_done`, `c002_all_done`). Inserting a choice renumbers ids in the new release only (code read, not run).
- `once` facts are `<dialogue>_<choice>_done` from the written key (`dialogue_once.ex:64`; swapping the name goes red), and `asked` facts are named from words (code read), so they would survive renumbering under a future migration. Rewording a choice makes a fresh fact: `once` is offered again and the old fact is orphaned. Pending choice rows hold numbered ids, so a migration would have to map them.

## Evidence

- Hashes: all 108 cartridge dirs compiled at head and merge-base `295aaeff5`: 107 byte-identical, 0 differ, 1 (`test/fixtures/prose_lint`) fails in both, as expected. PR claim backed.
- Second PR claim: the `choice_order.ex:22` cite, confirmed by the run above.
- Reload: nested node `c001_zebra,c002_apple`, cold reopen, choice view deep-equal, choose works and returns to parent.
- Entry: schema, Elixir and TS agree; sidecar `entry: false` and non-scene JSON are covered by `test/fixtures/dialogue_entry_cases.json` (19 cases, appended only, both kernels). Keyword plus `entry: false` is closed on the say path and warns when unlinked; no problem.
- Narrow mutants, singly, null green, tree clean: `selection.ts` entry check, `fall_through.ts` `to.entry`, `oneTalk` kept row, `dialogue_links.ex` live, `dialogue_links.ex:166`, `choice_order` story_point, riddle rewrite and order swap: 8 of 8 red.
- `MUTATE_MINUTES=15 bin/mutate_diff.sh origin/main`: 113 mutants, 66 red, 31 survived, 12 no tests, 4 not unique. The PR reports only ten narrow rows. Survivors are mostly parser conditions in `scene_files.ex` and `scene_lines.ex`, plus `scene_merge.ex`. Ten sampled against all scene test files, including all three `scene_merge.ex` survivors: nine red, one green (the nit). Four `dialogue_once.ex` narrow mutants (gate, set, `Map.delete`, name): all red. Not run: `kernel/ts/src/view/action_lists.ts:66` (my null control was red on the file subset, so no result) and the remaining survivors; their state is unknown.
- `/code-review` is reported in the PR body. `entry` rulings and `when: not` not reopened.

## Re-check at 0440cf678 (fix commits 4b3b1289a, 6d8075f33; merge 0440cf678)

Verdict: **APPROVE WITH NOTES**. CI at the head: `ci`, `book-e2e`, `graph-diff` all completed success.

Must hold: `order` is optional and only the compiler writes it; ids stay the words; sorted scenes and existing cartridges keep their hash; display, save check and schema read one order.

Dispositions:
- blocker `choice_order.ex`: fixed, file deleted, no `c00N_` left. Probe: `Yes, done`/`All done` keep ids `yes_done`/`all_done` with `order` 1, 2 and match the journal outcomes. New cookbook test covers reaction, outcome words and reload.
- nit `scene_files.ex:135`: fixed, clause removed; `or -> and` on the remaining clause goes red.

Findings:

**should-fix** `lib/loka/content/dialogue_links.ex:94` (`return_closed`). Scene with no nesting: `when: not flip`, `- Ask` with `sets: flip`, `- Other`. It compiles with no warning. In play Ask reopens the hub (`behavior.ts:94`, unchanged here), every choice shows unavailable, choosing Other is refused `invalid_state`, and only closing works. This is worse than the warned case, and `docs/guides/writing-the-game.md:103` says the choice comes back. Warn here too, or file it as a follow-up.

**nit** `docs/system/mechanics.md:441`. Still says "the choice ids in key order"; `:498` is right. A reader of the Accepted paragraph gets the old order.

**nit** `lib/loka/content/scene_files.ex:38`. `@key_max` 64 -> 63 stays green (65 is red). A 64-byte child key refused would pass. Probe at head: 64 compiles, 65 refused.

## RETURN_CLOSED: warning is right

Keep the warning. Probe `when: not flip` with Back: the talk closes with no fault and no stuck state, as ruled. Closing can be meant (ask once), and the compiler cannot see a reaction resetting the fact, so an error would refuse valid content. No shipped cartridge carries it (hashes identical to base, and the cookbook test requires no warnings).

## Evidence, re-check

- Old and new source: all 107 cartridges compiled at head and merge-base `bfeaeb6a5`: 107 same `content_hash`, 0 differ, no choice with `order`.
- Contract: `order` integer, minimum 1, in `protocol/dialogue.schema.json` and source defs; `kernel_api` 1.144. JSON sidecar and area bundle writing it are refused (`choice_order_written`). `extends` of an unsorted scene inherits it with no false refusal; sidecar-added `mid` follows, `zed, ask, mid`. Nested unsorted set gets its own `order`; sorted scene gets none.
- Mutants, singly, nulls green, tree clean. Red: `scene_files` comes_back condition, `put_new then`, `@key_max` 65, `is_map_key` filter, always-positioned, `order_refused` file test, `closes?` walk, `set_choices` entry filter; `selection.ts` `?? Infinity`, `|| cmp` (`kernel/ts/test/dialogue.test.ts`); `action_lists.ts:109` `oneTalk` wrapper (cookbook, sage first meeting). Survived: `@key_max` 63. The `oneTalk` mutant's full kernel run timed out and adds nothing.
- Not probed: `fall_through.ts:32`, `selection.ts:178` (first reviewer); a JSON `all[...]` policy, which `when_fact` does not read; `scene_lines` parser.
