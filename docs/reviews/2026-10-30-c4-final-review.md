# Review: C4 naming batch final head, PR #501 (loka-ivjq.29)

- PR [#501](https://github.com/lorecrafting/lokacore/pull/501) `simplify/c4-names` at `d2e64200f3ecb5501b90156a055c48eaa3181b54`, diff `origin/main...d2e64200f` (slices A and B merged; main included).
- Governing: "C4 PLAN" in `br show loka-ivjq.29` (sections 1-4, D1-D6, Acceptance A/B, PM rulings: `mechanics/attribute/`, `SAVE_FORMAT` stays); [save.md](../system/save.md) 14-16; [WORKFLOW review stance](../WORKFLOW.md); AGENTS.md "Writing tests"; per-slice records [c4-a](2026-10-30-c4-a-review.md) and [c4-b](2026-10-30-c4-b-review.md).
- Reviewer: anthropic/claude-fable-5-1, independent; authored none of the work. Reviewed the whole diff, not the slice records' framing.
- Verdict: **APPROVE WITH NOTES**.

## Must be true (written before reading the diff)

1. Save shape unchanged: `docs/state-sections.gen.json` untouched; no delta, event or row field renamed; `SAVE_FORMAT` stays `loka-save-v2` and the pinned-release rule in `save.md:14-16` still makes an old save open as a new game rather than crash.
2. Every string-keyed capability lookup (`requires.capabilities`, `lock.capabilities`) in the Elixir compiler, the TS kernel and mobile uses `attribute/skill/topic/tag/alternates`; the registry, `world.ts` RULES/RULELESS and `features.json` agree.
3. Old tokens (`variety@1`, `attributes@1`, `skills@1`, `topics@1`, `tags@1`, `map_positions`, `MapPositions`, `short_variants`) are gone outside `docs/{reviews,archive,decisions,evidence,rnd,briefs}` and `.beads`. Same-spelled names that stay by ruling (`CharacterChoice.attributes`, artifact maps, GameView fields, the `"tags"` definition token, runtime `short`) are untouched.
4. `sh bin/regen.sh` rewrites nothing.
5. Hand fixtures: canonical form and sha256 in `capability_lock_hash.json` and `cartridge_hash.json` recompute by the description recipe, and the locks carry the new keys.
6. Docs say what the code does; `elixir bin/check_docs.exs` passes.
7. Nothing outside the four picks changes behaviour: every changed line pair is a token substitution or a hash that follows from one. No new tests, no `kernel_api` bump.

Results: all hold.

## Findings

1. **Nit (process), reviewer.md "PR description must report the developer's `/code-review` result".** The #501 body has no `/code-review` line (`gh pr view 501` body: 0 matches). Slice B's handback carried one; slice A's record could not see one either. Fix round: add the result to the PR body.
2. **Nit, `test/loka/content_behaviours_test.exs` (frozen sha `a7f3dd…` -> `fb6e06…`).** A pinned-hash change detector was re-pinned to the code's own output; the comment says reversing the rename restores the old sha, which I did not rerun. Pre-existing pattern, not introduced here; acceptable for a rename batch, noted so the pin is not taken as independent evidence.

No blockers, no should-fix.

## Evidence

- **Save shape (1).** `docs/state-sections.gen.json` is not in the diff. Protocol field renames are `cartridge.schema.json` `map_positions`->`layout` and `entity.schema.json` `short_variants`->`name_variants` (Item and Npc), both cartridge definitions, not save rows; the rest of the protocol diff is registry `key` lines, description text and `hello_sampler` examples. `mobile/authority/local-story/authority.ts:59` `SAVE_FORMAT = 'loka-save-v2'`; `save.md:14-16` unchanged and still true (a save pinned to a release whose lock has the old keys opens as a new game).
- **Lookups (2).** All capability literals in `lib/`, `kernel/ts/src`, `mobile` are registry keys. New-key sites: `ancestries.ex:73-74`, `asks.ex:21`, `bleed.ex:32`, `commerce.ex:96`, `derived.ex:130,133`, `exchanges.ex:34`, `levelling.ex:38,44,46`, `skills.ex:12,27,170,172`, `water.ex:34`, `entities.ex:66`, `npc_fields.ex:40`, `source.ex:129`; TS `knowledge/shared.ts:43`, `description_variant/rule.ts:67,81`, `world.ts` RULES `attribute`, RULELESS `skill topic tag alternates`, `view/knowledge.ts` `cartridge.layout`. `world.ts` lists 45 of 48 keys; the three missing (`tide relationship faction`) are missing on main too. `elixir bin/features.exs` exit 0 (`mechanics/attribute/rule.ts`, `mechanics/alternates.ts` resolve).
- **Old tokens (3).** Sweep over the allowed dirs: 0 hits. `find cartridges test/fixtures -name map_positions.json`: none. Corpus `requires.capabilities` counts attribute 25 / skill 17 / tag 19 / topic 6 / alternates 4 (PR claim rerun, backed).
- **Regen (4).** `sh bin/regen.sh` exit 0, `git status` empty.
- **Fixtures (5).** Independent recompute (`json.dumps(sort_keys, separators=(',',':'), ensure_ascii=False)` + sha256): `capability_lock_hash.json` `2f795713bdf663c1004a9c8ee863161a5d1e17ca437e40d4c866fea2f1f991b0` and `cartridge_hash.json` `40654dbd1ae0e9efe4c2a86b58866beda79f84fe8f6bb7f913a588a5fd891393`, both equal the pinned values; locks carry `attribute`, `skill`, `topic`.
- **Docs (6).** `elixir bin/check_docs.exs`: 764 docs, 0 broken links or anchors. Docs hunks (outside history dirs and `.gen`) normalised by the rename substitutions leave no residual line pair except `bin/red_controls.exs` (transcript path `skills.jsonl`->`skill.jsonl`, the moved transcript) and `features.json` (`alternates.ts`, exists).
- **Scope (7).** The same normalisation over `kernel/ts/test`, `test/`, `mobile/`, `lint/`, `bin/` leaves only key substitutions in test setups, the `as_never_baseline.txt` line reorder for the renamed test file, and the finding-2 sha. No new tests, no new fixtures.
- **Mutants** (hand, in this worktree, each reverted; tree clean afterwards):
  - `derived.ex:130` `["attribute"]`->`["attributes"]` vs `content_derived_test.exs`: red, 4 failures.
  - `source.ex:129` `"layout.json"`->`"layouts.json"` vs `content_d10_test.exs`: red, 1 failure.
  - `knowledge/shared.ts:43` `.alternates`->`.variety` vs `alternates.test.ts`, `d10_knowledge.test.ts`: red ("the garden shows its long description until the tenth visit, then one line").
  - `description_variant/rule.ts:67` drop the `short`->`name_variants` mapping vs `variants.test.ts`: red, 2 failures (raid status line; "the guard carries its name words only while its base short holds").
- **CI** (`gh run list --commit d2e64200f3ecb5501b90156a055c48eaa3181b54`, not waited on): graph-diff 41051580091 success; ci 41051572623 in_progress; book-e2e 41051572780 in_progress. Hosted CI on the head remains the gate.
