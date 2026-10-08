# PM decision: E1 batch F world, resource and cask witnesses — 2026-10-07

**PM decision, 2026-10-07 (paraphrased from the batch F brief's final decisions).** It governs
the [world-setting and resource witness rule](../system/architecture.md#e1-exact-candidate-proof-policy)
for Beads issue `loka-e1-r9-certification-2rz.11`.

1. **Witness depth.** One exact exercise of a setting's primary literal witnesses that setting's
   path. The rule names that literal for each path. Multipliers and other fields of the same
   setting are not separate obligations, and crediting one path never certifies the owner's
   capability family. For bands, one label shown for its exact percent is enough.
2. **`/resources/ma` is outside batch F.** Batch E records its disposition; batch F has 13 paths.
3. **`/world/carry`: option (a).** The [controlled refusal](pm-decision-e1-controlled-refusals-2026-10-07.md)
   rule extends to world settings: an accepted pickup at or under `max_grams`, plus a refusal one
   gram over, together witness `/world/carry`. A minimal new recorder case is allowed if no
   existing case reaches the limit.
4. **`death` and `water`:** if no existing case commits them with the authored literals, add a
   minimal new case. If neither a lawful case nor a defensible rule exists, stop and report; no
   disposition.

## Developer note (pending PM confirmation)

- v042 item masses are multiples of 5 g, so no load lies one gram over `max_grams`. The rule
  credits a `too_heavy` refusal whose committed before load equals `max_grams` exactly; the
  refused mass m bounds the literal to [`max_grams`, `max_grams` + m). The accepted half is the
  committed load itself; no pickup step is checked separately.
- The gain-pool clause also matches `ma`, but no v042 execution changes `ma`, so it is never
  credited.
