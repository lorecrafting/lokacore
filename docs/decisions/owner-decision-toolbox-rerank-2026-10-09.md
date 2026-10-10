# Owner decision: re-rank the mechanics toolbox, vocabulary first — 2026-10-09

(paraphrased) The owner adopted the re-rank proposed by the
[mechanics roadmap review](../reviews/2026-10-09-mechanics-roadmap-review.md) (Beads `loka-kgd.14`).

## Effect

- **Order:** [MECHANICS-TOOLBOX.md](../MECHANICS-TOOLBOX.md#ranked-toolbox) follows the review's
  batches M3 to M15: shared vocabulary rows first (property tags, damage kinds, statuses and
  attributes on NPCs and things), then the dungeon-crawl rows, then economy and law.
- **Gap rows G1 to G13** join the table; G13 (hunger, thirst, fatigue) is content only.
- **Merges and splits** as the review proposes; retired rows stay in the table as
  `merged into row N` or `split into …`. Row ids stay stable because code, tests and anchors cite
  them; a Rank column carries the order.
- **Two conflicts fixed:** row 17's sampler is a same-room first strike, adjacent rooms later
  ([toolbox decision §2](owner-decision-mechanics-toolbox-2026-10-08.md#answers-to-the-open-questions));
  row 32 fast travel never skips the clock: a transport job over real elapsed time, or instant
  with no clock change ([fixed time](owner-decision-fixed-time-2026-10-03.md)).
- **Opt-in rule:** every new mechanic is opt-in by a cartridge field; Chapter 1 and the seeded
  corpus stay unchanged.
- **Settlement rows S1 to S4** (furnishing, construction, settlement, settlement defense) come
  from an owner question on housing and real town building (PM addition, same day): Realm-first in
  value, sampled in Story mode. S2's runtime-created rooms and exits change the world-graph
  contract and need their own decision record first. G7 becomes per-entity access locks evaluated
  by the existing policy engine (owner reference: Evennia lockstrings); staff and builder
  permissions stay out of scope as Realm authority.
- The review's other risks (rows 3 and 4 as attribute writers, row 9 RNG, row 29 incantation
  input, row 48 last) are raised at each row's brief, not decided here.
