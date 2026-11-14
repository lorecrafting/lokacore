# Review: K1 named conditions

Written 2026-11-14 08:24 UTC in the Pi harness by deploy/deepseek-ai/deepseek-v4.1-flash-1017 (role reviewer)

Head `c0d0ae997` on `story/k1-named` (`9ca46a8c1` the feature, `c0d0ae997` the cycle-walk fix), diffed
against base `b605393da`. Verdict: **APPROVE** — the claim holds: the artifact never carries the leaf,
the byte-identical test compares two independently built cartridges, and the cycle check and the
expansion now agree on where a named leaf can sit. One minor authoring hole (duplicate condition keys
are silent) and four nits below; none blocks.

`mix test test/loka/content_conditions_test.exs` — 7 passed. `mix test test/loka/content_source_schema_test.exs
test/loka/source_reference_test.exs` — 5 passed (the committed `schemas/source` is the generator's output).

1. **Minor — two condition files with one key: one silently wins.** `Source.@dirs` (`lib/loka/content/source.ex:217`)
   has no `"conditions"` entry, so the duplicate-definition stage (`Areas.unique`, called at
   `source.ex:73`, over the `@dirs` kinds) never sees `:condition`. `Conditions.lower/2` then builds
   `Map.new(conditions, ...)` (`lib/loka/content/conditions.ex:59`), which keeps the last file. An
   author with `conditions/x.json` and `areas/<area>/conditions/x.json` (both classify as
   `{:condition, "x", []}` via `classify/1` → `placed/1`, `source.ex:255`) gets one condition and no
   `DUPLICATE_DEFINITION`, unlike every other kind. Fix: group the split-off conditions by key and emit
   `DUPLICATE_DEFINITION` at each site (same shape as the other kinds) before `Map.new`.

2. **Approved departure — `Source.contracts/0` widening reaches every Policy position.** Checked
   structurally, not from the PR text: `contracts/0` widens the one `"Policy"` def
   (`source.ex:401`), every Policy position is `$ref: Policy` (`schemas/source/defs.schema.json` has 11
   such refs plus 22 `partial.Policy` properties, all of whose nested `items`/`item` ref `$defs/Policy`),
   and the generated `partial.Policy` carries the same `named` branch (`"const": "named"` appears twice
   in that file, once for each def). Runtime and editor agree: `Contracts.detailed("Policy", %{"op" =>
   "named", "key" => "x"}, Source.contracts())` is `:ok` while the same value against
   `Loka.Core.Contracts.defs()` (the protocol's Policy) is an error. So room, entity, quest, dialogue,
   reaction, cartridge, action and gameview all accept the leaf, and the artifact's Policy still does
   not.

3. **Cycle detection is complete after `c0d0ae997`; expansion was already sound on its own.** `names/1`
   (`conditions.ex:175-178`) was the only recursion site that handed a map pair to a recursive call;
   `substitute/4` destructures pairs and lists explicitly (`conditions.ex:112-140`) and `closure/3`
   walks the key graph, so neither had the bug. The check and the expansion now share one leaf shape
   (`map_size == 2`, same guard in `names/1` and `substitute/4`), which is what makes the check exact
   rather than merely conservative: a `named` map with an extra key is in neither the graph nor a
   substitution, and is refused as a Policy at its file or site instead of looping.

4. **No memo poisoning.** `known` is written only after a condition is fully substituted
   (`conditions.ex:124`, `{:ok, value}` from `fresh/2`) and cycle keys are marked `:invalid` before any
   expansion (`conditions.ex:100-101`), so a half-expanded Policy is never memoized; a repeat use
   returns `{st, []}` and reads the complete value (`conditions.ex:118-121`). The nested-cycle test is
   the witness: exactly two `CONDITION_CYCLE` faults and no third cause, which a poisoned or
   re-expanded entry would produce.

5. **Diagnostics land where the brief says, verified in code and tests.** Cycle: `cycle_fault/2` uses
   the condition file's own `rel` (`conditions.ex:96`), so `conditions/trusts` — asserted by both cycle
   tests. Unknown key: `under(at, "key")` (`conditions.ex:126`), so
   `rooms/reed_path.variants[0].when.key` — asserted. Nit: for a condition defined in an area folder the
   same code reports `areas/<area>/conditions/<key>`, while the table in `docs/system/cartridge.md`
   (Named conditions) writes the path as `conditions/<key>`; the code is right, the table's wording
   should say "the condition's file".

6. **`explain.ex` is additive.** The hunk adds one `CONDITION_CYCLE` row (line 32) to the placeholder
   table; no existing code's path or message changed. Not an authoring regression. Nit: `CONDITION_CYCLE`
   will be described for every cycle with the same prose, which is all `data {}` can support — fine.

7. **The byte-identical test builds both sides independently.** `gated(@named)` plus
   `conditions/found_tracks.json` versus `gated(@leaf)`, each compiled from the `facts_sampler` copy, and
   the assertion is `named == hand` over the whole `{:ok, bytes, warnings}` result, not over a
   re-serialization of either side. Sound.

8. **The protocol change is the smallest honest one.** `CONDITION_CYCLE` is a new cause that neither
   `UNRESOLVED_REFERENCE` nor `CONTAINMENT_CYCLE` names, `DiagnosticCode` is the compiler's closed set
   (the loader trusts a hash-valid artifact, so no cartridge bytes, content hash or kernel switch moves),
   and `bin/regen.sh`'s four generated outputs follow. The K1 ruling line was amended in the same
   commit, so the "no protocol change" claim is not left standing as false.

9. **The mutation table in the PR body is stale and was unsound where it mattered.** Its six rows name
   tests that do not exist under those names (the suite's are "two sites naming one condition build the
   hand-inlined artifact byte for byte", "…through another is CONDITION_CYCLE at both files", "a
   condition naming itself…", "…naming no condition is UNRESOLVED_REFERENCE", "…that is no Policy is
   SCHEMA_VIOLATION", "…naming a condition inlines through both levels"), and its gate line says 6
   passed where the suite now has 7. Its cycle row was exercised only by flat Policies, which is exactly
   the gap `c0d0ae997` closed, and the new nested test is not in the table. Of the six, five are
   verifiable against a named test that would fail; the cycle row's red is now a timeout (the walk
   recurses forever) rather than an assertion, which is a valid but slow red. I did not re-run the six
   mutants myself, so "each broke a named test" rests on the commit messages, not on my run.

10. **Residual risk, unverified.** Substitution copies rather than shares (`conditions.ex:112-149`), so a
    condition that names one condition twice and is named twice doubles the Policy per level; a deep
    diamond chain expands exponentially while `NESTING_TOO_DEEP` stays satisfied (depth is small, width
    is not). No test or cap covers it. Not a defect for realistic cartridges, but worth a size or
    expansion-count cap if conditions become common.

Local only: the record is committed on `story/k1-named` and not pushed — the reviewer role forbids
pushing; the PM pushes the record commit with the next step.
