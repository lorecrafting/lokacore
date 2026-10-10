# Review: toolbox row G6 engine half, sense cues (loka-kgd.61, batch M7)

- Branch `toolbox/m7-senses`, head `2332cde6fce279c990774d4053ef5dd1a9fa09ff` (includes PM commit `2332cde6`, features.json row), base `f3d561e6` (merge-base with `origin/toolbox/batch-m7`, which is at the base: no trial-merge conflict). No PR; handoff in Beads `loka-kgd.61`. Record kept: new GameView field, entity/policy/room schema and kernel_api 1.48 ([two-lane CI](../decisions/owner-decision-two-lane-ci-2026-10-09.md)).
- Governing: [row G6](../MECHANICS-TOOLBOX.md#ranked-toolbox), traps 7 and 12; [mechanics.md sense cues](../system/mechanics.md#sense-cues-sound-smell-and-heat-toolbox-row-g6); [cartridge.md cue declarations](../system/cartridge.md#cue-declarations).
- Hosted CI on the head: ci `38073084621` success; book-e2e `38073084611` (rerun): **cancelled at the 15-minute timeout after real failures** (book, c4_pack, character_choice, crows, deer: "Choose your ancestry" never renders). Reproduced locally: `tests/character_choice.e2e.ts` fails at the head, passes at the base `f3d561e6` (finding 1).
- Verdict: **CHANGES REQUIRED**: five blockers (the Book app no longer starts; four surviving mutants or checks that cannot fail, the review rule for a green suite), two nits.

## Must be true

1. Zero authority state and save cost: no write, event, job or row.
2. Range 0..2, walk at most 2 exits, every exit and hop charged to `query_steps`.
3. No cue reaching: GameView has no `cues`; a cartridge without `sense_cue@1` pays no step (Chapter 1 bytes unchanged).
4. Sources: room, detail, item/NPC, lit fuel source, active status; `when` gates; hidden exits carry nothing; doors pass; dead NPCs silent.
5. A failed pick is heard by an NPC within range via a reaction, and not by one out of range; ambient noise does not count for an outcome reaction.
6. TS loader and Elixir compiler refuse the same cue errors (owner, text, 1.48 floor).

## Proof

- (1) `senses.ts` reads only; composition record in mechanics.md matches the code. (3) `senses.ts:106` gate; `chapters`, `world`, `reactions`, `reactions_sampler`, `senses` tests green at the head. No frozen fixture edited (`protocol/fixtures/invalid.json` +348/-0). All 44 base cartridges (Chapter 1 and corpus) compiled with `mix loka.compile` at `f3d561e6` and at the head: byte-identical (`cmp`); no `"cues"` key outside `senses_sampler`; hash-pinned `content_chapters_test` and `cartridge_cross_kernel_test` green.
- (2) M8 drop `over` in `around` (`senses.ts:43`), M9 drop the final budget check (`:145`): killed. Test comment "6 exits" from the barracks hand-checked (2 + 1 + 3).
- (4) M4 range+1, M5 drop `!row.active` (`:71`): killed. M1, M2, M3: survive (finding 2). Hidden exit behaviour itself is right: ad hoc probe with `hidden_until` on the hall's east exit drops the hammering.
- (5) M7 drop `cause` at `reaction.ts:110`: killed (2 tests). Reactions tests green; the only read of `ctx.cause` under `kernel/ts/src` is `senses.ts:144`, so no other reaction changes.
- Mutants ran against `senses.test.ts` only: it is the only suite on a cartridge declaring `sense_cue`; every other suite returns at `senses.ts:106`.
- (6) Elixir E1, E2 survive (findings 3, 4). The v2-only scope (`cues.ex:46`) is not a real divergence: `v2` (`compiler.ex:105`) is set by any room, item, NPC, recipe, reaction, dialogue or quest definition or an entry, so only a status-only source without rooms escapes, and the TS loader refuses that anyway.
- Schema sweep claim backed: declared properties imply `additionalProperties: false` (`validate.ts:94`, `contracts.ex:153`).
- Accepted limits (cue_perceived in a cue's `when` false, not refused; identical cues not merged): documented in mechanics.md, M6 drop `ctx.cue` (`:143`) survives, as expected for an untested accepted limit; without the flag a recursive `when` would still stop at `query_steps` (every walk charges). Accepted.

## Findings

1. **blocker**, `kernel/ts/src/mechanics/policy.ts:21` (`import { perceived } from './senses.ts'`): the new edge policy -> senses (which imports `movement/shared`, light, status and death helpers, `senses.ts:14-19`) closes an import cycle back to policy that reaches `dialogue/selection.ts` (it imports `holds`, `:19`). In the Metro dev bundle the page throws `ReferenceError: Cannot access 'speaks' before initialization` (`dialogue/selection.ts:34`, read by React Refresh's export registration during the cycle) and renders a blank root (headless probe of the head's preview server). Node tests do not see it. Failure: the Book app (every e2e flow) does not start. Fix: break the cycle, then book-e2e green.
2. **blocker**, `kernel/ts/src/mechanics/senses.ts:45,66,142`: M1 drop `|| hidden(...)`, M2 drop the `living` filter in `sources`, M3 drop `living` in `perceived`: `senses.test.ts` stays green. No sampler exit is hidden and no NPC has hp. Failure: a regression lets a cue betray a secret passage, or a killed sentry's pipe keeps showing and the dead guard still hears the pick, with no test failing. Fix: one hidden exit case and one dead-NPC case.
3. **blocker**, `test/loka/content_cues_test.exs:22`: the "leaf alone still needs 1.48" assertion cannot fail. `no_cues` leaves `npcs/sentry.json` cues, so E1 (`cues.ex:61` without `perceives?`) passes. TS has no leaf-only floor case either (`senses.test.ts:170`). Failure: with E1 in place, a 1.47 cartridge whose only G6 use is a `cue_perceived` leaf compiles and no test fails.
4. **blocker**, `lib/loka/content/cues.ex:23`: E2 (drop `details(kind, d)`) passes; detail cues go unchecked for owner and text at compile, and the TS loader refuses them only later. Add `rooms/tower.json` to a text or owner case.
5. **blocker**, `kernel/ts/src/mechanics/senses.ts:87`: M10 (always `'failure'`) passes; the success branch (`check_passed`, `action_completed`) is untested. Failure: a reaction on a passed check hears the failure cue.
6. **nit**, `senses.ts:34`: "doors pass" has no case (no barrier in the sampler).
7. **nit**: the handoff does not report the developer's `/code-review` result.

## Re-check at e0c54bde (fix commits only)

- Head `e0c54bdeea49a80fe7af32046dada4f46cd90b41`; hosted ci and book-e2e both success (`gh run list --commit`). Scope: `5308adc1`, `e7485d31`, `9e932471`, `d9878dbf`, `bf691065`, `e0c54bde`.
- Verdict: **CHANGES REQUIRED**: findings 1-7 resolved; one new blocker (R1, a one-line test on the PM parity fix) and one nit.
- Merge `5308adc1`: conflicts were only in generated docs, `mechanics.md` (one blank line) and `protocol/fixtures/invalid.json`; the fixture union keeps both sides (846 at base, +11 senses, +2 targets = 859). `INSTALLED.kernel_api` is `1.48` (`world.ts:105`); no `1.47` floor remains in `lib/` or `kernel/ts/src`.
- Finding 1 (cycle): resolved. An import-graph walk over non-type imports finds no cycle through `policy.ts`, `senses.ts` or `dialogue/selection.ts` at the head. Red control: the same walk on `2332cde6` reports the cycle (`movement/shared.ts -> policy.ts`). `senses.ts` imports policy as a type only; `hidden` moved to `lookups.ts` unchanged. Hosted book-e2e is green on the head.
- Findings 2, 5: M1 (hidden), M2 and M3 (living), M10 (success outcome) are now killed by `senses.test.ts`. Finding 6 (doors) has a case in `9e932471`.
- Findings 3, 4: E1 (leaf floor) and E2 (details) are now killed by `content_cues_test.exs`. The TS leaf-only floor mutant (drop the `nodes(c)` clause, `cartridge_senses.ts:33`) is killed.
- PM parity ruling `e0c54bde`: Elixir now passes `Checks.trees/2` roots (`checks.ex`), the twin of TS `nodes/1`. TS drops NPC `fuel` cues: `NpcDefinition` has no `fuel` property in `entity.schema.json`, so the branch was unreachable. Correct.
- Callers' tests green: `reactions`, `world`, `chapters`, `hidden*` (TS); `content_cues_test` (Elixir).

### Findings (re-check)

- R1. **blocker** (one-line test fix), `lib/loka/content/cues.ex:81`: mutant E3, which drops the `"items"` clause of `perceives?`, passes. The test wraps the leaf only in `not` (`content_cues_test.exs:28`). Failure: with E3 in place, a 1.47 source whose `cue_perceived` sits inside `all`/`any` compiles, and the TS loader refuses it later; this is the parity the PM ruling exists for. Fix: nest the test leaf as `all[not[leaf]]` (or similar).
- R2. **nit**, `kernel/ts/src/mechanics/senses.ts:74,146` (`bf691065`): mutants M11 (charge a step for a status without cues) and M6 (check `ctx.cue` after `roomOf`) pass. Only the step count changes, and the old order was already accepted in round 1. Pin the count or leave it.
