# Blueprint vocabulary and Builder's Guide review

PR: [#166](https://github.com/lorecrafting/lokacore/pull/166). Initial source:
`f0772da4d27dd9cd9ea9c6a7332a8647236cbe54`. Scoped fix source:
`35893eb85eb1f7a96ee22ee2eccb19aa8ff09373`. Fresh independent reviewer;
authored none of the source changes. Final verdict: **APPROVE**. No open findings.

## Requirements

Derived from the governing sections before reading the diff:

- [Cartridge source and compiler](../system/cartridge.md): retain the existing JSON
  format, capability validation, references and immutable compiled release identity.
  Blueprint names an NPC or item definition; cartridge names the content package.
- [Fresh-world mechanics](../system/mechanics.md#a-fresh-world): one entity per NPC
  or item definition today, with distinct identity and mutable state. A shared live
  spawner must not be described as installed.
- [Installed mechanics](../system/mechanics.md) and
  [future authoring](../system/future.md#authoring-and-certification): distinguish
  existing file authoring and bounded story mechanics from the planned Builder app,
  spawning and other future mechanics. Contract names and save pins remain stable.
- The guide's commands, examples and links must lead to the actual installed workflow;
  detailed contracts remain in their existing authoritative documents.

## Finding and scoped fix

**F1 — should-fix, closed.** At initial source, `docs/BUILDERS-GUIDE.md:59–65`
contained nine mechanics links whose fragments used `kerneltsrc` where the headings
produce `kerneltssrc`. Following movement, containment, barrier, equipment, resource,
quest, dialogue, reaction or chapter links opened the document without reaching the
requested section. Initial verdict: **CHANGES REQUIRED**.

Fix `35893eb` changes exactly those nine fragments. The scoped review compared the
fix with each target heading and independently checked all guide link targets and
17 fragments. F1 is closed; final verdict **APPROVE**.

## Verification

- Inspected the new guide/glossary and all terminology/navigation hunks, the fresh-world
  entity creation path, compiler task, terminal CLI, Builder boundary placeholder and
  linked recipe, NPC, quest, dialogue and scene JSON examples.
- Independently compiled `ashmere_bell` and replayed its committed
  `transcripts/action_recipe.jsonl` with the documented CLI: both exit 0,
  **six commands identical**. The subsequent fix changes links only.
- Final source docs check: **385 docs, zero broken links, zero unreachable**.
  A separate fragment comparison verifies the anchors omitted by the normal checker.
- Source-head CI: changes/lint successful; Elixir, TypeScript and simulator jobs skipped
  as expected for this docs-only change. No mutation testing required by the docs-only
  review stance.

Ponytail Review: **Lean already. Ship.** The guide links to existing contracts and
working examples; it introduces no format, abstraction or runtime machinery.
