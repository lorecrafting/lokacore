# Review: toolbox row FD4, NPC-NPC pair facts (loka-kgd.141)

- Branch `toolbox/m12-pairs`, head `26f0db6a3e9309ca01e547445e8899f7b5aa3442`, base `e78a8629` (`toolbox/batch-m12`), kernel_api 1.89. No PR (batch model).
- Governing: Beads `loka-kgd.141` brief (Realm seams checklist, acceptance, red controls); [mechanics.md "NPC-NPC pair facts"](../system/mechanics.md) (lines 2880-2901 on the branch); [reviewer stance](../../.claude/agents/reviewer.md); [contract lessons](../lessons/contracts.md).
- Hosted CI on the head: `ci` **failure** (run 38618768256, job `kernel`, step `node bin/check_ts_size.mjs`); `book-e2e` success.
- Verdict: **CHANGES REQUIRED** (finding 1 blocks; findings 2 and 3 are untested branches).
- Written 2026-10-14 by anthropic/claude-opus-5-5 (main reviewer).

## Must be true (from the spec and brief)

1. A row with `with_id` and a row without it, or two rows with different `with_id`, never share a target key; both kernels compose `with_id` into the same canonical text.
2. `facts_typed`: `with_id` present exactly when the fact is `npc_pair`; then subject and `with_id` are two distinct NPC entities.
3. `npc_pair` requires `per_subject` and `scopes: ["instance"]`; `with` only on pair facts; a pair site without `with`, or `with` naming a template or the site's own `npc`, is FACT_SCOPE_UNSUPPORTED; a pair fact is no durability fact.
4. Reaction partner naming: subject is the step's `npc`, else the event's declared subject, never the listener default or the body; the step writes nothing unless both are distinct NPCs.
5. Floor 1.89 in both kernels; every other cartridge (Chapter 1) keeps its bytes and hash.
6. A pair row survives mobile cold reopen and receipt replay.

## Check against the list

1. Met: `compose_target.ts:63`, `compose_target.ex:12`; fixture `composition.json:2321`. Mutants M4a/M4b red.
2. Met at `fact.ts:243`, `:273`. The subject-is-NPC half is untested (finding 2).
3. Met: `cartridge_scoped_facts.ts`, `scoped_facts.ex`; `pair_facts.test.ts:129`, `content_scoped_facts_test.exs` green. Schema fixture `fact_spec_npc_pair_false` in `protocol/fixtures/invalid.json` is read by both kernels (`validate.test.ts`, `contracts_test.exs`).
4. Met: `reaction.ts:240-249` (`step.npc ?? step.item`, else `subject(cause)`). The self-pair guard is untested (finding 3).
5. Met: floors `cartridge_scoped_facts.ts:58`, `scoped_facts.ex:26`; no `*_hash.json` touched; `content_missing_child_test.exs`, `cartridge_cross_kernel_test.exs` (14 passed), `doors`, `chandlers_contracts`, `tags` green; `bin/contracts.exs` left the tree clean.
6. Met: `mobile/authority/local-story/pair_facts.test.ts:62` rerun by the reviewer, green (the developer had not rerun it).

Commit claims rerun: "the durable refusal runs before the pair check" (`reaction.ts:244` before `:246`) holds; "facts_typed admits a pair row only with two distinct NPCs" holds in code, but only partly in tests (M2d).

## Mutants and red controls (one at a time, restored, tree clean after)

| Mutant | Tests | Result |
|---|---|---|
| M1 swap `who, partner` in `reaction.ts:250` (brief red control) | kernel `pair_facts` | red |
| M2a drop `npc_pair === with_id` line `fact.ts:243` (brief: drop facts_typed rule) | kernel `pair_facts` | red |
| M2b drop `npc(t.with_id)` `fact.ts:273` | kernel `pair_facts` | red |
| M2c drop `s !== t.with_id` `fact.ts:273` | kernel `pair_facts` | red |
| M2d drop `npc(s)` `fact.ts:273` | kernel `pair_facts` | **green** |
| M3a TS floor `'1.89'` -> `'1.88'` (brief red control) | kernel `pair_facts` | red |
| M3b Elixir floor `[1, 89]` -> `[1, 88]` (brief red control) | `content_scoped_facts_test.exs` | red |
| M4a drop `with_id` from `compose_target.ex:12` | `compose_test.exs` | red (known answers + differential) |
| M4b drop `compose_target.ts:63` | kernel `compose` | red |
| M6 drop `who === partner` `reaction.ts:248` | kernel `pair_facts` | **green** |
| M7 swap subject/partner in `policy.ts:126` | kernel `pair_facts` | red |

## Findings

1. **Blocker.** `kernel/ts/src/mechanics/fact.ts:1` is 324 lines (base 300) and `kernel/ts/src/mechanics/reaction.ts:1` is 303 lines (base 297); limit 300. Hosted `ci` fails at `bin/check_ts_size.mjs`, so the slice cannot merge into the batch green.
2. **Should-fix.** `fact.ts:273`: the `npc(s)` check has no test. The planted rows at `kernel/ts/test/pair_facts.test.ts:117` are (smith, apple), (smith, smith) and (miller, no partner); none has an item subject. Failure: if `npc(s)` is dropped, `facts_typed` admits a `gloats` row (apple toward miller), although the spec says a pair row that names an item is a broken invariant. Add the (apple, miller) row to the loop.
3. **Should-fix.** `reaction.ts:248`: the `who === partner` refusal has no test. Failure in `rivals_sampler`: the player gives the apple to the miller. `item_acquired` names the miller as its subject, and `with` is also the miller. Without the guard the step writes the row (miller, miller). The reviewer confirmed this with a throwaway probe: under M6 the "give to miller, expect no gloats row" assertion goes red; at the head it is green. `facts_typed` refuses that row, so the world holds a broken invariant; the spec says the step writes nothing. Add that test.
4. **Nit.** Neither commit message reports the developer's `/code-review` result.
5. **Nit.** `protocol/fixtures/composition.json:2321` pins two different `with_id` values but not one subject with and without `with_id`. M4a/M4b show that the composition is pinned, but the brief's with-or-without no-alias claim has no direct known answer.
