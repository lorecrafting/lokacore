# Review: hotbar engine data, cooldown end and length, round interval (PR #658, loka-x6t.135)

- PR: #658 `engine/hotbar-cooldown-data`
- Reviewed commit: `0f9f44f771899c66c1982cab4678d8957efb34ab` (base origin/main), kernel_api 1.158 -> 1.159
- Governing: [book-ui.md, Combat hotbar](../system/book-ui.md#combat-hotbar) (wedge share from the confirmed
  view's `time`, no Book clock), [protocol.md](../system/protocol.md) combat band paragraph and the new
  composition record, [architecture, composition](../system/architecture.md#building-mechanics-by-composition),
  AGENTS.md ADR-072 (rules and views never write), [WORKFLOW review stance](../WORKFLOW.md#review-stance)
- Independence: Fable reviewer, authored none of the slice; two detached worktrees at the head (sweep and hand
  mutants), removed after the record; no UI, no Chrome walk
- CI at head (`gh run list --commit`): ci success, book-e2e success, graph-diff success
- Developer's `/code-review medium`: reported in the PR body (8 findings: 6 fixed, 2 deferred, 1 accepted)
- Verdict: **APPROVE WITH NOTES**

## Must be true (written before the diff)

1. The projection is a pure read: `ends_at` and `duration` come from the cooldown row admission reads and the
   scripted `cooldown`; no `Date`, no second clock, no write to `world.state` from a view.
2. `ends_at - duration` is the time the Book's `time` axis calls the start of the cooldown for every cooldown
   kind; there is no cooldown that scales, extends or resets outside that one row.
3. The pair appears only on an entry refused with `reason.code === 'cooldown'`, always together, and never past
   `2^53 - 1`; the schema pins "together" and the view pins "only when cooling".
4. `interval` is the value the round scheduler adds to the clock, so the Book's elapsed share is on the same axis
   as the next round.
5. No hashed or recorded output changes silently: saves carry kernel_api, regenerated stories are in the diff,
   graph-diff is green; `bin/contracts.exs --check` passes (Elixir mirror of the schema).
6. Requiring `interval` breaks no consumer that CI validates.

## Checks that held

- 1: `cooling` (`kernel/ts/src/commands/actions.ts:273-277`) reads `world.state.cooldowns[key({kind:'cooldown',
  actor_id, action})]`, the key admission reads at `actions.ts:293`; the only writer of that row is
  `mechanics/scripted_action/rule.ts:104` (`cooldown.start ... at: from`, the admission time). No view writes.
- 2: `view/time.ts:11` sets GameView `time` to `world.state.clock`; `cooldown.start` records the same clock. A
  refused attempt restarts the row (same op), so `ends_at - duration` is always the latest start. No mechanic
  multiplies or clears a cooldown row (grep of `cooldowns` writers and `cooldown` in `mechanics/`).
- 3: callers at `view/action_lists.ts:249`, `view/spells.ts:37`, `view/use.ts:31` gate on the cooldown code;
  `dependentRequired` both ways in `protocol/gameview.schema.json`, supported by `foundation/validate.ts:123` and
  `lib/loka/core/contracts.ex:148`; the SAFE guard returns no pair (`resources.test.ts:253`).
- 4: `view/combat.ts:53` reads `world.combat.interval`, the value `mechanics/combat/rule.ts:77` and
  `round_flow.ts:222` add to the clock; the multipliers touch damage and move cost only.
- 5: `mise exec -- elixir bin/contracts.exs --check` exit 0 at the head. No `gameView(` caller outside
  `kernel/ts/src/view/`; no Elixir module consumes GameView. Regenerated `mobile/app/stories/views/combat-*.json`
  are in the diff.
- 6: `mobile/app/book/combat_flow.test.ts:405` and `offfight_death.test.ts:42` strip `combat` before
  `validate('GameView', wire)`; the other combat literals are untyped (`mobile/app/tsconfig.json` excludes tests)
  and not validated, so the missing `interval` breaks nothing today.
- PR-body reruns: red control `ends_at: world.state.clock + duration` fails `resources.test.ts:290` (red-narrow);
  the schema mutant `"name","interval"] -> "name"]` in `contracts.gen.ts` fails `contracts.test.ts` on the
  `combat_contracts.json` "missing interval" row (red-narrow). Both claims hold.
- Tests: every expected value is a hand literal (3700/3600, 30/30, 600/600, interval 5); no value computed by
  the code under test; `combat_contracts.json` is a schema fixture, not a frozen answer.
- Composition record (`docs/system/protocol.md`, after the combat band paragraph): reads only, writes none;
  `cooling` names no other mechanic or content.

## Mutants

- `bin/mutate_diff.sh origin/main` at the head (MUTATE_MINUTES=25): 11 mutants, red-narrow 5, SURVIVED 6, no
  TIMEBOX (the PR table was run one commit earlier and timeboxed 12). The six survivors are one-hop artifacts:
  `spells.ts:37-38` and `use.ts:31` are reached by `spells.test.ts` / `use.test.ts` through `view/index` (two
  hops), and rerunning the `=== -> !==` flips against those files is red-narrow for both; `actions.ts:276`
  `<= -> <` is the exact `duration == SAFE - last` boundary, which no test pins (the code is right: an end equal
  to `2^53 - 1` does not pass it). Not findings.
- Hand mutants (`bin/mutate.sh`, each against the tests that import the module):

```
red-narrow  actions.ts   ends_at: last + duration -> last + duration - 1           (resources, spells, use tests)
red-narrow  actions.ts   ends_at: last + duration -> world.state.clock + duration   (resources.test.ts)
SURVIVED    use.ts:31    admitted === 'cooldown' && cooling -> typeof admitted === 'string' && cooling (use.test.ts)
red-narrow  combat.ts    interval: ...combat!.interval -> ...interval + 1          (c4_pack.test.ts)
red-narrow  contracts.gen.ts  "name","interval"] -> "name"]                        (contracts.test.ts)
```

## Findings

- Nit, `kernel/ts/src/view/use.ts:31`: the "only when cooling" gate is tested in one direction only. Loosening it
  to any refusal (the survivor above) spreads a stale pair: oil used at 0 with cooldown 600, at 1000 the actor
  lacks the resource, so `admitted` is `insufficient_resource` and the pair `{ends_at: 600, duration: 600}` leaks
  onto that refusal; the schema allows it. One assertion in `use.test.ts:159` (a later `insufficient_resource`
  pair has no `ends_at`) kills it. Fine in a fix round or alongside loka-x6t.136.
- Nit, PR body "Where each value comes from": the cites `actions.ts:276` and `:294` are the return lines; the key
  reads are `:274` and `:293`. Content is right; no change needed.

## Notes (not findings)

- Mobile Book literals without `interval` (`mobile/app/book/combat_flow.test.ts:110` and four other files) need
  no fix here: they are untyped and never validated with `combat` present. They must gain `interval` in
  loka-x6t.136, when the presenter reads it and the harness `view()` grows a `combat` default.
- `docs/system/book-ui.md:1147-1152` "Engine gap" is now stale. It is the designer's text; retiring it belongs to
  loka-x6t.136, which lands the hotbar that paragraph describes.
