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

1. nit, `docs/system/mechanics.md:3161`: claims "a cold reopen after a theft and a fence sale replays"; `mobile/authority/local-story/theft.test.ts:99-101` sells to the fence then closes without reopening. Probe (scratch copy with a third reopen after line 100, removed): reopens at head, purse with the fence. The claim is true but not pinned: a later custody-evidence fault on the stolen-offer sell transfer would surface as `save_corrupt` only on the player's next launch. Add that reopen to the test.
2. question: an escort or hireling NPC travelling with the thief counts as a bystander witness (spec: every other living NPC). Intended?
3. nit: `/code-review` result not yet reported (no PR); report it in the batch PR body.

## Dispositions judged

No victim slot on `custom_event` (schema closed; spec:3144 documents it). Elixir `check(_,_,_,nil)` and TS non-v2 skip agree. Dropping the separate 1.94 floors is covered transitively by `world.theft`.

## Save second opinion

- Branch `toolbox/m13-theft`, commit reviewed `b6d931ed1c9fe64780c0a730ec7753cdc65b345f` (base `toolbox/batch-m13` `0e2914c6`); scope: commerce-save custody seed only ([WORKFLOW.md:38](../WORKFLOW.md), [storage lessons](../lessons/storage.md)). Written by anthropic/claude-opus-5-5.
- Verdict: **APPROVE WITH NOTES**.

### Must be true (before the diff)

1. A clean offer's seed is unchanged: both loaders (`kernel/ts/src/content/cartridge_commerce.ts:26-34`, `lib/loka/content/commerce.ex` `stocked?`) require it to start with its provider, so `fresh` holder == provider.
2. A stolen offer's seed is its authored starting holder, read from `fresh` = `pinned(release, saved.pin)` (`authority.ts:98-102,163-167`): same context, so its `entityIds` match the saved world; authored containers draw no rng.
3. The take transfer and the `stolen` fact row commit in one transaction; failed COMMIT keeps neither, a lost ack keeps both and redelivery replays the stored receipt.
4. Cold reopen replays after a take, a fence sale and a buy-back from the fence.
5. Chapter 1 and existing commerce saves reopen unchanged.

All five hold at head.

### Evidence

- Focused at head, exit 0: mobile `theft.test.ts`, `commerce.test.ts`, `two_shops.test.ts`, `prices.test.ts`, `r9c_custody_terminal.test.ts`, `chapters.test.ts`.
- Mutants (each reverted, tree clean): `commerce-save.ts:33` seed from the saved `world` → 8 fail across theft, commerce, two_shops; stolen offers seeded with the provider (old behavior) → theft.test `save_corrupt` at the first reopen (:94).
- Red control: `commerce-save.ts:65` skip the custody update on `sell` → theft.test fails at the new reopen (:103, `save_corrupt`); same mutant with :103-105 removed → green. The new reopen is what catches it; main finding 1 is resolved.
- Scratch probe (deleted): failed COMMIT on take(purse) → `pending`; reopen: purse with the merchant, `stolen` false; retry accepted. Lost ack → `pending`; reopen: purse on the body, `stolen` true; redelivery of the same `invocation_id` returns the stored `accepted` receipt, no double effect; reopen again clean. Stolen purse sold to the fence then bought back → reopen OK, purse on the body, still `stolen` (spec:3162 limit).

### Findings

1. nit, `mobile/authority/local-story/commerce-save.ts:59-64` with `:241-244`: a fence's stolen offer may now name any NPC's item, and no loader rejects content that also moves that item by a path `custodyEvidence` refuses (a dialogue exchange or give, `choose`; a replenish job, `containment/job.ts:60-75`; an `item.move` reaction). Scenario: the merchant also gives the purse through dialogue; the receipt saves, the next launch is `save_corrupt`. Clean offers carry the same exposure for the shop's own stock (the developer's claim holds); this widens it to any NPC's item. Not run. Add a Known limit at `docs/system/mechanics.md:3162` or a loader guard like the escrow guard at `kernel/ts/src/content/cartridge_services.ts:114-123`.
