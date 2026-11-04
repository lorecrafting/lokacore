# Owner decision: cartridge source by world area — 2026-11-04

Written 2026-11-04 in Claude Code (developer, loka-vduxr.58.1), from [HANDOFF](../HANDOFF.md) item
"Area layout" and the [area layout design](../rnd/cartridge-area-layout-design-2026-11-04.md)
section 12. The owner's words are paraphrased.

Owner, 2026-11-04 (paraphrased): yes to all twelve recommendations. Also: no area field in a
definition; an unknown folder inside an area and a folder name that is not lowercase snake_case are
compiler errors; write it down for authors in the Builders' Guide, with a line in AGENTS.md.

## Effect

1. The root folders are the shared layer; there is no `shared/` folder.
2. The border rule: an area's file names its own definitions, the root and any area's rooms; all
   else crosses via the root. A violation is a compiler error, not a warning.
3. An area's folder name is an implicit zone of its rooms; explicit `zones` stays.
4. No area-prefixed key rule; keys stay global.
5. Orphan room, unreachable area and astray room are `mix loka.lint` findings; a room that keeps
   stock is not an orphan.
6. Words are inline by default; shared lines stay in the root `text.json`; no per-area text file.
7. `layout.json` stays one root file.
8. A bundle `areas/<area>.json` stays the one-file form of an area.
9. Area indexes are generated and committed (`bin/regen.sh`).
10. `toolbox_showcase` migrates to area folders with its content hash unchanged.
11. Samplers stay flat; both forms are legal in one cartridge.
12. No new DiagnosticCode: the refusals are `SCHEMA_VIOLATION` with a `why`.
13. A definition has no `area` field: a stray one is `UNKNOWN_FIELD`.
14. An unknown folder inside an area (`UNKNOWN_FIELD`) and an area folder name that is not a Key
    (`SCHEMA_VIOLATION`, `why` `area_name`) fail the compile.
15. The [Builders' Guide](../BUILDERS-GUIDE.md#cartridge-layout) "Cartridge layout" section is
    the author's reference, and AGENTS.md makes it a must-read before creating, moving or
    restructuring cartridge files.
