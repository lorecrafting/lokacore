# Review: generated toolbox page, PR #612 (loka-vduxr.59)

- PR [#612](https://github.com/lorecrafting/lokacore/pull/612) `editor/vduxr59-toolbox-page` at `e41e7c48bbbd79d3336190f00e6db99c72044a1e`.
- Scope: docs and generator only (`bin/toolbox_page.exs`, `docs/features.json` cells, `docs/TOOLBOX.gen.md`, wiring). Spec: `br show loka-vduxr.59` with its owner comments. Lane: the PM asked for a record although this is a toolbox slice.
- Governing: [Review stance](../WORKFLOW.md#review-stance), [AGENTS.md Writing tests](../../AGENTS.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci success, book-e2e success, graph-diff success.
- `/code-review medium` is reported in the PR body.

**Verdict: APPROVE WITH NOTES**

## Must be true (written before the diff)

1. Every installed capability has exactly one row, and so does every Book treatment.
2. Summaries live only in `docs/features.json`.
3. A missing summary, declares, sampler or showcase cell halts, and red controls prove it.
4. `bin/regen.sh` writes the page, and `--check` in CI refuses a stale copy.
5. The BUILDERS-GUIDE section is a pointer, and AGENTS.md names the page as the first read.
6. Row ids are stable and machine-readable. No kernel or protocol change.

## Checks that held

- (1) The 47 rows equal `INSTALLED.capabilities` (`world.ts:111`) as a set diff, with no duplicates. tide, relationship and faction have no rule and no row, so they are rightly absent. There are two treatment rows.
- (2) Three summaries grepped repo-wide occur only in features.json and the page. The registry has no summary field.
- (3) `red_controls.exs`: all ok. Hand mutants red: `:48` `k == f`→`true` (declares), `:125` and `:135` guards→`false` (requires, anchor). `mutate_diff.sh origin/main`: 0 mutants, matching the handback.
- (4) `--check` exits 0; `regen.sh:73`, `check_all.sh:26` and the `ci.yml` step are present.
- Links: every page href resolves. A planted bad anchor or sampler link fails `check_docs.exs`.
- Showcase spot-check (20 of 38): light→magic holds (`crypt.json` `dark_description` = dark, `light/shared.ts:91`), and scene→fell_road holds (`wat_letter.json` sets `letter_fate`).
- PR cites `:109`, `:154` and `merge_resolve.py:35` are accurate.

## Findings

1. **should-fix**, `bin/toolbox_page.exs:224`. The page says "what you need may already be here", but 105 done toolbox rows (`docs/toolbox.gen.json`) have no row of their own, and the page does not link them. Examples: spells 29a/29b, lockpicking 13, crafting 21, hirelings 22a, levelling 4, curses 28, ranged 17. A builder who needs spellcasting finds no "spell" on the page and asks for a new mechanic. Fix: list the done rows (id, title, section) or link the ranked table. This is ruling (f).
2. **nit**, `bin/toolbox_page.exs:180-182`. The treatment-sampler guard has no red control. Disabled, `red_controls.exs` and `--check` stay green. The PR body says this guard's hand mutant was red, which this run does not back. `check_docs` backstops a broken link.
3. **nit**, `AGENTS.md:61`. The direct `#cartridge-layout` link was dropped.

## Rulings on open items

- (a) Acceptable. `none: <reason>` is the gap-with-reason the owner allowed, and a sampler needs owner prose. File a bead for escort, patrol and water samplers.
- (b) Acceptable. `check_docs.exs` catches slug drift (checked by planting an anchor).
- (c) Acceptable. Checking that a district uses the capability is an author-side guard; spot-checks found no wrong pick.
- (d) Acceptable. CI `--check` on the merged head backstops it, the same as `features.exs` at `:34`.
- (e) A real false green, but pre-existing: it reproduces on origin/main (`red_controls.exs:18` crashes first). Out of scope; file a bead.
- (f) See finding 1.
