# Review: toolbox row G3 second half, attributes on NPCs (loka-kgd.42)

- Local branch `toolbox/m5-npc-attr`, head `4fb227ce1f4490d38b8fd385df005690c1637c01`, base `9a9a97d5`; no PR yet (batch M5). Fresh Opus reviewer; record kept because the slice changes protocol (`entity.schema.json`, `action.schema.json`) and the `kernel_api` 1.46 gate ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row G3](../MECHANICS-TOOLBOX.md#ranked-toolbox) and its Beads brief; [row 2 derived stats](../system/mechanics.md#stats-derived-from-attributes-toolbox-row-2); [rows 5 and G5 opposed check](../system/mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5); [attributes@1](../system/mechanics.md#attributes1-kerneltssrcmechanicspolicyts60).
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix, two nits).

## Must be true (from the spec and brief)

1. An NPC definition may declare base attributes; they are definition data: no save row, no second durable attribute writer, no NPC training (traps 2, 11).
2. One NPC-side read path (declared value, else start), read at use, where 2c can add modifiers later.
3. An opposed check aimed at an NPC reads that NPC's value; checks without it are unchanged.
4. The damage formula reads the NPC's attributes (brief); NPCs and cartridges that do not opt in keep their bytes and behavior, Chapter 1 included.
5. Compiler and loader refuse the same unsound content at the same paths; new fields gated at `kernel_api` 1.46.
6. Brief proofs: a str check against a strong guard uses the guard's str; a poison status with a 2c-ready shape leaves the attribute untouched.

## Proof

- (1, 2) `attributes/shared.ts:55` `npcValue` is the only NPC reader; no op, row or writer added. Spawned NPCs carry `attributes` via the template spread (`runtime/created.ts:86`); death removes no entity, so a missing entity falls back to the start and never throws.
- (3) Mutant `rating` reads the start (`action_recipe/rule.ts:147`): `npc_attributes.test.ts` red.
- (4) Mutant drop `&& npc.attributes` (`combat/round_attack.ts:220`): `derived.test.ts` red (new test and the existing hp-15 test). No NPC outside `cartridges/npc_attr_sampler` declares `attributes`; no Chapter 1 or corpus file changed; `invalid.json` additions only.
- (5) TS mutant: drop the "declares the attribute" clause (`content/cartridge_recipes.ts`): loader test red (`loaded` instead of SCHEMA_VIOLATION at `check.npc`). Elixir mutant: `npc["spawn_template"]` → `false` (`content/recipes.ex:101`): `content_npc_attributes_test.exs` red. Floors match (`g3` / `g3?`).
- Focused runs at head (nice 10): `npc_attributes.test.ts`, `derived.test.ts`, `content_npc_attributes_test.exs` green. `gh run list --commit 4fb227ce…`: ci 5m17s and book-e2e 6m34s success.
- Cites rerun: `shared.ts:55`, `rule.ts:147`, `round_attack.ts:220` hold.
- Trial merge into `origin/toolbox/batch-m5` `8224faeb`: conflicts in `docs/system/mechanics.md`, `protocol/fixtures/invalid.json`, `action_recipe/rule.ts` (import list only: `DefinitionRef` vs `CharacterId`, keep both) and generated `contracts.gen.ts`, `system-graph.gen.json`, `toolbox.gen.json` (regenerate).

## Judgments

- **Derived attack on declaring attributes**: accepted. The brief names "damage formula"; it is opt-in per NPC, documented in `mechanics.md:1938-1940`, `cartridge.md` and the `derived` schema text, and affects no current NPC. Side effect to know: an NPC that declares only, say, `int` reads str at its start for hit and damage, so its attack moves when start ≠ pivot (documented: undeclared reads start). Question, not a finding: the brief says "damage formula"; applying `hit_chance` too is consistent with row 2's table pair, and the PM may confirm.
- **Poison-status proof**: not needed now. Row 2c's `modifies` does not exist, so no 2c-ready status can be authored; a test would assert that nothing writes a field nobody writes. Move the proof into row 2c's acceptance (Beads), not a silent drop.
- **Presence**: accepted as the documented W6 limit (loka-kgd.37): reading an absent or dead NPC returns its static value, never faults.
- **Six declined /code-review items**: not judged; see nit 1.

## Findings

1. **nit**, Beads `loka-kgd.42` developer handoff comment: the six declined `/code-review` items are "see handoff" but are listed in no Beads comment or commit, so no reviewer can judge them. Record them (one line each with the reason) in Beads or the batch PR body.
2. **nit**, `kernel/ts/test/derived.test.ts:221`: the NPC attack is fixed at chance 100, so the NPC-side `hit_chance` bonus is never observed; a change that applied only the damage table to NPC attacks would stay green. The shared `bonused` helper is covered on the player path, so this is low risk; a chance below 100 with a seeded roll would close it if wanted.
