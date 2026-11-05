# Review: Area layout S3, layout lint and `bin/loka new --area` (PR #624, loka-vduxr.58.3)

- PR: [#624](https://github.com/lorecrafting/lokacore/pull/624), branch `editor/s3-areas`
- Reviewed commit: `da830f24f6756cc96ba9313b728db7f89b3bfcb1`
- Governing: [area layout design §5, §7, §13 row S3](../rnd/cartridge-area-layout-design-2026-11-04.md), [cartridge.md editor writes (path guard)](../system/cartridge.md), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice. The brief asked for this record.
- CI at reviewed head (`gh run list --commit da830f24f...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body.
- PM rulings accepted, not raised: `--from` lands in the source room's area; lint prints area paths.

## Must be true (written before the diff)

1. Orphan: no exit or transport names the room, it is not the entry, and nothing is kept there (item location, NPC room, population home or area, replenish source, structure site).
2. Unreachable area: no route from a room outside the area reaches it, unless the entry is in it.
3. Astray: two or more exits, all into one other area (root is not an area).
4. The showcase baseline gains no finding.
5. `new areas <name>` writes `areas/<name>/rooms/<name>.json`; `--area` refuses a non-room kind until the area has a room.
6. `--from` finds the source room in any folder and the new room joins its area; placements take the area's first room.
7. No diff under `protocol/` or `kernel/ts/src/`.
8. POST /new's area goes through the one path guard and the journal.

## Checks that held

- Baseline: the 171 changed lines in `test/loka/lint_baseline.txt` are a pure `areas/<x>/` path rename. No new finding.
- No diff under `protocol/` or `kernel/ts/src/`.
- Owner workflow on a scratch cartridge: `cartridge`, `areas prologue`, `rooms lane --from prologue east`, `npcs`, `items`, `populations`, `transports --area prologue`, and `rooms loose --area nowhere`. Files land in `areas/prologue/` (the companions are at the root, see (a)). It compiles with `--allow-placeholders`, and a rerun changes no file.
- Lint true positives: `areas/nowhere/rooms/loose.json` orphan, `areas/nowhere` unreachable, root `rooms/x.json` orphan, and a planted two-exit room astray. No false positive on the entry, the transport's far room or the population camp.
- Broken JSON (`{not json`) and a list-valued `.json`: lint exits 1 on its findings, with no crash.
- `area: '../x'` → 400 (`write.test.ts`).
- Cites rerun: the `in_area(rooms, from)` mutants at `:55` → red (backed); population `||` at `:81` → green (not backed, finding 1).

## Mutants

`bin/mutate_diff.sh origin/main`: 46 run, 33 red-narrow, 13 SURVIVED, no TIMEBOX. All the survivors are in `lint_layout.ex:46-81`. The handback's 47-mutant table is from an earlier head: its lines are shifted by 2, and `starters.ex:52` SURVIVED there but is red here.

Hand mutants, run against `content_lint_layout_test.exs`, `content_lint_test.exs` and `content_area_folders_test.exs`:

| Mutant | Result |
|---|---|
| `lint_layout.ex:53` entry-area exemption set to `true` | SURVIVED |
| `:44` drop `!is_map_key(r, "site")` | SURVIVED |
| `:81` population `[p["home"]]` (drop `area`) | SURVIVED |
| `:66` `other not in [own]` (drop `nil`) | SURVIVED |
| `:40` drop `from != to` | SURVIVED |
| `:53` `!=` → `==`; `:55` `!=` → `==`; `:55` `and` → `or` | red |
| `:64` `>= 2` → `>= 1`; item `kept`; replenish `kept` | red |

## Findings

1. **Blocker**, `lib/loka/content/lint_layout.ex:53`, `:44` and `:81`. Three exemptions that §5 names have no red control:
   - `:53` the entry's area. The owner's prologue entry sits in `areas/prologue` with nothing outside leading in, so a regression flags that area on every lint run.
   - `:44` a structure site, as on the showcase's `holding_lane`.
   - `:81` a population's `area` rooms.

   The PR body claims the `||` at `:81` as a red control, and it is green. Add one planted case each.
2. **Blocker**, `lint_layout.ex:66`. Dropping `nil` survives. An area room whose exits all lead to root rooms would then print "every exit leads into areas/". Add an area room with two exits into the root.
3. **Should-fix**, `lib/loka/content/starters.ex:234` (`own_files`, used by `first/3` at `:228`). Kinds that need a reference pick the first key cartridge-wide. `new npcs brennan --area edge`, then `new dialogues hi --area hollow`, writes `areas/hollow/dialogues/hi.json` naming `npcs/brennan`, and compile fails with `area_crossing` twice. The same pick serves quests, reactions and the other kinds that need an NPC. Prefer the area's own files and fall back to the root.
4. **Should-fix**, `kernel/ts/play/write.ts:171-186`. `create()` checks only `named(area)` and never calls `guarded()`. With `areas/north` a symlink to a directory outside the tree, `new rooms den --area north` writes `outside/rooms/den.json`. `files()` (`todo.ts:14`) lists the symlink as one entry, and `current()` reads it as null, so the snapshot diff journals nothing and undo cannot remove the file. That breaks `cartridge.md:950` ("One path guard reads every path a body names"). On main, a symlinked `rooms/` had the same gap; this slice widens it. Guard `areas/<area>` before running mix.
5. Nit, `lib/loka/content/starters.ex` (`write` for `"areas"`). `areas x --area prologue` drops `--area` and writes a root `rooms/x.json`. This is author-side (item e).
6. Nit, `docs/system/cartridge.md:946`. `/new {kind, name, from?}` omits `area`.
7. Nit, `lint_layout.ex:40`. A room whose only exit is itself is reported as an orphan. That is stricter than §5's wording ("no exit of any room names the room") and untested.

## Rulings on open items

- (a) Population and transport companions land at the root. They compile, so this is a follow-up bead, not this slice.
- (b) Bundled rooms count as root. Nit: `--from` a bundled room is refused anyway.
- (c) The plural `areas` kind is consistent with every other kind. Agreed.
- (d) Author-side, and compile catches it. Nit.
- (e) Finding 5.
- (f) §7 scene placement is outside the S3 row; file a follow-up bead.
- (g) Agreed.

## Verdict

CHANGES REQUIRED: findings 1 to 4.

## Re-check at `98e80d50f576a7e9a911550621f43aa150a34c01`

Fix commit 98e80d50f. CI at that head (`gh run list --commit 98e80d50f...`): ci success, book-e2e success, graph-diff success.

Each mutant was run against `content_lint_layout_test.exs`, `content_lint_test.exs`, `content_starters_test.exs` and, for the last row, `write.test.ts`. Each one was RED:

| Finding | Mutant | Result |
|---|---|---|
| 1 | `lint_layout.ex:53` entry-area exemption set to `true` | 1 fail |
| 1 | `:44` drop the `site` exemption | 1 fail |
| 1 | `:81` population `[p["home"]]` | 1 fail |
| 2 | `:66` `other != own` | 1 fail |
| 3 | `starters.ex` `own_files(dir, kind)` (any area) | 1 fail |
| 5 | delete the `areas` + `--area` refusal clause | 1 fail |
| 4 | delete `if (link) refuse(...)` in `write.ts` `create()` | 1 fail (`write.test.ts` symlink test) |

Finding 4: the refusal is broader than `guarded()` on one path. That deviation is accepted, for these reasons:
- mix also writes companions and the `--from` neighbour, which no single guarded path covers.
- No cartridge in the repo contains a symlink (`find cartridges -type l` is empty).
- The editor already refuses a symlink on any path it reads or writes, so a tree with links was never fully editable.
- `files()` skips `checkpoints/`, where mix never writes.

As proof, a test that shows the refusal is enough:
- The refusal runs before mix is spawned, so no write can happen.
- In round 1, the reviewer showed the actual outside write without the refusal.
- Deleting the refusal turns the test red.

A link made between the check and mix's run is author-side.

Finding 6: `cartridge.md:946` now names `area?` and the refusal. Finding 7 (self-exit orphan) is still open, as a nit.

Verdict after re-check: APPROVE WITH NOTES (nit 7).
