# Review: M15 row 47 death penalty options, kernel_api 1.109 (loka-kgd.171)

- Branch `toolbox/m15-47`, exact head `7c22b8ce810232a51169ea3230fc52b099b383cb`, range `origin/toolbox/batch-m15...origin/toolbox/m15-47`. No PR yet (batch lane).
- Governing: [mechanics.md Death penalties](../system/mechanics.md#death-penalties-toolbox-row-47), [row 4 Write](../system/mechanics.md#experience-and-levelling-toolbox-row-4), [cartridge.md death penalty declarations](../system/cartridge.md#death-penalty-declarations), [save.md Levelling recovery](../system/save.md#levelling-recovery), [Realm seams](../decisions/owner-decision-realm-seams-2026-10-13.md), brief in Beads `loka-kgd.171`.
- Hosted CI at the head: `ci` and `book-e2e` in progress when written.
- Written 2026-10-16 by anthropic/claude-opus-5-5. Verdict: APPROVE WITH NOTES. The batch-head Fable review is the second look.

## Must be true (written before the diff)

1. Loss = `floor(xp × percent / 100)`, floored at the largest threshold at or below xp (0 below the first); never a level; a 0 loss writes nothing.
2. The loss is one `levelling.set` for `fatal.owner_id` (seam 1), composed through `oneWrite` with same-proposal grants that read the prefix.
3. Composer relaxation identical in both kernels: experience may fall; allocated may not; stale `expected` refused.
4. Loader and compiler refuse alike: penalty below 1.109, `experience` without `world.levelling`, unknown narration; schema bounds percent 1 to 100, items enum.
5. `kept`: player roots stay on the body, empty corpse still made; NPC deaths ignore `penalty`.
6. Opt-in: no other sampler hash or chapter 1 byte changes.
7. Old saves replay unchanged.

All hold.

## Test the tests (scratch detached worktree, each reverted)

| Mutant | Result |
| --- | --- |
| M1 `shared.ts:92` threshold `<=` to `<` | red, `penalty.test.ts` (`[30, 27]`) |
| M2 TS floor `'1.109'` to `'1.108'` (`cartridge_death.ts:61`) | red, `loader_floors.test.ts` (`penalty_sampler at 1.108` loaded): the case is not shadowed |
| M3 Elixir composer guard restored (`compose_levelling.ex:11`) | red, `levelling_test.exs` |
| M4 `sequence.ts:184` `player &&` dropped | red, `penalty.test.ts` (NPC tail) |
| M5 `/ 100` to `/ 10` | red, `penalty.test.ts` |
| M6 Elixir `[1, 109]` to `[1, 108]` (`death.ex:155`) | red, `loader_floors_test.exs`, `content_penalty_test.exs` |
| M7 Elixir levelling-required check removed (`death.ex:35`) | red, `content_penalty_test.exs` |
| M8 TS composer guard restored (`compose_levelling.ts:15`) | red, `levelling_composition.test.ts`, `penalty.test.ts` |

Probe (scratch test, sampler): xp 31 to 30, 32 to 30 (line told), 100 nothing, 101 to 100 (line told). Correct.

## Checks asked by the PM

- Parity: composer change is the same one-term removal in both kernels, pinned by `levelling_composition.json` `experience-falls-composes`. Loader codes and paths match (`penalty.test.ts` last test; `content_penalty_test.exs`).
- Sampler hash: `penalty_sampler_hash.json` `canonical` hashes to `sha256` and equals `encode(value)`; Elixir compiles the source to it with no warnings. No other `*_hash.json` changes.
- Save replay: cold reopen re-decides accepted receipts only; faults store no receipt (save.md elapsed contract). No kernel before 1.109 emitted a fall (grant only adds, raise keeps xp), so no stored receipt holds one, and a penalty cartridge cannot load on an older kernel. The relaxation only turns refusals into acceptances, so an accepted old receipt composes the same. It does not matter.
- Seam 1: `sequence.ts:225` writes for `owner_id`, never `world.character`. Seam 3: n/a (a loss on the victim's own row). The line uses the root actor (`proposal.ts`), like `level_up`: a known limit, recorded in the handback.
- PM ruling, composer stays relaxed: confirmed. The composer is a foundation op over `(op, row)` and has no cartridge thresholds; a threshold guard there would need the cartridge in compose (not cheap). The floor lives in the only writer (`lose`, `shared.ts:88`) and is mutant-pinned (M1). The allocated-may-not-fall guard stays.

## Findings

1. Nit, `kernel/ts/test/penalty.test.ts:171` (percent bounds test): brief acceptance case 3 (32 to 30, line told) and the one-past-boundary at the second threshold are untested; `mechanics.md` Sampler bullet claims "at 32 writes 30", backed only by this review's probe. Scenario: a change that drops the line when the floor binds passes the suite. Fix: add `hall(32)` asserting `[[32, 30]]` and `death.penalty` told.
