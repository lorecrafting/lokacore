# Review: area layout S1, the compiler reads area folders, PR #603 (loka-vduxr.58.1)

- PR [#603](https://github.com/lorecrafting/lokacore/pull/603) `layout/area-folders-s1` at `08a98235b3b76ed7268069eebacb90da345bfc8f`.
- Governing: [area layout design](../rnd/cartridge-area-layout-design-2026-11-04.md) sections 3, 4, 12, 13 S1 and 14; [cartridge.md Area folders](../system/cartridge.md); [owner decision](../decisions/owner-decision-area-layout-2026-11-04.md); the bead comments; PM ruling that `area_empty` applies to folders only.
- Reviewer: independent; authored none of the work. Lean review: the protocol does not change.
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff all success.
- `/code-review medium` is reported in the PR body.

## Must be true (written before the diff)

1. No diff under `protocol/` or `kernel/ts/src/`. A file in `areas/<a>/<dir>/` compiles as its root twin, and the artifact and `content_hash` stay the same.
2. A ref from area A to a non-room definition of area B is refused. The root, the same area and rooms may cross. This holds for refs, `extends` and behaviours, for folders and for bundles.
3. These are compiler errors, each with a minimal fixture and a red control: an area folder with no room (folders only), an unknown or deeper folder, a bad folder name, and an `area` field.
4. An area is an implicit zone of its rooms. The section 14 risk (an area name equal to an existing reaction zone) is pinned.
5. Diagnostics, lint and a scene's JSON half point at the area file.
6. The Builders' Guide section is short, example-led and true against the code.

## Checks that held

- `git diff origin/main --stat -- protocol kernel/ts/src` is empty. The focused mix tests pass (63).
- `bin/mutate_diff.sh origin/main`: NO-TESTS 2, SURVIVED 5, red-narrow 3. This matches the PR table.
- Hand mutants: each was red in `content_area_folders_test`, and each was restored afterwards.
  - `extends.ex:93` `!= :room` changed to `==`;
  - `areas.ex:90` `!= :ok` changed to `==`;
  - `area_rules.ex` `kind != "room"` changed to `==`;
  - `zones.ex` with the area zone dropped;
  - `behaviours.ex` with the `crossed` arguments swapped.
- PR claim rerun:
  - A planted `{"bogus_field":1}` at `rooms_sampler/areas/plant/rooms/planted.json` turns `source_schema.test.ts` red.
  - With `recursive: true` removed, the same test is green (3/3).
- Red control for the section 14 pin: an empty `cartridges/codex_sampler/areas/priory/` (codex has a reaction with `"zone": "priory"`) turns `content_area_folders_test.exs:164` red.
- Probes, run in a scratch test and then removed:
  - `resource_sampler` and `identity_sampler` (a `.scene`, an npc and a room moved into an area) compile to the same bytes.
  - An `area` field gives `UNKNOWN_FIELD areas/r/rooms/roost.area`.
  - An area/root duplicate gives `DUPLICATE_DEFINITION` at both sites.
  - A behaviour or `extends` parent held in a bundle is allowed from the same area. From another area it is refused at `areas/c/items/bone.behaviours[0]` and at `areas/c/items/flint.extends`.

## Findings

1. **Should-fix.** `docs/BUILDERS-GUIDE.md:84` quotes "`widgets` is not a field here" for an unknown folder, a deeper folder or a stray `.json`. The explain for `areas/r/widgets/w`, `areas/r/rooms/x/y` and `areas/r/x`, all probed, actually reads "This file is in no folder the compiler reads. Move it into a kind's folder…". Only an `area` field gets "is not a field here". An author who searches the Guide for the message they were shown will not find it. Fix: split the row in two.
2. **Nit.** The pin at `test/loka/content_area_folders_test.exs:164` covers every `cartridges/*`. In S2, valid content (a `"zone": "hollow"` reaction inside area `hollow`) turns it red, although that is the intended use. Narrow it to the cartridges that existed before area folders, or note it for S2.
3. **Nit.** `docs/BUILDERS-GUIDE.md:76` and `docs/system/cartridge.md:340` say that a move leaves `content_hash` unchanged. That is false when the room moved is in, or leaves, an area that a reaction `zone` names, because the zone copies change. Add a one-clause qualifier.
4. **Nit.** The room added to the bundle at `test/loka/content_scene_branching_test.exs:607`, and the size allowance raised from 653 to 654, are unneeded after the PM ruling. Revert them, as `content_bundles_test` was.

## Verdict

**APPROVE WITH NOTES** (fix finding 1 in the fix round).
