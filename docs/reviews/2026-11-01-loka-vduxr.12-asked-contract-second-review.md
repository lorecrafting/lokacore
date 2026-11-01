# Second review: `asked` contract, PR #560 (loka-vduxr.12)

- PR [#560](https://github.com/lorecrafting/lokacore/pull/560) at `3a1c36843aa0d3947ecc67978dffa6e5182ddd7a`. Scope: the `asked` source field and view field only.
- Governing: [contracts lessons](../lessons/contracts.md), [first review](2026-11-01-loka-vduxr.12-dialogue-patterns-review.md), [book-ui](../system/book-ui.md).
- CI at this head (`gh run list --commit`): ci, book-e2e, graph-diff completed, success.
- **Verdict: APPROVE.** No blocker, no should-fix.

## Must be true, checked

1. Absent by default: `DialogueChoice.asked_when` and `ChoiceOption.asked` are optional; the lowering touches only choices with `asked: true`. Probe: `mix loka.compile` of ask, persuade, check, hello and facts samplers at the merge base and at head is byte-identical (`cmp`), so hashes and receipts are unchanged.
2. Both kernels agree: Elixir validates via the shared schema and fixtures (`invalid.json` `asked: false`, `asked_when: true`); only TS evaluates the view. Mutant: drop `enum:[true]` from `gameview.schema.json`, `contracts_test.exs` fails; replace the `asked_when` `$ref`, the Elixir schema build fails.
3. Reopen/replay: only a fact reaches the save; the cookbook test reopens cold and the mark returns. No event changes for content without `asked`.
4. Query budget: one policy leaf per available option with `asked_when`, none otherwise (`policy.ts holds`); the limit is 32768 `query_steps`. Fine for any dialogue.
5. Old saves: artifacts without `asked` are byte-identical, so their saves load. `kernel_api` is not pinned by exact value in saves; a cartridge that uses `asked` on a 1.137 kernel fails schema (unknown field) rather than `KERNEL_API_UNSUPPORTED`, since authors set `at_least`. As expected, not new.
6. Accessible name: `actions.tsx:79` gives `label + ", already chosen"` (`words.ts:300`), asserted in `ActionCard.stories.tsx:32`. Dim italic is not the only cue. `p.name` wins when set; `Npc.tsx:61` passes none.

## Mutants (cookbook test, singly)

Killed: inverted `holds`; `asked` not spread in `choiceView`; scope `world`; `@key_max` 65; riddle guard removed.
Survived: `target: undefined` in `selection.ts` (equivalent, the fact is player-scoped); `set` step prepended instead of appended (equivalent unless a first step is refused).

## Findings

**nit** `lib/loka/content/dialogue_asked.ex:55`. The set step is appended; no test pins the order. Only matters if an author's step can refuse. Question, no action.
