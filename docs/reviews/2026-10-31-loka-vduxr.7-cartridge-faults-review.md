# Review: cartridge fault batch, PR #545 (loka-vduxr.7, kernel_api 1.134)

- PR [#545](https://github.com/lorecrafting/lokacore/pull/545) `engine/cartridge-faults` at `a3ca2ef3eef736eeee01e8c29b7ee0cf4d95577b`, diff `origin/main...a3ca2ef3e` (main `99b9016fc`).
- Governing: `br show loka-vduxr`, each bead below; [Candidate C](../../AGENTS.md); [Review count](../WORKFLOW.md#review-count); `docs/system/mechanics.md` (status jobs, schedule, escort, plan move, combat).
- Reviewer: independent; authored none of the work.
- Verdict: CHANGES REQUIRED.
- CI at the head (`gh run list --commit`): ci success 41282921074, book-e2e success 41282921096, graph-diff success 41282925479.

## Must be true (written before reading the diff)

1. A rejected `text.json` crashes no compiler pass and reports at its own path.
2. A bad key in any definition map gives a diagnostic, not a TypeError.
3. Refusals stop no legitimate content; no sampler refused; what compiles does not fault.
4. A following escort is teleported by no mover; Move never faults.
5. A blow at an NPC with a floor clamps, never `evaluator_error`; death still at 0.
6. Spawn plus plan move in a cascade commits; every committed state reloads through the real loader; a forged state is still refused.
7. An item status in a consumed holder ends without events; replay and save stay stable; kernel_api bumped.
8. Showcase hash and transcript unchanged.

1, 2, 4, 5, 7, 8 hold. 3 and 6 do not.

## Findings

**Blocker: a plan move of a `sight` plan's prey bricks the save. `kernel/ts/src/mechanics/population/saved.ts:66`.**
`cartridges/shoo_sampler` plus one reaction, `{"on":{"event":"entity_entered_room","room":"green"},"steps":[{"op":"npc.move","plan":"oak_deer","room":"lane"}]}`, compiles and loads. Walking west is `accepted` and the deer stands in `lane`. Then `hydrate` returns a world and `sightsValid` returns false, so `restorable` fails (`mobile/authority/local-story/store.ts:147`) and `load` returns undefined (`store.ts:126-127`): the save never opens. Same output at main and head. Pinned: stubbing the `.plan.area.some(...)` clause of `originValid` to `true` gives `SIGHTSVALID true`. #545's `homeRoom` reaches only `houndValid`. The kgd.159 tests call `hydrate`, never `sightsValid`, so they miss it. It predates the PR, but the PR closes kgd.159 by teaching the loader the rooms a move names, and its `/code-review` line dismissed this very line.
Fix: use `homeRoom` in `originValid`, or refuse the plan move of a sight plan at compile; a test through `sightsValid`.

**Should-fix: kgd.104 is refused only on the action's own steps. `lib/loka/content/scripted_actions.ex:94`.**
The bead's comment says "Also reached by reactions". `spell_effects_sampler` copy, no `time_policy`, ward `duration` 90, with the `status.apply` moved to a reaction on `action_completed`: compiles, loads, `cast ward` gives fault `precondition_failed` on the status. Loader probes of that shape: action 10, 29 accepted; 30 `nonfuture_job`; 31, 90 `precondition_failed`.
Fix: refuse that path too, or keep kgd.104 open, narrowed to it.

**Should-fix: the PR body's claim is false.** PR body line 26: "unreachable; grep finds no caller of `sightsValid`". `sightsValid` is imported and called at `store.ts:5,147`. Correct the line with the blocker's fix.

**Blocker: the suite stays green with `escorting`'s `&&` as `||`. `kernel/ts/src/mechanics/escort/shared.ts:115`.**
`e?.npc_id === npc || e.status === 'following'` stays green on all 8 test files naming escorts and on `mutate_diff`'s importer set. In that state one following hireling stops every scheduled NPC and crow reaction in the world, and a released one never walks again.
Fix: one test where another NPC still walks its hour while an escort follows.

**Nit: `docs/system/mechanics.md:3398`, and PR body line 27, state a limit I could not reach.** "An `npc.move` naming no room moves a spawned subject to an event room, and that save still fails the loader." With a plan and no room, `reactions.ex` `plan_move` refuses. With a subject: events carrying `room_id` have the entrant (already there), a dead victim, or a body as subject; the rest use the subject's own room. No member changes room, so it is not a brick. Delete the sentence.

**Nit: PR body has no `bin/mutate_diff.sh` table**, only hand mutant counts, so there is no handback table to compare.

## Rulings asked for

| Item | Ruling |
|---|---|
| `round_attack.ts:92` floor-held sleeper not woken | Follow-up. Pre-existing `if (!loss) return`; no fault, the player can still wake. |
| `schedule/rule.ts:139` released escort waits for next authored hour | Follow-up. No fault, no bad placement, no save effect. |
| Roomless subject move a save brick? | No, unreachable (nit above). The real brick is the blocker. |
| `population/saved.ts` dead code, delete | Refuse. `sightsValid` is live and refuses forged saves. |
| `population.ex:131`, `created.ts:108` declined | Accept: style, load-only cost. |
| Refusing duration plus `status.apply` | Right, not over-refusal. With the compile check bypassed, action duration 30 faults `nonfuture_job`, 31 to 300 `precondition_failed`; long statuses work once and fault on refresh (tick 300, duration 3600, action 299, second cast). Every `time_policy` cartridge already refuses `duration` (`INVALID_TIME_POLICY`), so no real story loses anything. No sampler refused. |
| Refusing a template NPC's schedule | Right. Main compiles it, then the first elapsed throws `TypeError: ... reading 'schedule_cases'`. Head: plain refusal at `npcs/raider.json`. `extends` is flattened first, so no bypass. No shipped cartridge has both. |
| 2lvx TS only | Compliant with Candidate C (AGENTS.md:27): story rules stay TypeScript-only until the server consumes them; Elixir has no combat round. |
| kernel_api order with #544 (1.132), #546 (1.133) | Any order. `bin/merge_resolve.py:80-86` keeps the higher; 1.134 stands. |
| Second opinion | Required ([Review count](../WORKFLOW.md#review-count)): loader, lawful saves and `protocol/cartridge.schema.json` all change. |

## Per issue: main, then head

| Issue | Main | Head | Disposition |
|---|---|---|---|
| kgd.194.21 | 107 cartridges by 5 bad text shapes: 8 crashes (`expected a map, got :unknown`, `population.ex:138`) | 0 crashes | Fixed |
| k5z4 | `statuses["BAD"]` with a valid body: `TypeError: object null is not iterable` | `SCHEMA_VIOLATION` `pattern_mismatch` at `.cartridge.statuses["BAD"]` | Fixed |
| ynfo | schedule test fails | passes | Fixed |
| 2lvx | fault `evaluator_error` | clamps at the floor | Fixed |
| kgd.159 | `conflicting_write`; hunter band fails reload | commits and reloads; prey with `sight` still fails the loader | Partly; blocker |
| pyez | status event logged | no event | Fixed |
| kgd.104 | faults as the bead says | refused on the action; reaction path still faults | Partly; should-fix. The bead's long-wait repro did not reproduce (agrees with the developer) |
| template schedule | TypeError at first elapsed | plain refusal | Refused, right |
| w9id | not built | not built | Deliberate, per the brief |

## Tests

Hand mutants with null controls green; each run against the named test file.
Killed: hp floor removed (combat); `homeRoom` any rule and subject branch off (settle); spawn `holders.set` removed (settle); schedule `escorting` removed (escort); eaten branch off (decay); `react.ts` `escorting` removed (a crow reaction test, outside escort and settle); each new `propertyNames` dropped (cartridge, which also backs the PR's claim); `template_schedules` and `timed_status` planted off (Elixir, 6 pass at null).
`job.ts:67` with the holder test removed (`if (world.consumed)`): green on `decay.test.ts` alone, 27 fail on 20 files that use food or decay (null 223 pass, 0 fail; one long showcase run cancelled by my 60 s cap); killed.
`bin/mutate_diff.sh origin/main` (MUTATE_MINUTES=12, 27 of 33 run): red-narrow 6, SURVIVED 3, NO-TESTS 6, TIMEBOX 18. The PR has no table to compare (nit above). The `resource.ts:74` `0 -> 1` mutant hung its run for 19 minutes after failing tests; I killed that node process, so the rest timeboxed. `bin/mutate.sh` has no per-mutant timeout.
Rows cleared by hand: `shared.ts:115` first two against `escort.test.ts` and 7 other files naming escorts: red; the third is the blocker above. `bleed.ex:83` two ways, `bleed.ex:87` two ways and the `is_map(n)` `and` at `bleed.ex:44`: red; `population.ex:131` two ways: red (null 24 pass, 9 content test files). The `1 -> 2` rows are `&1` to `&2` in a capture, a compile error, not survivors. TIMEBOX rows for `rule.ts`, `job.ts`, `created.ts`, `scripted_actions.ex:94` overlap the hand mutants above.
Expected values are hand-written; no frozen fixture touched; showcase hash unchanged. Nothing to delete beyond the nit.

## Re-check at 6e470c5c60f237ef4851fd021c8b0f2cda424b43

Scope: the fix commits, the code they touch and its direct callers.
- Verdict: CHANGES REQUIRED.
- CI at the head (`gh run list --commit`): ci success 41286770707, book-e2e success 41286770719, graph-diff success 41286773977.

### First-review dispositions

| Item | Result at this head |
|---|---|
| `saved.ts:66` sight on plan move (blocker) | Fixed. `cartridges/shoo_sampler` plus a `herd_out` reaction: compile, load, move the deer west, real `hydrate` of a JSON round trip and `sightsValid` true; still true after time passes. Forged member in six other rooms false; `drowned_oak`, `willow_shade` (area) and `lane` (named) true. `saved.ts` back to area-only: red (`deer.test.ts`) |
| `shared.ts:115` `&&` to `\|\|` survived (blocker) | Fixed. Red on `escort.test.ts` "a following escort ignores its schedule hour" |
| `scripted_actions.ex:94` reaction path (should-fix) | Partly: `action_completed` only; findings 1 and 2 |
| PR body claim (should-fix) | Fixed; line 26 and the `created.ts:105` cite check out |
| `mechanics.md:3398` nit | Fixed; matches `homeRoom` (`created.ts:105-118`) |
| PR body mutate table nit | Open |

### Findings

1. **Should-fix, `lib/loka/content/reactions.ex:62`: a lawful `after` reaction is refused.** `timed_status` sees only `on`, never `after`. Answer to the question asked: a delayed status apply is legitimate content. `after` writes a job in place of the steps (`reaction.ts:153`, `:432-447`), so the status row is written when the job runs, not before the action's `time.advance`. Measured: `{"on":{"event":"action_completed"},"after":200,"steps":[status.apply warded]}` on the 90-long ward is refused `duration_status`. The same rule put past the compiler ran with no fault through 6 casts at action/after 90/30, 90/200, 299/200, 299/1, 299/300, 100/50, each with a short and a long status (row written), and 10/3000 (job not yet due). Control without `after`: `precondition_failed`. Limit: that world has no time policy, so the job ran inside later casts, never through `elapsed`. The message's two remedies do not mention `after`. Fix: skip the check when `after` is present (`rule/2`, about line 51, holds `r`), with one test.
2. **Should-fix, `reactions.ex:62`, `docs/system/mechanics.md:2742`, `docs/system/cartridge.md:1073`: a cascade still compiles and faults.** A `fact_changed` reaction on `ward_landed` that does `status.apply warded`, with the 90-long action assigning `ward_landed`, compiles, loads, and `cast ward` faults `precondition_failed` on the status. The docs name the own step and `action_completed` only, and the PR's kgd.104 row does not state this path. Fix: refuse it, or state the limit in both docs and the PR body and keep `loka-kgd.104` open, narrowed. `mechanics.md:2742` also over-states the refusal per finding 1.
3. **Should-fix, `kernel/ts/src/mechanics/escort/shared.ts:115`: dropping `e.status === 'following'` survives.** Green on all 9 test files naming escorts (73 pass, 0 fail). Failure scenario: a completed or separated escort's NPC still counts as escorting, so `schedule/rule.ts:150` holds it and `containment/react.ts:108` refuses its move while that row stands; no code deletes escort rows (read, not run). This is a hand mutant, not one of the `mutate_diff` rows cleared in the first review. Fix: one test that such an NPC walks its hour. The other `shared.ts:115` mutant is red, so I hold this at should-fix rather than blocker.
4. Nit, `test/loka/content_faults_test.exs`: `reactions.ex` `> 0` to `> 100` stays green; the test durations all exceed 100. `on["action"] == nil`, `true`, `== key`, `> 0 or` and `!timed?` are each red.
5. Nit: the PR body still has no `bin/mutate_diff.sh` table and does not report what was left unrun.

No crash on nil definitions: a cartridge with no actions and an `action_completed` reaction gives plain diagnostics.
Not rerun here: `bin/mutate_diff.sh` (hand mutants only, scoped re-check).
