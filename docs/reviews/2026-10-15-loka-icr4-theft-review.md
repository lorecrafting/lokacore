# Review: theft, fence and witnessed offense (loka-icr4, toolbox row 33)

- Branch `toolbox/m13-theft`, exact head `8c7c6c95a0e544b95830c81c8d443857bb9bd7d5`, base `toolbox/batch-m13` `0e2914c6`. No PR (batch model).
- Governing: [mechanics.md, Theft, fence and witnessed offense](../system/mechanics.md); Beads `loka-icr4` brief and PM rulings 2026-10-15; [WORKFLOW review stance](../WORKFLOW.md); [reviewer stance](../../.claude/agents/reviewer.md).
- Verdict: **APPROVE WITH NOTES**. Save second opinion **required** ([WORKFLOW.md:38](../WORKFLOW.md): `offerCustody` reconciliation seed changed).
- Written 2026-10-15 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. Without `world.theft`, an NPC-held item stays not_present and unlisted; Chapter 1 and property_sampler bytes unchanged.
2. Rule and view share one refusal (`theftRefused`).
3. Notice: skill level < victim attribute (absent 0); victim through the same sense filter; bystanders are other living non-blind NPCs the thief is not concealed from.
4. Seen theft emits `custom_event` noticed, subject = thief body; no `reaction.ts` edit.
5. `stolen` fact: per_subject bool, containment the only writer; authored write `RESERVED_FACT`; wrong scope `FACT_SCOPE_UNSUPPORTED`; never cleared; no ownership transfer.
6. Fence sell matches `stolen === offer.stolen`; shelf same; stock + stolen is `SCHEMA_VIOLATION`.
7. NPC `locks.get` read; vault NPC needs `locks.get` under `world.theft`; both kernels.
8. NPC locks or stolen offer without `world.theft` refused by both loaders.
9. Nested items in an NPC's holding stay not_present. 10. kernel_api 1.94. 11. No new save row.

All eleven hold at head.

## Evidence

- Focused: `kernel/ts/test/theft.test.ts` 7/7; mobile `authority/local-story/theft.test.ts` + `app/book/theft.test.ts` 2/2; `mix test --force` content_theft, content_chapters, content_property 6/6 (bytes unchanged; no hash fixture touched).
- Mutants (each killed, restored, tree clean): `theft.ts:66` `<`→`<=` (tests 2,3); `senses.ts:169` drop `!concealed` (test 6); `theft.ts:33` drop NPC lock refusal (test 7); `commerce/shared.ts:84` loose fence compare (test 3); `theft.ts:67` victim-only seers → `length===0` (tests 2,3); `theft.ex:41` drop `vaults` (content_theft); `commerce-save.ts:33` seed custody with the provider (old behavior) → mobile reopen `save_corrupt`.

## Findings

1. nit, `docs/system/mechanics.md:3161`: claims "a cold reopen after a theft and a fence sale replays"; `mobile/authority/local-story/theft.test.ts:99-101` sells to the fence then closes without reopening. A custody-evidence fault on the stolen-offer sell transfer would surface as `save_corrupt` only on the player's next launch. Add a reopen after line 100, or narrow the claim.
2. question: an escort or hireling NPC travelling with the thief counts as a bystander witness (spec: every other living NPC). Intended?
3. nit: `/code-review` result not yet reported (no PR); report it in the batch PR body.

## Dispositions judged

No victim slot on `custom_event` (schema closed; spec:3144 documents it). Elixir `check(_,_,_,nil)` and TS non-v2 skip agree. Dropping the separate 1.94 floors is covered transitively by `world.theft`.
