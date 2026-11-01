# Second opinion: unattackable NPCs, PR #550 (loka-w9id, kernel_api 1.135)

- PR [#550](https://github.com/lorecrafting/lokacore/pull/550) `engine/peaceful-npcs` at `41cb943272b90e33c237478bf0bb63831959dfe9`.
- Governing: `br show loka-w9id`, audit B1 in `loka-vduxr`, [save pin](../system/save.md), [contracts lessons](../lessons/contracts.md), [review count](../WORKFLOW.md). Follows [the first review](2026-11-01-loka-w9id-review.md) of `945f07161`.
- Reviewer: independent; authored none of the work. View formed before reading the first record.
- **Verdict: APPROVE WITH NOTES.**
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff completed, success. Mergeable, clean.

## Must be true

1. The key is optional; absent, the artifact and its hash do not change; only the `kernel_api` pin moves in story saves; an older save is refused with Start over.
2. Elixir and TypeScript agree, through `extends`, area bundles and spawn templates.
3. GameView and execution read one admission; no compile-valid cartridge reaches a fault.
4. The player cannot attack, damage by spell or aim a draining status; a reaction's status lands and ticks without a fault.
5. `kernel_api` is main+1 at merge.

All five hold at this head; 5 holds today (main 1.134 at `927e9d85c`, head 1.135).

## Findings

**should-fix** `kernel/ts/test/fear.test.ts` (no case; route is `kernel/ts/src/mechanics/reaction.ts:174`). Nothing pins the ruled reaction route. Mutant: filter flagged NPCs out of `on` at `reaction.ts:174`; `fear.test.ts` and `spell_effects.test.ts` stay green (26 of 26), and no other test file names the flag. Failure: moving `drainsFlagged` from `spell.ts:80` down into the shared `statusStep`, a natural tidy, silently stops an authored reaction poisoning a flagged NPC while `docs/guides/writing-the-game.md:206` says it lands. Not a blocker: every mutant of the code this PR changed went red, and the route itself runs correctly (below). One test case closes it.

**nit** PR body line 47 lists "standing.ex:20 `unattackable_engage` misses area-bundled NPCs: open for the PM". Not true at this head: a flagged engaging NPC bundled in an area is refused at `areas/village.npcs.elder.unattackable` (probe). A PM reading the body would open a follow-up for nothing.

## First review's findings at this head

- Blocker, `damage` ignoring the flag: closed, `spell.ts:160`. Mutant dropping the guard: red.
- Should-fix, aimed draining status: closed, `spell.ts:80`, definition `:126-139`. Mutants skipping the guard, draining any resource, `per_tick` `<=0`: red.
- Scripted action route: `rule.ts:277` reaches the same `effect`, so both guards hold. `spell.ts:137` and `damage` read the same key `hp`; a status has no other hp write (`status/job.ts:168-176`).
- Status writers: `statusStep` callers are the reaction, food (own body) and the spell; `applyStatus` otherwise only on built structures (`service/build.ts:65,99`).
- `spell.ts:118` cite nit: gone from the body. `/code-review` result is reported; the body says later commits were not re-reviewed.

## Reaction route, run once

Compiled from source with `mix loka.compile`, a copy of `cartridges/npc_status_sampler`, flagged guard:

| Case | Result |
| --- | --- |
| Reaction poison, hp 10 | status active, hp 6 at expiry, `status_ticked`, `fact_changed`, `status_expired`, no fault |
| Start hp 2 | hp 0, `entity_died`, corpse with origin death, no fault (within the ruling) |
| No `hp` key, flag true and false | identical, no fault |
| Player-triggered reaction naming `npc: guard` | lands, hp 8 after 120 s, no fault |

## Contract and save

- All 107 `cartridges/*` compiled with `lib protocol schemas` at the merge base `235816c98` and at this head: sha256 list identical. The PR touches no cartridge or frozen fixture.
- The seven `mobile/app/stories/live/*.sql` change only the `kernel_api` pin. A 1.134 save is refused with Start over, as for every bump (`docs/system/save.md:19`); no new row or required key.

## Elixir and TypeScript (probes, scratch)

- Parent flag and engage, child `extends`: refused `unattackable_engage`. Child flag over an engaging parent: same.
- Parent flag without engage, child `false`: refused `invalid_value` on the merged form, correct (hostile with attack and no engage).
- Explicit `false`: compiles, behaves as unflagged in both.
- Population member flagged through `extends`: refused `unattackable_foe`. Templates spawn only through a population's `npc` (`runtime/fresh.ts:121`), so a flagged foe cannot reach `combat/behavior.ts:15`.

## Admission

`attackable` (`combat/shared.ts:31`) is read by `attackRefused`, `view/combat.ts:20` and `disposition.ts:124`; other `encounter.open` sites (`combat/rule.ts:45`, `expedition/sequence.ts:112,134`, `spell.ts:122`) filter by `attackRefused`. The arrest clause of `hostileAt` is not gated, by design: it moves the body and opens no encounter (`disposition.ts:60-80`).

## Tests and claims

- Narrow mutants, all red: `shared.ts` flag, `spell.ts` (four above), `view/combat.ts` offer, `standing.ex` `bad?` and members pattern. The two compile checks fire on planted violations.
- Claims rerun, both backed: "other hp writes are body or pool rows"; "no non-test Book file names `attack`", with `mobile/app/book/buttons.ts:222` building cards from `e.actions`.
- Tests compute no expected value from the code under test. Nothing to delete.

## Not run

`bin/mutate_diff.sh` and the full suite (brief: narrow mutants, no sweep).
