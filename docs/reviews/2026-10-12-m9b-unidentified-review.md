# Review: toolbox row 27, unidentified items (loka-kgd.112)

- Branch `toolbox/m9b-unidentified`, head `58b0ecda4b52fc71d360481d6dec06062289bcb9`, diffed against `d461c38e` (`toolbox/batch-m9b`). No PR (batch model). Installed `kernel_api` 1.66 to 1.68 (provisional, merge order assigns the minor).
- Governing: [Unidentified items](../system/mechanics.md#unidentified-items-toolbox-row-27) (added here), [item affect declarations](../system/cartridge.md#item-affect-declarations), [worn affects details](../system/book-ui.md#worn-affects-details), [row 3](../system/mechanics.md#item-slots-and-affects-toolbox-row-3), [W6](../system/mechanics.md#entity-description-variants-toolbox-row-w6), toolbox row 27, C2-M06 ([later mechanics](../archive/LATER-MECHANICS.md)), Beads `loka-kgd.112` (brief and PM rulings 2026-10-12: one plain fact per definition; base text is the unidentified name; value includes the bonus, only the worn note waits).
- Hosted `ci` and `book-e2e` green on the head (`gh run list --commit`, reviewer).
- Verdict: **APPROVE WITH NOTES** (no blocker; one should-fix schema description).
- Written 2026-10-12 05:05 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Completed with tools (tests, mutants, CI) after a static first pass by a reviewer harness without a shell; every static finding was rechecked here.

## Must be true

1. A worn unidentified item's affects still apply (attributes@1 `value` unchanged; `stat_compare`, derived stats, hp max see them).
2. Only the GameView `worn` note filters on identity; an item without `identified` behaves as before.
3. `identified` is a bool, non-per_subject plain fact of the cartridge, needs `affects` and `kernel_api` 1.68; compiler and loader both refuse otherwise (loader alone: per_subject).
4. True name is the W6 variant; base text is the unidentified name.
5. No new op, verb, event or save row; affects_sampler and Chapter 1 bytes unchanged.

## Proof

- Green at head: `kernel/ts/test/identify.test.ts` + `affects.test.ts` (9 pass); `mix test --force test/loka/content_derived_test.exs` (3 pass).
- Mutants (each reverted, each red): M1 view drops `true` (`view/skills.ts:74`); M2 `value()` filters too (`attributes/shared.ts:35`); M4a loader floor off, M4b loader type check off, M4c loader affects check off, M4d loader `named` off (`cartridge_derived.ts`); M5 compiler 1.68 floor off, M5b compiler type check off, M5c compiler affects check off, M5d compiler `Refs.reference` off (`derived.ex`); M6 the `identified` short-key `expand` clause dropped (`checks.ex:113`).
- M3 (`=== true` to `!== false`, `shared.ts:65`) stays green and is equivalent: a bool fact requires a boolean default (`protocol/fact.schema.json:20-23`), `value` falls back to it (`fact.ts:59`), and a non-bool fact is refused (`cartridge_derived.ts:92`, `derived.ex:95`); a per_subject one is refused by the loader site walk (test row passes).
- Callers of `worn` (`shared.ts:35`, `skills.ts:74`) checked: only the view passes `identifiedOnly` (point 1, 2). Elixir `Refs.resolve` and the TS `c.facts[...]` lookup both read only this cartridge, so the type check cannot differ between kernels.
- Cites rerun: AttributeView description (finding 1); `protocol/fact.schema.json:20-23` bool default required.
- No frozen fixture touched; expected values are literals (12, 2, 10, text keys).

## Findings

1. **should-fix**, `protocol/gameview.schema.json:2360`: AttributeView says `worn` is "the nonzero sum its worn items grant", but `attributeViews` now sums identified items only (`kernel/ts/src/view/skills.ts:74`, `kernel/ts/src/mechanics/attributes/shared.ts:65`). Scenario: a presenter or client author reads the contract, sees PER 12 with no `worn` while a +2 ring is worn, and treats it as a bug or computes the note itself. Amend the description (identified worn items only, row 27) and regenerate `kernel/ts/src/contracts.gen.ts` / `docs/contracts.gen.md`.
2. **nit**, `cartridges/identify_sampler/text.json:6` and `docs/system/mechanics.md:2407`: the room line has no variant, so after identification a dropped ring in the hall reads "A dull ring lies on a shelf." while inventory says "a ring of keen sight". Add a `room_line_variants` entry, or say in the Name bullet that the room line stays the unidentified text.
3. **note for the designer**, `docs/system/book-ui.md:997`: the "`worn` sums identified items only" sentence is marked proposed, designer to approve (PM ruling); not a finding.

## Fix re-check (`91aee80aa526ed619e4ea9ee09e29f0eb53f40b3`)

- Written 2026-10-12 05:16 UTC in the Pi harness by anthropic/claude-opus-5-5 (reviewer).
- Scope: the fix commit only. Verdict: **APPROVE** (both findings resolved, nothing new).
- Hosted `ci` and `book-e2e` green on `91aee80a` (`gh run list --commit`, reviewer).
- Finding 1, resolved: `protocol/gameview.schema.json:2360` AttributeView now says `worn` counts identified items only (row 27; value still moves); `kernel/ts/src/contracts.gen.ts`, `docs/contracts.gen.md`, `docs/system-graph.gen.json` carry the same text. `elixir bin/contracts.exs --check` exits 0 at the fix head (reviewer).
- Finding 2, resolved: `cartridges/identify_sampler/items/ring.json` adds a `room_line_variants` entry on `fact_compare ring_known = true`, text `item.ring.room_known` ("A ring of keen sight lies here.", `text.json:7`). No new test holds: item `room_line_variants` resolution and reference/text-key checks are covered by `kernel/ts/test/variants.test.ts:135-145` and `kernel/ts/test/cartridge_items.test.ts:91-131`, and `kernel/ts/test/identify.test.ts` compiles the sampler, so a broken variant fails it (mutant: `item.ring.room_known` deleted from `text.json`, `mix loka.compile` refuses, identify.test.ts red; reverted). The `docs/system/mechanics.md` Name bullet still names only `short`/`description`; content choice, not a finding.
- Green at fix head: `identify.test.ts`, `variants.test.ts`, `cartridge_items.test.ts` (16 pass, `node --test`).
- Note 3 (`docs/system/book-ui.md:997`, designer approval) unchanged, as expected.
