# Owner decision: retire Ashmere, the app bundles the showcase — 2026-10-21

Written 2026-10-21 in Claude Code by anthropic/claude-opus-5-5 (developer).

## Decision

- Owner (quoted): "i thought ashmere was retired, lets retire it".
- Owner (AskUserQuestion, 2026-10-21, quoted): "Showcase default now, delete later (Recommended)".
- Owner (quoted): "okay lets come up with a plan to retire ashmere, right now we should only be
  having the showcase, and then rebuilding the real game from 0 after ui polish".
- Phase 1 (`loka-4hik.1`): the app bundles the [toolbox showcase](../SHOWCASE.md) as its chapter
  through the same import ([current bundled chapter](../system/cartridge.md#current-bundled-chapter)).
  Its save is keyed by the artifact's hash, so the showcase build starts fresh on each content
  change (pre-production); earlier saves, `loka-ashmere-missing-child.db` included, stay untouched
  and are never deleted. Browser tests that only checked Ashmere story content are deleted; the
  Book and save checks move onto the showcase.
- Later phases (epic `loka-4hik`) delete the Ashmere sources, fixtures and the tests that load them
  explicitly. Until then they stay, with the E1 recorder that certified the
  [retired chapter](../system/cartridge.md#retired-ashmere-chapter-e1-candidate).
- The first release will bundle the real game's chapter, rebuilt from zero after UI polish.
