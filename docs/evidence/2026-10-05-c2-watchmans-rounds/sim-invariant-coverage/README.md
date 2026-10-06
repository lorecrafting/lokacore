# C2 simulator invariant inventory followup

Base: `6143fb74303b5dda9b8826ba1d15db2cef5288dc`, including reviewed C2,
preserved-terminal evidence and published Web PR213. Frozen followup source:
`05bed5bee4c60745df2f320d73df126399a1128a` (after the spec-first protocol commit).
C2 gameplay source/approvals remain unchanged; this fixes the simulator inventory.

The existing registry-coverage test failed because `patrol_transitions_hold` was
registered but absent from `sim.ts`’s `CHECKED.step`. The runner already calls every
listed check on each step. Add that single entry; frozen demo steps with no patrol
operation still check the empty delta, while dedicated C2 gameplay/literal fixtures
prove actual patrol transitions. Generator17, regression seeds, frozen cartridge
answers and chapter/API/hash/IDs are unchanged.

[Checks](checks.json) and retained logs show the exact coverage command
[red on the unmodified base](baseline-red.log), [green with the entry](coverage-green.log),
[red after actually deleting it](deletion-red.log), and
[green after restoration](restored-green.log). The existing test catches this exact
break, so no duplicate coverage-only test was added. The
[full local simulator plus patrol/literal suites](focused-green.log) passed26 tests,
including500 fresh simulation sequences and existing simulator planted controls.
[Kernel typecheck](typecheck.log), focused TS size/format, docs and
contracts/features regeneration checks passed. Full accumulated publication checks
and independent source review belong to the parent’s handoff.

Actual-diff correctness review: entry is in the per-step list, not the host-only
exception map; no skip, fixture weakening, generator re-curation or gameplay
behavior changed. Ponytail Review: one inventory entry; compact the existing
split comment to retain the500-line file budget without raising an allowance.
Lean already. No owner save, browser or native operation was performed.
