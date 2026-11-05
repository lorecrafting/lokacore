# Review: area layout S2, showcase in area folders, PR #609 (loka-vduxr.58.2)

- PR [#609](https://github.com/lorecrafting/lokacore/pull/609) `editor/s2-area-migration` at `c99bf19622fe3a3568e63823b3f14be79ffdd38a`.
- Governing: [area layout design](../rnd/cartridge-area-layout-design-2026-11-04.md) §3, §4, §9, §13; [GUI editor design](../rnd/gui-editor-design-2026-11-04.md) §11; [AGENTS.md Writing tests](../../AGENTS.md).
- Reviewer: independent; authored none of the work.
- CI at this head (`gh run list --commit`): ci success, book-e2e success, graph-diff success.
- `/code-review medium` is reported in the PR body (origin/main..6c3de1c7d; c99bf1962 changes only test paths).

## Must be true (written before the diff)

1. The compiled showcase hash equals `protocol/fixtures/toolbox_showcase_hash.json`, and that fixture is unchanged.
2. No diff under `protocol/`, `kernel/ts/src/` or `docs/spec/`. Cartridge files are moved, not edited.
3. The moved tree passes `area_crossing` (§4).
4. Placement follows §9 and §3.6:
   - One area means there; none or several means root.
   - An NPC's home room decides its folder: "`wat` stays in its home area".
   - Most reactions and dialogues land in one district (§3.2: "what one area uses lives in that area").
5. The script is §9's reusable `bin/area_split.py <cartridge dir> <rooms.json>`. It exits 1 and prints the first differing definition.
6. Starters (§13, gui-editor §11) find `--from` rooms and own files in area folders and rewrite them in place, with no root duplicate.
7. Test edits change only paths, and each one is justified by the rules.

## Checks that held

- Items 1 to 3:
  - Reproduced `content_hash` `9511cb35…2299c00`, equal to the fixture.
  - The protocol, kernel and spec diff is empty.
  - All 376 cartridge changes are R100.
- Item 6, probed on copies:
  - `--from` on an area room (`forge_stall`), on the hub entry, on a root room and on a mixed area room wrote in place, with no root copy.
  - A rerun was idempotent.
  - An unknown room refused.
  - With two area copies, `home` (starters.ex:67) falls back to root. `--from` and `new_room` then refuse, and a template write lands only in a tree that already fails to compile with a duplicate error. That is an author-side edge: no finding.
- Item 7, the d10 knock rename: the smith reproduces SCHEMA_VIOLATION `area_crossing` at `areas/fell_road/rooms/smithy.exits.south.knock.npc`, and Orla is in fell_road. The rename is legitimate.
- No reader still assumes root paths:
  - The changed tests go through `ContentSource.path`.
  - `content_d9_test.exs:57,78` uses `ContentSource.compile`.
  - The lint tests use in-memory maps.
  - Every docs link resolves.
- `bin/mutate_diff.sh origin/main`: 3 of 3 red-narrow, matching the handback. The `scene.ex:34,35` rows are compile errors only; the PR's hand mutants cover them.
- Hand mutants, all red:
  - `home` always returns `rel`: 2 failing, including `content_starters_fresh_test.exs:284`.
  - `own_files` without the areas glob: `:185`.
  - `rooms_in(["areas",_]) -> []` (a PR claim): `:193`.
  - The `system_graph_homes.exs:41` glob changed to `*/nowhere/` (a PR claim): `contracts.exs --check` reports the graph out of date.

## Findings

1. **should-fix**, `bin/area_split.py:75-81`: placement does not meet §3.6 or §9's expected result.
   - §3.6 says "`tam`, `warden` and `wat` stay in their home areas". At head, `npcs/wat.json` is at root although its home `shepherd_hut` is in fell_road.
   - All 13 root NPCs have their home room in an area.
   - 0 of 21 dialogues and 31 of 144 reactions are in areas.
   - The quest `areas/magic/quests/errand.json` has its offer `dialogues/wizard_errand.json` at root (`docs/BUILDERS-GUIDE.md:154`).
   - Traced for wat:
     - `dialogues/wat_letter.json` names no room and nothing names it, so it gets no area and goes to root.
     - That root file names `wat`, and line 79 (`ROOT if a == ROOT`) pulls `wat` to root.
   - A valid placement exists. On a copy, I moved the 87 root definitions whose every non-root neighbour is in one area:
     - They were reactions 43, dialogues 20, NPCs 12, statuses 4 and others.
     - `mix loka.compile` gave rc 0, no diagnostics and the same hash `9511cb35…`.
   - Disposition: fix the script so that §3.6 holds, or the PM amends §3.6 and §9.
2. **should-fix**, `bin/area_split.py:13,113`: the room map is hard-coded and the second argument is the fixture. §9 asks for `<cartridge dir> <rooms.json>`, "kept in `bin/` for the next cartridge", and on a mismatch the script must print the first differing definition. It prints only the two hashes (:108). The next cartridge needs the script edited.
3. **nit**, `test/test_helper.exs:37-42`: `ContentSource.path` re-implements `Starters.home/2`. It could be `Path.join(dir, Loka.Content.Starters.home(dir, rel))`.

## Verdict

CHANGES REQUIRED. Findings 1 and 2 are logic changes to the script, so they take a fix round ([small should-fix](../WORKFLOW.md#small-should-fix)). For finding 1, a PM amendment to §9 is the alternative disposition.

## Re-check at deec81fde

The fix commits were reviewed against findings 1-3 and their direct callers. CI at `deec81fdef68f9570af8c321993cfe4a480becad`: ci, graph-diff and book-e2e were all success (`gh run list --commit`).

- **Hash.** `mix loka.compile` at head gave rc 0 and content_hash `9511cb35ac7b…` (in full: `9511cb35ac7b199931c437d09422c36fc43f91b36c54ac9130070ebe72299c00`). It equals the fixture. The diff under `protocol/`, `kernel/ts/src` and `docs/spec` is empty, and the cartridge changes are 501 R100 renames.
- **Rerun.** I ran the head `bin/area_split.py` with `bin/area_split_toolbox_showcase.json` on clean origin/main. It printed 501 moves and the same hash, with rc 0. Its `git diff --name-status` was identical to the branch.
- **Finding 1, resolved.** `wat` is in `areas/fell_road`. All 43 NPCs and all 21 dialogues are in areas, and `wizard_errand` is in `areas/magic`.
  - Of the 55 root reactions, 52 touch no area. `wat_at_gate` and `tam_hears_wat` touch fell_road and low_wardle.
  - The root items, liquids, quests and statuses each touch zero areas or two or more (e.g. `letter`: fell_road and low_wardle).
  - Mutant: I changed the placement check `len(touched(n)) == 1` to `>= 1`. The compile then failed with `area_crossing` errors, so the script fails closed.
- **Finding 2, resolved.** The script takes `<cartridge> <rooms.json>` and prints the first differing definition.
- **Finding 3, resolved.** `test/test_helper.exs:37` uses `Starters.home/2`.
- **Accepted deviation.** The script compares the hash against its own pre-move compile, not against the fixture. A generic cartridge has no fixture, and `content_showcase_test.exs:9` still pins the showcase fixture in CI.
- **Small should-fix, made in place (`beed387a8`).** 12 code spans in `docs/showcase/{cause-and-effect,combat-district,economy-law-district,homestead-district,hub-and-first-districts}.md` still cited root paths the migration had moved. I prefixed each with `areas/<area>/` and checked that every target exists. The docs link check reported 0 broken links.

Verdict: **APPROVE**.
