# Review: builder items weigh 1 g; a weightless stock item is named (PR #812, loka-hcnlh.80)

- PR #812, branch `builder/item-mass`. Reviewed at `dd29ea95c96b3499361844dd5cb9a926ec2571b5`, range `e5abf1af3` (#810 head, `fix/new-item-mass`)`...dd29ea95c`; #810 is still open, so its commits are not reviewed here ([#810 record](2026-11-26-new-item-mass-review.md)).
- Governing: [cartridge.md, Carrying settings and item mass](../system/cartridge.md#carrying-settings-and-item-mass); `protocol/cartridge.schema.json` `Diagnostic` (`data` is `additionalProperties: string | integer`) and `DiagnosticCode` (one code per cause; "repair loops read codes and data"); `lib/loka/content/exchanges.ex` stock rule (`mass_grams > 0`, undocumented in docs/system since 802edd92c).
- Why a record: PM brief (diagnostic data shape touches the protocol `Diagnostic`).
- CI at the head (`gh run list --commit dd29ea95c…`): graph-diff, book-e2e, ci all success.
- `/code-review medium`: reported in the PR body (5 nits, 3 fixed, 2 open).
- Verdict: **APPROVE WITH NOTES**.

## Must be true

1. A new item and a population loot item compile as harvest or quest stock; corpses keep 0.
2. 1 g changes no sampler, hash fixture, golden or panel/Book test, and trips no carry limit a starter places it under.
3. `why`/`target` stay inside the `Diagnostic` schema; the code stays `OUTCOME_MISMATCH` (no enum change).
4. `stock_weight` only when the item is resolved and held but weightless; unheld or unresolved keeps bare `{}`.
5. Every consumer of diagnostic data tolerates the new keys.

## Checks run (detached worktree at the head, ports 19601-19607)

- Focused `mix test` (refusals, starters x4, copy, explain x2, content): 168 passed. (1, 2)
- `bin/mutate_diff.sh origin/main` and `bin/mutate_diff.sh e5abf1af3` (stacked base): the same 4 SURVIVED (`exchanges.ex:75`, `:88` x3), matching the handback; `:88` cleared by the hand mutants below.
- Hand mutants via `bin/mutate.sh`, narrow = refusals + copy tests: `> 0`→`>= 0`, `target`→`"x"`, held check `→ false` (weight before held), `templates.ex:105` `@mass 0`, Explain row wording: all red-narrow. (1, 4)
- Schema: `data` values are strings; `Diagnostic` allows any string/int keys. Precedent: `OUTCOME_MISMATCH` already carries `why` (`story_point_then`) and `{item, holder}`. (3)
- Consumers: Book Checks (`mobile/app/author/build/build.ts:66`) and `kernel/ts/play/card.ts:125` read only `words`; the panel reads no `data`; Explain fills `{target}` (`explain.ex:285`). (5)
- 1 g: no sampler/fixture/test writes a starter item's mass; TS has no item template; new item sits in the entry room (`templates.ex:109`), loot in a template; corpses 0 (`world.ex:114`). (2)
- Claims rerun: shop offers have no mass check (only `exchanges.ex:88` reads it); `prices_sampler` with `fish_b` set to 0 compiles `:ok`. Backed. The "4 SURVIVED" claim backed.
- `explain.ex:232-243` `without_follow_ons`: the exchange check runs only on schema-valid definitions (`resolve.ex:288`), and no code-emitted `missing_property` lives under `quests/*.exchange` or `*.harvest.items`, so the new `why` hides nothing reachable. Pre-existing rule; not a finding.

## Findings

1. **Nit** (docs), `lib/loka/content/exchanges.ex:92`: `data {why: stock_weight, target}` is not recorded in docs/system (other `why` values are, e.g. cartridge.md:201). A repair loop reading data has no spec row. The bare exchange-stock case is undocumented too.
2. **Nit** (author-side), `lib/loka/content/starters/templates.ex:104`: "1 gram never makes a new item too heavy" is false under `world.carry.max_grams: 0` (schema allows it): the new item can no longer be taken, where 0 g could.
3. **Nit**, `test/loka/content_refusals_test.exs:260`: asserts the owner-placeholder words "weighs nothing"; replacing the wording reds the test. Asserting the line is not the generic `OUTCOME_MISMATCH` row would test the routing without pinning words.
