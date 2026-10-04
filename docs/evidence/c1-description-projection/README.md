# Explicit entity description projection: headless proof

[PM adoption](../../decisions/pm-decision-description-projection-2026-10-03.md)
stacks on the final mechanical reorganization `48405cd`. One existing projection site
copies `e.description` into EntityView/ContentView. Optional shared wire fields retain
`loka-gameview-v1`; the current projection always supplies each required authored field.
The existing generator emits the TypeScript and contract documentation changes.

[Focused checks](focused.log) and [restoration](restored.log) pass 34 existing kernel/schema
tests. Literal projection expectations cover NPCs/items in a room, held items, worn
items, open containers and flattened reachable contents. Closed/locked contents remain
hidden. The controlled cap's explicit key `catalog.cap_body` is unrelated to its short name;
room NPC, held cap and worn cap keys are checked without deriving expected values from the
projection. Existing valid schema examples omitting descriptions remain unchanged and
pass; two appended malformed provided-key cases expect `/description: pattern_mismatch`.

Actual restored red controls:

- [Omit the projected field](mutant-omission.log): existing literal full-object expectations fail.
- [Map short name as description](mutant-wrong-field.log): authored-description assertions fail.
- [Infer a suffix from the name](mutant-inferred-key.log): `catalog.cap_body` assertion fails.
- Replace [EntityView](mutant-EntityView-textkey.log) or [ContentView](mutant-ContentView-textkey.log)
  description's TextKey reference with an unrestricted string and regenerate: each malformed
  key is incorrectly accepted, so its independent expected-error case fails.

All five mutants actually exited 1 and were restored; focused checks then passed.
The [generator drift check](generated-check.log) passes. [Frozen-byte verification](frozen.json)
compares every cartridge source and all twenty cartridge hash fixtures against `48405cd`,
including the nineteen older sets and the sampler's unchanged
`813fdf67dab4a1276362b2e3bdad08de8ae51b06d89f2e53bd64de0b1d001caa` pin.
The original view examples and invalid rows remain intact; schema changes are limited to
the two optional properties, descriptions and positive examples, plus two appended malformed
cases. State/save formats and simulator generator/pool/seeds are unchanged.

Ponytail Review: lean already. The single existing projection function serves all paths;
no dependencies, abstraction, helpers or production test hooks were added. Correctness
self-review checked the actual diff, explicit-key mapping, optionality and old omissions,
container visibility, generated outputs and immutable cartridge/persistence boundaries.
No UI files, native operations or owner save actions were touched. Final normal pre-push,
exact-head CI, fresh independent source review and combined native proof remain pending.
