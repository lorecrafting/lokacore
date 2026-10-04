# M3-A carrying ceiling review — 2026-10-04

PR #159. Reviewed commit: `4bd3895a56fb6670858a28ca6c7aa99bfa8fce12`.
Fresh independent primary reviewer; authored none of the implementation.

## Requirements derived before reading the diff

- [Cartridge contract](../system/cartridge.md#carrying-settings-and-item-mass): carry is optional, cartridge-owned, safe nonnegative integer; opted items require explicit bounded mass, including zero. Both compiler and loader reject malformed content and API minima below 1.3; legacy artifacts retain meaning.
- [Containment](../system/mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets): only positive-load voluntary Take is limited; equality fits. Load includes distinct nested and worn instances once, including closed contents; already-owned and zero-mass acquisitions remain neutral. Drop/Give/equipment/forced transfers retain semantics.
- [Budgets](../system/protocol.md#budgets): admission shares Steps; projection has one carry-local context. Reads are charged, traversal bounded and cached, arithmetic checked. Malformed relevant mass/cycles/budget exhaustion produce distinct faults before effects. Exhaustion cannot invent neutrality.
- [GameView](../system/protocol.md#gameview) and [item detail](../system/book-ui.md#item-details-and-takedrop): actual Take aliases and contents advertise matching refusal; actual rendered unavailable note uses catalog label, cannot invoke, and refreshes after shedding load.
- [PM balance](../decisions/pm-decision-m3-a-carrying-ceiling-2026-10-04.md): sampler 0.0.6/API1.3, max 12000, full trunk 8200; custody/equipment/definitions compose without content-specific engine branches or persisted load.

## Primary verdict: CHANGES REQUIRED

### M3-1 — blocker: cyclic custody hangs before the carrying fault check

At the reviewed SHA, `kernel/ts/src/mechanics/containment/rule.ts:46` calls
`reach()` before the new carrying predicate. The unchanged walk at
`kernel/ts/src/mechanics/lookups.ts:33` has neither a visited set nor a bound.
With two open items whose custody points to each other, it never returns, so
`carrying()` cannot return `containment_cycle`, the decision budget cannot end the
attempt, and the synchronous host stalls. The equivalent Take prerequisite is
also called by `kernel/ts/src/view/action_lists.ts:46`.

The loop predates M3. The blocker is the new explicit M3 contract in
[containment](../system/mechanics.md#containment1-kerneltssrcmechanicscontainmentrulets)
(`docs/system/mechanics.md:101`): “a relevant custody cycle faults
`containment_cycle`.” The new defense does not protect its actual admission caller.
This is reachable through save loading, not only a direct call to the new helper.

Controlled reproduction, using a temporary in-memory SQLite database only:

1. Create the frozen items world, opt into carry with maximum 10 and explicit
   item masses 1, and initialize its save through the real store `load()`.
2. Update the saved satchel custody row to point to lamp oil. The existing oil
   custody row already points to the satchel; both containers have no barrier.
3. Reopen with real `mobile/authority/local-story/store.ts` `load()`. It returns
   the cyclic world successfully.
4. Call real `step()` with the player's Take command for the satchel.

Observed: the child printed `cyclic custody survives actual save load`, then
failed to return within a three-second timeout and was terminated. Expected:
`{kind: 'fault', code: 'containment_cycle'}`, with no transfer/event/world adoption.
Calling `carrying()` directly on the same cycle does return that fault, exposing
why helper-only coverage misses the caller failure.

Minimum fix scope: make the opted Take prerequisite custody traversal terminate
and propagate the promised typed fault before effects; review its shared direct
callers and preserve ordinary reach/refusal precedence. Add an actual admission
regression with controlled cyclic custody and a timeout safety net. This finding
does not request a new global save validator or a redesign of unrelated mechanics.

## Evidence and coverage

PM personally verified all six CI jobs (`changes`, `bundle`, `lint`, `elixir`,
`sim`, `typescript`) successful at the reviewed SHA before this review. The
following checks were independently executed in the detached reviewer checkout;
commands use `mise exec --`.

| Check | Result |
|---|---|
| `node --test --test-reporter=spec test/containment.test.ts test/equipment.test.ts test/cartridge_items.test.ts` from `kernel/ts` | Exit 0; 36 passed, also after restoring mutants |
| `node --test --test-reporter=spec book/polish.test.ts sampler.test.ts` from `mobile/app` | Exit 0; 17 passed |
| `mix test test/loka/content_items_test.exs test/loka/cartridge_cross_kernel_test.exs` | Exit 0; 14 passed |
| `mix xref callers Loka.Content.Entities` | Exit 0; compiler, checks and links inspected |
| Independent sampler Python oracle | Exit 0; reproduced the exact committed fixture and SHA256 `0883c3649251fcf6cc41db8a679d512b2beb353fabf19c83dd68524e38d6ecd6` |
| Controlled predicate/list/step probes | Cycle and missing mass return their typed faults in the helper; actual list/step budget exhaustion gives `budget_exceeded` |
| Actual save-load/Take cycle probe | Save load succeeds; Take times out after 3 seconds: M3-1 |

Two deliberate mutations in the isolated checkout tested the existing tests:

- Replace `add(load, added) > max` with `>=`: exit 1; nested equality and worn
  equality tests fail (2 failures).
- Replace the shared query charge with unconditional success: exit 1; prior
  policy budget, slot-holder budget and cached-neutral budget tests fail (3 failures).

Exact original bytes were restored after each mutant; final focused tests pass
and `git diff --exit-code` confirms the implementation and fixture are unchanged.
No mutation, temporary probe, save or native artifact is included in this record.
No owner simulator, native build or owner save was used. The rendered component
checks are headless behavior evidence, not native layout evidence.

The remaining reviewed vertical is coherent: schema/compiler/loader enforce
optional carry, complete mass and API 1.3; old frozen artifacts retain their
meaning; sums include nested/worn instances once; equality, forced overload and
neutral/Drop/Give/equipment escape remain covered; aliases and the real refreshed
ThingPage consume the projected reason. Masses and maximum remain cartridge-owned.
The PR's composes-with statement matches custody, definitions, equipment holders
and existing transfers; there is no new persisted load or content-specific engine
branch. The sampler fixture is independently authored apart from its explicitly
shared text catalog.

## Ponytail Review

Lean already: one ephemeral shared predicate reuses existing custody, checked
integer arithmetic, query steps, action projection and renderer. No new dependency
or speculative abstraction. No complexity finding; necessary boundary validation
must remain.

## Cross-vendor review

Separate Sol review at the same head, reproduced verbatim:

```text
CHANGES REQUIRED
PR159 head: 4bd3895a56fb6670858a28ca6c7aa99bfa8fce12

M3-1 | blocker | kernel/ts/src/mechanics/containment/rule.ts:47; kernel/ts/src/view/action_lists.ts:46
An opted carrying world with open satchel↔lamp_oil custody cycles hangs Take in reach() before bounded carrying admission. Direct carrying() returns containment_cycle on the same state, while containment.decide does not return within 2 seconds. Projected Take offers enter the same unbounded reach() walk. This violates the governing relevant-cycle fault contract and prevents the budget guard from running.
Disposition: make the shared reach walk cycle-safe and preserve containment_cycle/budget_exceeded as faults for opted Take and projection. A rule-only change leaves projection vulnerable. If reach returns an error union, update barrier/rule.ts:103 so a truthy error does not count as successful reach. No storage framework is needed.

Scoped validation (mise exec --):
node --test kernel/ts/test/{containment,equipment,cartridge_items}.test.ts: EXIT 0, 36 passed.
mix test test/loka/{content_items,cartridge_cross_kernel}_test.exs: EXIT 0, 14 passed.
node --test mobile/app/book/polish.test.ts mobile/app/sampler.test.ts: EXIT 0, 17 passed.
Equality mutation (> to >=): test command EXIT 1, nested-equality regression failed; restored kernel checks EXIT 0.
Controlled cyclic-world probe: predicate containment_cycle; direct rule timed out at 2 seconds.
Ponytail Review: no over-engineering findings. Exact source restored; detached review worktree removed.
```


## Fix round 1 — scoped primary verdict: APPROVE

Reviewed source head: `20b55042a5e3ce67deaa85b7c38b223dd2e03dd2`.
Scope: M3-1, its fix diff, shared reach's direct callers, and the new real SQLite
save/load regression. Settled portions of the original review were not reopened.

**M3-1 resolved; no open findings.** Shared `reach()` now tracks visited ancestors
and charges each custody edge to the supplied query counter. Take propagates
`containment_cycle` and `budget_exceeded` as faults before event allocation.
Projected Take uses the same bounded reach and carrying counter; only established
boolean reach results are cached. The barrier rule's item lookup propagates a
reach error explicitly, and its rule converts these two errors to faults. The
projection's barrier caller still treats string errors as unavailable.

Closed lids and non-item holders retain their `not_present` precedence before
ancestry beyond the obstruction is inspected. Already-held, missing and non-item
Take targets retain their earlier checks. The accompanying specification changes
state the shared reach budget and fault behavior; they do not weaken M3-1's
required cycle defense.

Independent focused validation (`mise exec --`):

| Command | Result |
|---|---|
| `node --test --test-reporter=spec test/containment.test.ts test/equipment.test.ts test/barriers.test.ts test/locks.test.ts` from `kernel/ts` | Exit 0; 45 passed |
| `node --test --test-reporter=spec mobile/authority/local-story/carrying-reach.test.ts mobile/app/book/polish.test.ts mobile/app/sampler.test.ts` | Exit 0; 22 passed |
| Same new save/load regression alone after restoring the mutant | Exit 0; 5 passed |

Mutation control: temporarily removed both the visited-cycle guard and query-step
guard from shared reach. The new suite exited 1: each real saved-cycle consumer
(Take step, projected Take list, item-barrier rule) hit its five-second subprocess
timeout, and the spent-budget test also failed (4 failures). Original bytes were
restored in `finally`; the new suite then passed, and `git diff --exit-code`
confirmed no implementation difference. This demonstrates that the regression
catches the original unbounded walk through actual callers, not only the helper.

Ponytail Review: the fix stays in the existing shared walk and its callers, with
one necessary projection cache to preserve established results after exhaustion.
No new dependency, storage framework or unrelated abstraction. No complexity
finding. No owner save, simulator or native artifact was touched.

This verdict approves the reviewed source fix. The PM must still verify every
started CI job green on the final pushed head before merging.

### Fix round 1 — cross-vendor review

Separate Sol fix recheck at the same source head, reproduced verbatim:

```text
APPROVE
PR159 — voluntary carrying ceiling; scoped M3-1 fix recheck.
Reviewed source head: 20b55042a5e3ce67deaa85b7c38b223dd2e03dd2

M3-1 CLOSED. Shared reach terminates cycles and meters custody edges before carrying admission. Take returns typed containment_cycle/budget_exceeded faults; projected Take offers expose those codes. Barrier admission explicitly handles reach errors and preserves fault classification. Target/direct-held checks and closed-ancestor not_present precedence remain intact. AST caller inspection found all three runtime reach consumers updated.

Findings: noopen.

Validation (mise exec --):
Validation correction: the earlier singular barrier.test.ts argument omitted the barrier suite; the corrected command below was rerun at this same head.
node --test mobile/authority/local-story/carrying-reach.test.ts kernel/ts/test/{containment,barriers,equipment}.test.ts mobile/app/book/polish.test.ts: EXIT 0, 58 passed, including real SQLite-restored cycle checks.
npm --prefix kernel/ts run typecheck: EXIT 0.
Barrier error-propagation removal: EXIT 1, cycle and spent-budget regressions failed.
Projection reach-cache bypass: EXIT 1, exhausted-counter cached-reach regression failed.
Both mutants restored; repeated focused checks EXIT 0; git diff --exit-code EXIT 0. Detached review worktree removed.
Ponytail Review: no over-engineering findings. This is a scoped source review; CI completion remains the PM gate.
```
