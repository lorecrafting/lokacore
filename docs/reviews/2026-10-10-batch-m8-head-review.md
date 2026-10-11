# Review: M8 mechanics batch head (PR #375, `toolbox/batch-m8`)

- Commit reviewed: `baabdf8b8d555d4dee9738e367757457f34cb542` (hosted ci, book-e2e, graph-diff green).
- Scope: the one Fable batch-head review ([workflow](../WORKFLOW.md#work-routing)): how the rows compose, the three hand-resolved merges, floors 1.49-1.57 in both loaders, import cycles, open limits. Row-level records: `docs/reviews/2026-10-10-toolbox-m8-*-review.md`.
- Governing: [status readers](../system/mechanics.md#status-readers-toolbox-rows-sr1-sr2-and-sr3), [SR4/SR5](../system/mechanics.md#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5), [29b](../system/mechanics.md#spell-effects-toolbox-row-29b), [W22](../system/mechanics.md#fire-toolbox-row-w22), [W21](../system/mechanics.md#fear-and-morale-for-npcs-toolbox-row-w21), [composition](../system/architecture.md#building-mechanics-by-composition).

## Verdict: APPROVE WITH NOTES

Nothing blocks the merge to main. One should-fix is a new reachable path of an open P2 (loka-6ztc), not reachable by shipped content.

## Must-be-true list (written before the diff)

1. Spell and reaction `status.apply` share one `statusStep`; `status_applied` once per holder, causal order, only while listened for. **Holds** (`kernel/ts/src/mechanics/status/shared.ts:218-247`; both callers `reaction.ts:145`, `action_recipe/spell.ts:72`).
2. `permits` filters the one action set; combat blows read `statusAllows` without the modal exemption; flight is tried before the attack bar. **Holds** (`commands/actions.ts:82-85`, `combat/round_attack.ts:61`, `combat/round_flow.ts:150-153`). A stunned caster (`allows: [look]`) loses `cast` in the set and gets `invalid_state` through `barred` (`actions.ts:89-91,114`).
3. A spell with `duration` is refused while engaged. **Holds** (`action_recipe/shared.ts:289`). See finding 1 for the same spell outside a fight.
4. `resisted` sums NPC definition + active status entries per kind and material, one clamp, used by `dealt` and spell damage; player body too. **Holds** (`combat/shared.ts:131-146`).
5. `co_present`+`tag` reaches items only; `eventRooms` one copy. **Holds** (`reaction.ts:121-128`, `lookups.ts:22-25`, `barrier/react.ts:31`).
6. `barrier.set` reads the proposal so far and joins writer groups. **Holds** (`barrier/react.ts:33-35`); root-write conflict is the documented limit.
7. Floors in both loaders: 1.49 use (`recipes.ex:65`/`cartridge_recipes.ts:106`), 1.50 fear/co_present (`status.ex:58`, `reactions.ex:112`/`cartridge_status.ts:33`, `cartridge_reactions.ts:77`), 1.51 spell+level_compare (`spells.ex:25`, `levelling.ex:40`/`cartridge_recipes.ts:132`, `cartridge_levelling.ts:19`), 1.52 harvest tool (`exchanges.ex:28`/`cartridge_exchange.ts`), 1.53 subject/status_applied/status.cure (`variants.ex:20`, `reactions.ex:84,89`/`cartridge_variants.ts:16`, `cartridge_reactions.ts`), 1.54 readers (`status.ex:57`/`cartridge_status.ts:31`), 1.55 effects (`spells.ex:25`/`cartridge_recipes.ts:132`), 1.56 tag/barrier.set (`reactions.ex:85,111`/`cartridge_reactions.ts:77`). **Match.** Shared negative cases in `protocol/fixtures/invalid.json` (tag without co_present, barrier.set barrier+tag, status_applied trigger, status.cure) run in both kernels.
8. Fixtures: only `protocol/fixtures/invalid.json` (additions) and `toolbox_showcase_hash.json` changed; `cartridges/ashmere_chapters` and `docs/spec/conformance` untouched. **Holds.**

## Mutants (own worktree, four narrow breaks, named files only; baseline green)

- `resisted` drops `held(k)` → `status_readers`, `spell_effects` fail (3 tests). Killed.
- `statusStep` emits on a refresh (`first` without `!expected.active`) → `elements`, `spell_effects` fail. Killed.
- `maybeFlight` ignores the `flee` bar → `fear` fails. Killed.
- `holdersOf` tag branch lands on NPCs → `showcase_fire` fails (3 tests). Killed.

## Findings

1. **Should-fix** — `kernel/ts/src/mechanics/action_recipe/spell.ts:72` with `rule.ts:89-91`. A spell with a `duration` whose `status.apply` lands or refreshes a status, when the advance crosses that status's tick or end, faults the whole cast. Probe (sampler copy with `time_policy` removed, `ward` given `duration: 60`, `warded` ticks every 30 s): first cast → `{"kind":"fault","code":"precondition_failed","target":{"kind":"status",...}}`; with `duration: 20` the first cast is accepted and the second (refresh, advance 20→40 crossing the tick at 30) faults the same way. Root cause is the one in open loka-6ztc (root status write + a due job on the same row in one advance); 29b adds a second entry point and documents only the in-fight refusal. Not reachable by shipped content: every real_elapsed cartridge refuses recipe durations (`lib/loka/content/recipes.ex:98`), and no explicit-advance cartridge has a spell. Disposition: append this reproducer to loka-6ztc (or a loader check: a spell with `duration` ≥ `tick_every` of a status it applies) and add the limit to the 29b "In a fight" bullet.
2. **Nit** — `kernel/ts/src/mechanics/status/permits.ts:5`. The file's header says it avoids the dialogue cycle, but it joins one: `permits.ts → dialogue/shared.ts → commands/actions.ts → permits.ts` (a 6-module SCC with `speech/shared.ts` and `action_recipe/shared.ts`; main's SCC had 3). `MODAL` is read inside the function, so no load-time TDZ, and book-e2e is green at this head. Fix the comment or lift `MODAL` to a leaf module when convenient.
3. **Nit** — `docs/MECHANICS-TOOLBOX.md` rows 12, G4, W21, 29a, 29b, SR1, SR4, SR5, W22 read "in progress (batch M8)"; flip to done at merge (PM housekeeping).
4. **Note** — `kernel/ts/test/showcase_consequence.test.ts:258-273` (main sync): the social 21 expected answer was loosened to a set for two moves due at the same instant. The reason given (job-id tie order is unspecified) is right for equal-due jobs; the test keeps the ordered prefix.

## Open limits in the PR body

loka-kgd.101 (spell XP/engage, M9), .102 (NPC movement reads permits, M9), .103 (W22 lockout over-refusal, burn refresh, E1 witness), loka-x6t.30 (Book line), loka-6ztc (see finding 1), loka-th7x (checker, not engine): none blocks the merge; each is content-safe for the showcase.

## Composition

No capability code names a status key, item or NPC (`grep` of `burning|afraid|warded|hushed|spent|kindling` over `kernel/ts/src` is empty). `COMPOSES` gained `action_recipe: status, death` and `reaction: status, barrier` as the specs require (`runtime/decision.ts:261-275`).
