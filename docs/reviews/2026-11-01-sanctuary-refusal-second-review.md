# Sanctuary refusal cause: second-opinion contract review

PR #577, branch `engine/sanctuary-refusal`, commit fd4a711e1e42fcca16f52661d5caafb1385aa3e6. Scope set by the brief: the contract only.
Governing: [protocol.md](../system/protocol.md) refusal causes, [mechanics.md](../system/mechanics.md) combat@1, [cartridge.md](../system/cartridge.md), [book-ui.md](../system/book-ui.md) Unavailable actions, AGENTS.md "Writing tests".

## Must be true

1. The enum addition is optional and the code is unchanged.
2. Every previously refused state keeps its code; the acceptance set is unchanged.
3. Schema, generated files and `kernel_api` move together.
4. The Book has a word for the cause and does not hide it.
5. Offer and raw refusal agree.
6. The hash change is explained and reproducible.
7. Elixir and TypeScript accept and reject the same shapes.

## Checked

- Base/head probe (combat fixture, raw and offer): 1, 2 and 5 hold for calm, seated, engaged, dead target, dead actor, remote and hp-less. The engaged player keeps a plain `invalid_state`: an upstream refusal in `actions.ts` wins. No corpse card. The disclosed suppressed-hunter change (`invalid_state` to `not_present`) was read, not probed; a mutant shows `d9_suppression.test.ts` pins it.
- 7: TS validate and Elixir `Contracts.validate` agree on sanctuary, unknown cause, bad key, extra key, and `UnavailableReason`.
- 3: `bin/contracts.exs --check` and `bin/features.exs --check` exit 0; `kernel_api` 1.149.
- 4: `words.ts` has the word; dropping it fails `reasons.test.ts` and `pass1_ui4.test.ts`.
- Hash: only `containers_cartridge_sampler_hash.json` changes, because it alone is compared with a compile of `cellar_sampler`, the only live cartridge with `sanctuary: true` (`content_sampler_test.exs`). Other fixtures are frozen inputs. Its sha over the canonical value checks out in Python.

## Mutants of `attackRefused`

| Mutant | Result |
|---|---|
| Sanctuary check after the standing check | killed, `combat.test.ts` |
| `not_present` after suppressed | killed, `d9_suppression.test.ts` |
| Sanctuary ahead of `cannot_be_hurt` | survives 287 related kernel tests (every kernel test file naming the three causes, without sim), `sim.test.ts`, 56 Book tests |
| Sanctuary ahead of `not_present` | survives the same 287 and 56; sim stopped unfinished |

## Findings

- Blocker, `kernel/ts/src/mechanics/combat/shared.ts:46-49`, no test for this order: moving the sanctuary check above `cannot_be_hurt` stays green. An hp-less NPC in a sanctuary would then gain a grey Attack row, since only `cannot_be_hurt` is hidden. The code is right today (probed); nothing holds it. Add that row to `combat.test.ts:225-250`.
- Blocker, same lines: moving the sanctuary check above `not_present` stays green. A remote target, from a sanctuary, would answer `invalid_state` instead of `not_present`. One assertion in the same test.
- Should-fix, `protocol/fixtures/containers_cartridge_sampler_hash.json`: hand-edited. At base `test/loka/cartridge_containers_hash.py` reproduced this fixture; at head it writes the old sha adf068e7 and drops `combat.sanctuary`, so the next regeneration turns `content_sampler_test.exs` red. Add the key to that generator's derived additions (`protocol/README.md:57`). The parent generator was already stale at base (`at_least` 1.7, `title`), so it is not the fix.
- Nit, `shared.ts:48`: "every refusal the player could change" overstates; engaged and modal refusals win upstream.

## Not checked

Dropping the enum value from the schema stays green in `combat.test.ts`; whether `bin/contracts.exs --check` catches it was stopped unfinished. `bin/mutate_diff.sh` not run, per the brief's two or three targeted mutants. CI at this head: ci, book-e2e and graph-diff success.

Verdict: CHANGES REQUIRED
