# PM decision: re-rank 2, immersion rows and foundation primitives — 2026-10-09

(paraphrased) The owner asked for a second mechanics review aimed at a deeply immersive RPG. The PM
adopted [review 2](../reviews/2026-10-09-mechanics-review-2.md) in full under mechanics autonomy
(Beads `loka-kgd.15`). It builds on the [first re-rank](owner-decision-toolbox-rerank-2026-10-09.md).

## Effect

- **New rows** in [MECHANICS-TOOLBOX.md](../MECHANICS-TOOLBOX.md#ranked-toolbox): W1 to W16, W21,
  W22 (world memory and atmosphere) and 2c (status modifiers on derived stats and attributes).
  Two foundation primitives come before their consumers: W1 reactions on every event (M3) and W2
  entity and pair facts (M6).
- **Merges:** G6 and W4 become one senses row (G6); row 31 is rewritten as W5's derived sky and
  moves to M4 (id 31 kept, W5 marked merged); row 41 becomes decay content on G3 and W1
  (perishables, corpse decay, dropped-item cleanup); W14 joins G10 as the writing group; 46 gains
  the Journal lore tab. Merged rows stay visible as `merged into row N`.
- **Corrections:** rows 18 and 42 are content on 2c, not on row 1, because a +str buff modifies an
  attribute, not a per-tick resource. Rows 38 and 39 become content on W1 and 37b content on the
  existing `fact_changed` trigger; 37a carries the `population.spawn` apply step. Row 39's brief
  confirms W1 exposes the target body and an HP-max percent, or the row reverts to engine work.
- **Reshapes:** G3 leads M5 and emits status tick and expiry events; row 9's RNG draw is a per-plan
  option; disposition (G11) is a derived read of a W2 pair fact and a faction fact; G7 grant rows
  are stored as W2 pair facts (W2's pair scope covers a thing and a character) (the owner's "saved grant rows" wording kept); S3 gains W10 and W11.
- **Order:** the review's section 3 batches, every dependency on an earlier row, row 48 last
  before Settle and Realm.
- **Process:** G1's slice designs the policy leaf set once; the toolbox slice process lists the
  review's twelve traps.
