# Review: toolbox row W6, entity description variants and two leaves (loka-kgd.37, batch M5)

- Local branch `toolbox/m5-variants`, head `34ed2345be610ef7a70d4b3968c54e31dc11ccc8`, base `origin/toolbox/batch-m5` `7feb46e1` (merge-base). No PR (batch draft workflow); the developer's `/code-review medium` result is in Beads `loka-kgd.37` (8 findings: fixed, documented or disputed). Protocol schema, registry and `kernel_api` change, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [toolbox row W6](../MECHANICS-TOOLBOX.md#ranked-toolbox); [policy leaf set (G1)](../system/mechanics.md#property-tags-and-the-policy-leaf-set-toolbox-row-g1); [description_variant@1](../system/mechanics.md#description_variant1-and-inspectable_detail1-mechanicsdescription_variantrulets); PM rulings in Beads `loka-kgd.37` (2026-10-10).
- Hosted CI on the full sha: ci success, book-e2e success.
- Verdict: **APPROVE WITH NOTES** (one should-fix, PM-mandated rename; one nit; no blocker).

## Must be true

1. Base `short`/`room_line`/`description` stay mandatory; a variant replaces one only when its `when` holds, first match wins.
2. Each new leaf follows the leaf-set rule: schema branch and invalid fixtures, one registry owner, one `holds()` case (pure read), `LEAF_REFS` and `LeafRefs` entries equal, parity test.
3. Leaf names follow G1 naming and clash with no existing capability or fact (PM: `position` must become `npc_present`).
4. Both kernels refuse the new lists and leaves below `kernel_api` 1.46 the same way; an item's pre-existing `room_line_variants` still load at 1.0.
5. No existing cartridge changes bytes or play (Chapter 1 artifact, item room-line variants now read with a target).
6. No Elixir xref cycle; the restored G3 Attributes sub-bullets are correct and appear once.

## Proof

- (1) `describe` unchanged except passing `target` (`description_variant/rule.ts:49-53`); `describeEntity` reads base plus `<field>_variants`; schema keeps base fields required.
- (2) `policy.ts:74-77` one case each; `status_active` owned by status@1 (`capability_registry.json:193-195`), `position` by target_resolution@1 (`:109`); `cartridge_leaf_refs.ts:13-14` equals `leaf_refs.ex:19-20`; `invalid.json` +241/-0 (five rows: both leaves' bad shapes, empty and 17-item `TextVariants`).
- (4) TS `nodes()` walks variant roots via `parts()`, so the loader floor sees leaves in item `room_line_variants` as the Elixir tree walk does; the two floors agree on every row of the twin tests.
- (5) All 40 pre-existing cartridges compiled with base and head Elixir: byte-identical. The only item room-line variant in the corpus (`ashmere_items` lantern) uses `has_item`, which ignores the target: no play change.
- (6) `mix xref graph --format cycles` and `--label compile-connected`: no cycles. Sub-bullets match `5fea8c3c` except the completion clause, now pointing to W6; each occurs once; the `07b0bd7d` dedupe had dropped them.
- `present()` (`commands/target.ts:85-87`) compares the body's direct container too, so the developer's dispute on a body inside an item stands.
- Mutants (focused files, all red): `here()` without `living` (`variants.test.ts`); `describeEntity` without the target (`variants.test.ts`); NPC `room_line_variants` dropped from the TS floor (`variants.test.ts`); `position` removed from `LEAF_REFS` (`tags.test.ts`); NPC variant expansion removed in `npc_fields.ex` and leaf walk removed in `variants.ex` (`content_variants_test.exs`).

## Findings

1. should-fix (PM ruling), `protocol/policy.schema.json:437`: leaf `position` shares its name with the position@1 capability (`capability_registry.json:162`) and its `position` posture fact; an author writing `requires position` and `op: position` reads two unrelated things. Rename to `npc_present` (G1: a boolean is an adjective, as `target_present`) at `capability_registry.json:109`, `kernel/ts/src/mechanics/policy.ts:76` and header `:6`, `cartridge_leaf_refs.ts:14`, `leaf_refs.ex:20`, `cartridge_variants.ts:2,13`, `variants.ex:4,30`, `cartridges/variants_sampler/recipes/shove.json:15`, `invalid.json` row `position_target_subject_no_npc`, `mechanics.md:1953,1984-1988`, `cartridge.md:1544`, `MECHANICS-TOOLBOX.md:112`; regenerate contracts.
2. nit, `docs/system/mechanics.md:1982`: the list of base-`short` readers omits the text player's take, drop and give narration (`kernel/ts/play/main.ts:145`): "You take a sword." while the room shows "a notched sword". Add it to the known-limit list.

Note: `lib/loka/content/compiler.ex` is at its 338-line allowance; the next slice to touch it splits it (PM ruling).

## Fix round 1 (`0c5a8eebe4a90c52bd5537ae58b3592988753b12`)

Scoped to `34ed2345..0c5a8eeb` (record cherry-pick `f816f052`, fix `0c5a8eeb`). Hosted CI on the full sha: ci success, book-e2e success.

- Finding 1, fixed: `npc_present` at every listed site: schema const, registry (`target_resolution@1` policies only; the `position@1` capability is unchanged), `policy.ts` case, header and helper comment, both leaf-ref tables, both floors, `shove.json`, invalid row `npc_present_target_subject_no_npc`, both tests, `mechanics.md:1953,1984-1985,1988`, `cartridge.md:1544`, toolbox row, and the generated `contracts.gen.ts`, `contracts.gen.md`, `features.gen.md`, `system-graph.gen.json`, `toolbox.gen.json`. The sampler keeps `"position": 1` (`cartridges/variants_sampler/cartridge.json:31`). No `op` `position`, `case 'position'` or `position {` remains in the tree.
- Finding 2, fixed: `mechanics.md:1982` lists the text player's take, drop and give narration. Line 1984 now reads "Why not owned by position@1", which is correct.
- Focused tests green (`variants.test.ts`, `tags.test.ts`, `content_variants_test.exs`). Mutant: `npc_present` without its `living` check is red in `variants.test.ts`.
- New nit, `docs/system/mechanics.md:1814` (G1 two-kernel parity bullet): still says "`status_active` and `position` came with row W6". A reader who follows the leaf-set rule looks for a leaf that does not exist. Rename it to `npc_present`; the PM can fold this into the batch.

Verdict after fix round 1: **APPROVE WITH NOTES** (one doc nit open).
