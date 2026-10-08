# PM decision: E1 batch F world, resource and cask witnesses — 2026-10-07

**PM decision, 2026-10-07 (paraphrased from the batch F brief's final decisions).** It governs
the [world-setting and resource witness rule](../system/architecture.md#e1-exact-candidate-proof-policy)
for Beads issue `loka-e1-r9-certification-2rz.11`.

1. **Witness depth.** One exact exercise of a setting's primary literal witnesses that setting's
   path. The rule names that literal for each path. Multipliers and other fields of the same
   setting are not separate obligations, and crediting one path never certifies the owner's
   capability family. For bands, one label shown for its exact percent is enough.
2. **`/resources/ma` is outside batch F.** Batch E records its disposition; batch F has 13 paths.
3. **`/world/carry`: option (a), as ruled in E1-F2 (fix round 1).** The [controlled refusal](pm-decision-e1-controlled-refusals-2026-10-07.md)
   rule extends to world settings. `/world/carry` is credited only when one case has both:
   an accepted take whose committed load after the step is exactly `max_grams` (12000), and a
   later `too_heavy` refusal of a positive-mass pickup at a load of exactly `max_grams`. A load
   reached by a forced transfer does not count (corpse recovery bypasses the carry check), and
   the refusal alone credits nothing. v042 masses are multiples of 5 g, so no load lies one gram
   over. A minimal new recorder case is allowed if no existing case reaches the limit.
4. **`death` and `water`:** if no existing case commits them with the authored literals, add a
   minimal new case. If neither a lawful case nor a defensible rule exists, stop and report; no
   disposition.

## Developer note (pending PM confirmation)

- The gain-pool clause also matches `ma`, but no v042 execution changes `ma`, so it is never
  credited.
