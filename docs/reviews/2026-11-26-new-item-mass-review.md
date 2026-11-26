# Review: a new item carries the mass world.carry requires (PR #810, loka-hcnlh.75)

- PR #810, branch `fix/new-item-mass`. Reviewed at `b17b3c89f81fd5e31c79896c46a481f34d9cf03b`.
- Governing: [cartridge.md, Carrying settings and item mass](../system/cartridge.md#carrying-settings-and-item-mass) (every item authors `mass_grams` under carry; explicit zero valid; optional without carry); [mechanics.md containment@1](../system/mechanics.md) (a zero-mass subtree is neutral); `protocol/entity.schema.json:243-248`.
- Why a record: PM brief (starters slice; not a save/protocol/kernel contract change).
- CI at the head (`gh run list --commit b17b3c89f…`): graph-diff, book-e2e, ci all success.
- `/code-review medium`: reported in the PR body.
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. Every starter that writes an item file writes `mass_grams` (an integer >= 0), so it compiles under `world.carry` (`entities.ex:32-35` checks all items, templates included).
2. Without `world.carry` the field is allowed (schema optional) and the cartridge still compiles warning-free.
3. 0 breaks no consumer: no division or "missing means 0" special case.
4. The Book's "Add here" reaches this starter (no second TS item writer).
5. A test fails when either new mass is removed.

## Checks run (detached worktree at the head)

- Item writers: `grep items/ lib/loka/content/starters*` finds only `templates.ex:108` and `world.ex:118-121`; corpses already wrote `0` (`world.ex:113`). `area.ex`, `scene.ex`, `child.ex` write no item. Book create goes `Content.write_starter` → `Starters.write` (`content.ex:205`); no TS item starter. (1, 4)
- Non-carry: `content_starters_test.exs:29-42` compiles every starter in a new cartridge (no carry) with `{:ok, _, []}`; 35 pass with the copy test. (2)
- Zero: engine reads mass in `exchanges.ex:82` (`> 0`), `liquids.ex:67-75` (sum bound), kernel containment (sums; zero subtree neutral by spec). No division. 0 is safe for carry and containers; exchange stock refuses it (Finding 1). (3)
- `bin/mutate_diff.sh origin/main`: 0 mutants (the `@mass` lines are attribute lines, skipped), matches the handback.
- Hand mutants (mine, copy test): `world.ex:123` mass removed → red, `SCHEMA_VIOLATION` at `items/voles_item.mass_grams`; `templates.ex:109` mass removed → red at `items/pebble.mass_grams`; `templates.ex:105` `@mass -1` → red, `below_minimum` at `items/pebble.mass_grams`. (5)
- Claims rerun: `entities.ex:32-35` and schema `:244` cites land; "the corpses already wrote 0" backed (`world.ex:113`).
- Rerun dispute (`templates.ex:107`): developer is right. `Merge.clash` compares only keys already on disk and refuses any differing scalar; an author who edited `name`/`description` already blocks a rerun, so a mass edit adds no new refusal class. An item written before this fix has no key, so a rerun merges `0` in. Not a finding.

## Findings

1. **Nit** (author-side), `lib/loka/content/exchanges.ex:82`: exchange stock needs `mass_grams > 0`, so a starter item wired into a harvest or quest exchange gets `OUTCOME_MISMATCH` at the exchange path, which does not name mass. Not a regression (no mass failed the same way before).
