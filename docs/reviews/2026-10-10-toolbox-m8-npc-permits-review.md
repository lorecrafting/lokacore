# Review: combat turns read status blocks/allows (loka-kgd.98)

- Branch `toolbox/m8-npc-permits`, head `5b29c61d670febc557f33fc6ab2bcf025a902733` (merges `toolbox/batch-m8` `7fb536c2`), diffed against `7fb536c2` (17 files). No PR (batch model). Contract slice: installed kernel_api 1.55 to 1.57 (1.56 is `toolbox/m8-fire`'s), ward_sampler floor 1.57.
- Governing: [SR4 and SR5](../system/mechanics.md#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5), [fear](../system/mechanics.md#fear-and-morale-for-npcs-toolbox-row-w21), [row 6b](../system/mechanics.md#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b), [composition](../system/architecture.md#building-mechanics-by-composition), Beads `loka-kgd.98` (PM: the player's blow is barred too; NPC movement `loka-kgd.102`; Book line `loka-x6t.30`).
- Hosted ci and book-e2e green at the head (`gh run list --commit`, reviewer).
- Verdict: **APPROVE WITH NOTES** (two nits, one question).

## Must be true

1. Every combat blow (player, foe NPC, ally; lone or pack) is skipped when the attacker's active statuses bar `attack`, with no modal or `wait` exemption.
2. A skipped blow writes nothing, emits nothing and draws nothing; the round keeps its order and successor.
3. Pack flight is skipped when `flee` is barred, and is tried before the `attack` bar.
4. The player's admission (`permits`) keeps the modal and `wait` exemption; combat imports no dialogue module (no new cycle).
5. Row 29b's `resisted` (NPC entries plus status entries, one clamp) survives the merge.

## Proof

- Focused runs green: `status_readers`, `targets`, `writer_groups`, `fear`, `npc_status`, `spell_effects` (TS); `content_status_readers_test.exs`; `npm run typecheck`.
- Mutants, each red on the named test: player exempted from the guard (`status_readers` player test); ally exempted (`targets` stunned guard); NPC foes exempted (`status_readers` troll and `fear` pack test); flight also gated on `attack` (`fear`); flight ignoring `flee` (`fear`).
- Guard at `round_attack.ts:61` precedes every `draw`, so a skip spends no RNG and pushes no event or op. `round_flow.ts:151` gates only flight. Both claims in the brief rerun and hold.
- Cycle: combat already imported `status/shared.ts` (`combat/behavior.ts:10`, `combat/shared.ts:15`); `permits.ts` (imports dialogue) is imported only by `commands/actions.ts`. No new module edge.
- Merge: `git diff 7fb536c2 HEAD` touches only the slice's 17 files; `resisted` (`combat/shared.ts:131`) is byte-identical to the batch head and both callers (`round_attack.ts:106`, `action_recipe/spell.ts:97`) are unchanged.
- Thunder probe (throwaway test, deleted): `say thunder` in the hall stuns nothing (no hearer); `shout thunder` from the hall stuns the troll (speech's one-exit reach, intended); `say` in the den stuns. Not a sampler bug: "any room" does not hold.
- Elixir has no combat runtime (`lib` has no `attack_result` or flight), so there is no parity case; the compile twin covers the fourth reader status.
- Docs: mechanics.md SR4 "Combat turns", limits, sampler figures (10/7, 8/6; 9/8) match the tests; no stale "player's commands only" text remains.

## Findings

1. **nit**, `cartridges/ward_sampler/statuses/stunned.json:5`: `narration.stunned.applied` and `.tick` never show. The applied line is pushed only for the player as holder (`status/shared.ts:244`), and a status without `per_tick` never ticks. Failure: the player says "thunder" in the den and gets no line (probe: narration undefined). Neither `loka-x6t.30` (skipped turn) nor anything else covers the missing feedback that the stun landed. The keys are schema-required, so this is only for the designer.
2. **nit**: there is no PR body or `/code-review` result to check. `f2238a53` names self-review fixes; report the result in the batch PR.
3. **question**, `kernel/ts/src/runtime/world.ts:107`: the new rule adds no floor. A 1.54 to 1.55 cartridge whose status bars `attack` (mechanics.md's own "fear on the player `blocks: [attack]`") now loses round blows under 1.57 without opting in. No shipped content is affected: only ward_sampler declares blocks/allows, and `hushed` does not bar attack. Is that acceptable pre-release?
