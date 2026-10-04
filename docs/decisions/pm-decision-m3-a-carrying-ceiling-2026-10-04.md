# PM decision: M3-A carrying ceiling — 2026-10-04

Under the [owner delegation](owner-decision-autonomous-mechanics-2026-10-03.md), the PM selects
voluntary carrying admission in [containment](../system/mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets),
with the [cartridge opt-in](../system/cartridge.md#carrying-settings-and-item-mass) and
[rule/projection budget and refusal contract](../system/protocol.md#budgets). These are PM
choices, not exact owner preferences or an imported STR formula.

The sampler balance selected for its next carrying consumer is max 12000 grams; lantern 2000,
wool_cloak 3000, brass_key and cellar_key 100 each, tin_whistle 200 and trunk shell 8000.
The full trunk weighs 8200. This supports the existing attic choice through Contents and
Remove→Drop, with the non-action [item-page reason](../system/book-ui.md#item-details-and-takedrop). It ships in sampler0.0.6 requiring API1.3 after reviewed M2.

Implementation adopts the reviewed M2 merge `d5473311ec33626ca9dbc95ca60974b0da539351`.
The carry limit uses the shared integer validator’s safe range in both kernels, without a
redundant schema maximum; direct malformed source/load controls retain that boundary.
