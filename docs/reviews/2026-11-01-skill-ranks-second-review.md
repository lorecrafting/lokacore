# Second review: skill ranks, PR #570 (loka-g5hh.2.3)

- PR [#570](https://github.com/lorecrafting/lokacore/pull/570) `engine/skill-ranks` at `d59015447655629fc7ebcccb4794e7e10ee25c07`.
- Scope: the contract. Schemas, compiler and kernel agreement, authoring shape, saves, `kernel_api`. Written without reading the other reviewer's record.
- Governing: [mechanics.md Skill ranks](../system/mechanics.md#skill-ranks-level-up-rush), [cartridge.md](../system/cartridge.md), [save.md](../system/save.md), brief E3 in `br show loka-g5hh.2`.
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- `/code-review` is reported in the PR body. `bin/mutate_diff.sh` not run (brief); four targeted mutants below.

**Verdict: APPROVE WITH NOTES.**

## Must be true (written before the diff)

1. Both fields are optional and additive; a cartridge declaring neither keeps its bytes and hash.
2. `ranks[i]` names level i + 1, count is growth + 1, ranks need growth; the compiler refuses otherwise with the brief's codes and paths.
3. Stray or malformed fields are refused by compiler and loader.
4. The view schema admits exactly what the view emits; generated files are current.
5. `kernel_api` is a unique main + 1; older saves are refused at the pin, with no silent migration.
6. The engine tells no rank line; agents add no prose beyond placeholders; docs follow.

## Findings

**Should-fix, merge condition.** `kernel/ts/src/runtime/world.ts:110`. #557 and #569 make the same `1.143` to `1.144` edit. `git merge-tree` of this head with each conflicts only in `docs/system-graph.gen.json` and leaves `kernel_api: '1.144'`, so `bin/merge_resolve.py` never fires, and `bin/pm_merge.sh:46-50` only asks for a record. Scenario: #569 merges, then #570 merges cleanly; both contracts share 1.144, and a save made under the first opens under the second without refusal (`docs/system/save.md:19`). Whoever merges second must re-read main, bump to main + 1 and run `bin/regen.sh` (seven story SQL pins follow). No code change is needed while main is at 1.143.

**Nit.** `lib/loka/content/skills.ex:107-109`. A writer who gives five ranks for five thresholds gets bare `invalid_value` at `ranks`, with no expected count, and the same message for missing growth. This matches the `growth` precedent; `docs/system/cartridge.md` states the rule.

**Nit.** `cartridges/skills_sampler/cartridge.json`. `at_least` stays `1.44` though the sampler now uses `ranks`, while `docs/system/cartridge.md:22` says it rises for a newer feature. An older kernel would give `UNKNOWN_FIELD` rather than `KERNEL_API_UNSUPPORTED`; no older kernel is bundled, and E1's `levelling_sampler` set the precedent.

**Nit.** PR body cites `skills.ex:93` for the rank-key loop; it is at `:92`. The claim holds.

## Evidence

- Stray fields, the author's reasoning: removing a rank's `additionalProperties` fails at compile on both schemas (`outside the schema subset: ...SkillDefinition/properties/ranks/items/type` and `...SkillView/properties/rank/type`). The removed assertions were unreachable. Stray fields stay refused: compiler `UNKNOWN_FIELD skills/pick.ranks[0].oops`; loader on a re-hashed artifact `UNKNOWN_FIELD`, and a missing rank name `SCHEMA_VIOLATION`.
- Compiler probes: non-array ranks and non-object entries give `invalid_type` with no crash; `[]`, wrong count and no growth give `invalid_value` at `ranks`. Inline prose in `name`, `reached` and `learned` lowers.
- Compiler and kernel: a re-hashed artifact with a short `ranks`, no `growth` or a missing `learned` text loads. This is the same trust as `profession` (also probed), and the view omits `rank` when there is no entry. Not a divergence a compiled artifact can reach.
- Generated files: `bin/regen.sh` exit 0, tree clean. No file under `protocol/fixtures` changed.
- Saves: adding either field changes the content hash, and `ranks` needs `growth`, which adds the `uses_<key>` fact. The exact pin refuses or keeps the old release (`docs/system/save.md:62`), so nothing migrates. Not exercised by a run; read from the spec.
- Authoring: `cartridge.md` has fields, refusals and a recipe. `docs/guides/writing-the-game.md:289` reaches it through the sampler row; the guide does not name the fields. Acceptable for an engine half.
- Mutants, all red: `at - 1` to `at` (2 TS tests), rank only above level 1 (1 TS test), count `==` to `>=` and `learned` dropped from `text_refs` (Elixir suite exit 2).
- PR claims rerun: "no file under `protocol/fixtures` changed" holds; the flattener claim holds on either schema.

Not checked: the Book (no presenter reads these fields until B1); the other two PRs' contents beyond the merge simulation.
