# Review: experience and levelling, toolbox row 4 (PR #344, loka-kgd.11)

- PR #344, branch `toolbox/batch-m2`, head `05a960e5` (kgd.11 commits `4f7ff6f7`..`60a713d6`; the main merge is not reviewed). Save and protocol change, so this record is kept ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md) item 5).
- Governing: [mechanics.md row 4](../system/mechanics.md#experience-and-levelling-toolbox-row-4), [resource@1](../system/mechanics.md#resource1-kerneltssrcmechanicsresourcets), PM rulings in `loka-kgd.11`.
- Verdict: **CHANGES REQUIRED** (three core-logic mutants survive the focused suite).

## Must be true

1. A credited kill grants experience only for an NPC definition listed in `kills`, in that amount. Several grants in one decision chain.
2. `experience.grant` adds its amount for the actor. Experience saturates at the ResourceInt maximum.
3. Level is 1 + the thresholds at or below experience. Unspent is `points_per_level × (level − 1) − Σ allocated`.
4. `levelling.set` composes in both kernels only when `expected` matches and neither experience nor any allocated count falls.
5. Raise is offered only while unspent > 0. An unauthored attribute is refused. Raise and choose_ancestry settle the hp max first.
6. `value()` is base + allocated + worn, saturated. The D11 row is unchanged.
7. The row survives reopen. A failed COMMIT is not adopted. A lost ack commits once. Replay keeps the level-up line.

## Proof

- Baseline: `levelling.test.ts`, `derived.test.ts`, `levelling_composition.test.ts` all pass.
- Probes on the compiled sampler: an unknown attribute (`luck`) and a foreign cartridge's `str` both pass `resolve` and are refused only by `rule.ts:15` (`not_found`). `points_per_level` 3 gives unspent 3. Kills at the ResourceInt maximum saturate. One kill crossing two thresholds adds one `level_up` line.
- PR claims rerun and both hold: the offer filter removed (`actions.ts`) fails 2 tests; `levelling` dropped from `rows.ts` SECTIONS fails the SQLite test (experience 0 on reopen). Elixir `kept` dropped fails `allocated-point-removed-refused`.
- Mutants that stay green (all 3 focused kernel files): M1 `rule.ts:15` not_found check deleted; M2 `credit.ts:30-31` `kills.find(() => true)`; M3 `levelling/shared.ts:22` `points_per_level *` dropped; M4 `levelling/shared.ts:58` `saturate` dropped.
- Book: the page's `save not confirmed` note was dropped correctly. `Status.tsx:82-86` draws it on every page except the ancestry picker (`Book.tsx:191`). The level, xp and Raise lines match the PR body's designer lines.

## Findings

1. **blocker**, `kernel/ts/src/mechanics/combat/credit.ts:30-31`: no test kills an NPC that is not listed (M2 green). Failure: a regression that grants every credited kill (e.g. guards, quest NPCs) survives. Fix: a sampler kill of an unlisted NPC that asserts experience is unchanged, or give rats different amounts.
2. **blocker**, `kernel/ts/src/mechanics/levelling/shared.ts:22`: with the sampler's `points_per_level` 1, dropping the multiplier changes nothing (M3 green). Fix: one case with `points_per_level` 2 (a loaded-cartridge change like the loader rows) that asserts unspent 2.
3. **should-fix**, `kernel/ts/src/mechanics/attributes/rule.ts:15`: this is the only guard against an unauthored attribute (probe above), and no test sends one (M1 green). Failure: without it, `Raise luck` spends the point on nothing. Fix: one forged `raise_attribute` with an unknown key at unspent 1, expecting `not_found`.
4. **should-fix**, `kernel/ts/src/mechanics/levelling/shared.ts:58` and `mechanics/reaction.ts` `gained`: saturation is in the spec and untested (M4 green). Fix: one row with a kill amount at the maximum that asserts experience 2147483647.
5. **should-fix**, `docs/system/cartridge.md:1474` and `protocol.md:1293`: rows 1 to 3 have cartridge.md (and row 1 protocol.md/save.md) entries; row 4 has none. Failure: a builder finds no `world.levelling`, `experience.grant` or API 1.42 floor in the cartridge doc; protocol.md does not list the `levelling` target, section or `levelling_composition.json`. Fix: one cartridge.md paragraph and one protocol.md paragraph linking row 4.

## Open

- `book-ui.md` row 4 text is the designer's to write before the PR is marked ready.
