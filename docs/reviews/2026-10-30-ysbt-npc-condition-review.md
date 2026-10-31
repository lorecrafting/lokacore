# Review: NPC condition band in GameView, PR #515 (loka-ysbt, kernel_api 1.123)

- PR [#515](https://github.com/lorecrafting/lokacore/pull/515) `feat/ysbt-npc-condition` at `cac3f411d1ec739f9caa375d45b52641bdc8eb19`, diff `origin/main...cac3f411d` (main `9b5036aae`, kernel_api 1.122).
- Governing: "BRIEF loka-ysbt" and the PM 2026-10-30 ruling (no hp, no band) in `br show loka-ysbt`; the epic renumber note in `br show loka-ewtx` (ysbt 1.123; strictly above main at merge); [protocol.md GameView](../system/protocol.md#gameview) band rule; [save.md](../system/save.md) pin refusals; AGENTS.md "Writing tests".
- Reviewer: independent; authored none of the work.
- Verdict: **APPROVE** at `cac3f411d1ec739f9caa375d45b52641bdc8eb19`; no findings.

## Must be true (written before reading the diff)

1. A visible living NPC with its own `hp` (the `living` test) carries `band`, the key of the first row of its hp pool's table (pool bands, else `world.bands`, else the engine default); only the key.
2. An NPC without its own hp (regen-pool samplers) carries no band and the view does not throw.
3. Items and the player body carry no band; no `current`, `maximum`, `hp` or `tone` key on any entity.
4. Schema: EntityView optional `band` typed as the combat opponent's (`Key`); `additionalProperties: false` kept; contracts.gen.ts regenerated; `validate('GameView')` is `[]`.
5. `world.ts:108` and showcase `cartridge.json:8` at 1.123 (above main's 1.122); hash fixture regenerated from source; so a main save's pin names a hash the app does not carry and is refused `pinned_release_missing` (Start over), not reopened.
6. One protocol.md sentence after the combat-band record, citing loka-ysbt.
7. Nothing under `mobile/` beyond regenerated fixtures; `resources.ts`, `combat.ts`, `lib/` untouched.

Results: 1-7 hold.

## Findings

None (no blocker, should-fix or nit).

Disputed self-review items, both accepted:
- Guard at `kernel/ts/src/view/view.ts:240` rather than in `bandOf`: the brief puts `resources.ts` and `combat.ts` out of scope, and ruling (a) is a view rule ("no hp, no band"), the same `e.hp` test as `living` (`mechanics/death/shared.ts:10`). The same crash in `view/combat.ts:42` is loka-zvwh, not this slice.
- ContentView: `protocol/gameview.schema.json` ContentView is `additionalProperties: false` and already lacks `hostile`, so an NPC never renders there today; no `band` is needed.

## Evidence

- Pin: main's fixture sha256 `e46313c0...`, head's `bc76ec9a...`; `bin/regen_hash_fixture.sh cartridges/toolbox_showcase` run on main's fixture at the head reproduces the head fixture byte for byte. The app bundles that fixture as its only release (`mobile/app/App.tsx:23`, `mobile/authority/local-story/session.ts:93`), so a 1.122 save pins a hash the app lacks: `pinned_release_missing`, new game offered (save.md refusals table), not reopened.
- Repins: every changed transcript and `stories/live/*.sql` equals main's with the old hash replaced by the new one; the five `stories/views/*.json` add only `"band": "ready"` (generated, held by `mobile/app/stories.test.ts`).
- `bin/mutate_diff.sh origin/main`: 3 mutants, SURVIVED 2 (`view.ts:240` `=== -> !==`, `&& -> || #1`), red-narrow 1 (`&& -> || #2`), as the handback table.
- Hand mutants on `view.ts:240`, each red against `theft.test.ts` + `view_actor.test.ts` (unmutated pass 10): the two survivors above (fail 2 each); `'hp'` -> `'mv'` (fail 3); the body's id for the NPC's (fail 2); `.tone` for `.band` (fail 2); `bandOf()` spread (fail 2); `e.hp` guard dropped (fail 4, the theft test throws the TypeError the PR describes).
- Literals hand-checked: showcase bands ready 100 / hurt 50 / dying 0, boar 0..8: 8 ready, 5 and 4 hurt (400 >= 400), 3 dying; engine default, guard 0..10: 10 perfect_health, 9 slightly_scratched, 5 many_nasty_wounds, 1 almost_dead.
- PR claims rerun: "dropping the `e.hp` guard crashes theft.test.ts" (TypeError at `bandOf`'s destructure) and the cite `kernel/ts/src/view/combat.ts:42` (`foe()` calls `bandOf` behind `living` only) both hold.
- `/code-review medium` result reported in the PR body.
- CI (`gh run list --commit cac3f411d1ec...`): ci success, book-e2e success, graph-diff success.
